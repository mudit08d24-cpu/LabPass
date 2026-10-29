-- =============================================================================
-- Internal helpers (never callable from the API; see grants at the end)
-- =============================================================================
create or replace function private._hours(r tstzrange)
returns numeric language sql immutable set search_path = '' as $$
  select extract(epoch from (upper(r) - lower(r))) / 3600.0;
$$;

-- Local (institution time zone) Monday-to-Monday week containing ts.
create or replace function private._week_of(ts timestamptz)
returns tstzrange language sql stable set search_path = '' as $$
  select tstzrange(w, w + interval '7 days', '[)')
  from (select date_trunc('week', ts at time zone private._cfg('timezone')) at time zone private._cfg('timezone') as w) x;
$$;

create or replace function private._booking_cost(t public.resource_type, hours numeric)
returns integer language sql immutable set search_path = '' as $$
  select ceil(hours * case when t = 'specialised'
                           then private._cfg('credits_per_hour_specialised')::numeric
                           else private._cfg('credits_per_hour')::numeric end)::integer;
$$;

create or replace function private._is_active(p_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = p_user and p.status = 'active');
$$;

create or replace function private._user_has_role(p_user uuid, p_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p
                 where p.id = p_user and p.status = 'active' and p_role = any(p.roles));
$$;

-- Admin, the resource's assigned manager, or the owner of its department.
create or replace function private._manages_resource(p_user uuid, p_resource uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private._is_active(p_user) and (
    private._user_has_role(p_user, 'admin') or exists (
      select 1 from public.resources r join public.departments d on d.id = r.department_id
      where r.id = p_resource
        and ((r.manager_id = p_user and private._user_has_role(p_user, 'manager')) or d.owner_id = p_user)));
$$;

-- Highest approved badge tier the user holds for this resource (0 = none).
create or replace function private._user_tier(p_user uuid, p_resource uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce(max(b.tier), 0)::integer
  from public.user_badges ub join public.badges b on b.id = ub.badge_id
  where ub.user_id = p_user and b.resource_id = p_resource and ub.status = 'approved';
$$;

-- 'staff' = someone who manages the resource; 'peer' = Tier 2 student with an approved application.
create or replace function private._supervisor_kind(p_user uuid, p_resource uuid)
returns public.supervisor_kind language sql stable security definer set search_path = '' as $$
  select case
    when private._manages_resource(p_user, p_resource) then 'staff'::public.supervisor_kind
    when private._is_active(p_user)
     and private._user_tier(p_user, p_resource) >= 2
     and exists (select 1 from public.supervisor_approvals sa
                 where sa.user_id = p_user and sa.resource_id = p_resource and sa.status = 'approved')
      then 'peer'::public.supervisor_kind
  end;
$$;

create or replace function private._inside_availability(p_resource uuid, p_range tstzrange)
returns boolean language sql stable security definer set search_path = '' as $$
  with t as (
    select lower(p_range) at time zone private._cfg('timezone') as ls,
           upper(p_range) at time zone private._cfg('timezone') as le)
  select exists (
    select 1 from t join public.availability_slots a on a.resource_id = p_resource
    where t.ls::date = t.le::date
      and a.weekday = extract(isodow from t.ls)::int - 1
      and a.start_time <= t.ls::time and a.end_time >= t.le::time);
$$;

-- Sets the action/reason that the audit trigger records for the rest of this transaction.
create or replace function private._audit(p_action text, p_reason text)
returns void language sql volatile set search_path = '' as $$
  select set_config('labpass.action', coalesce(p_action, ''), true),
         set_config('labpass.reason', coalesce(p_reason, ''), true);
$$;

create or replace function private._notify(p_user uuid, p_type text, p_payload jsonb)
returns void language sql volatile security definer set search_path = '' as $$
  insert into public.notifications(user_id, type, payload)
  select p_user, p_type, coalesce(p_payload, '{}'::jsonb) where p_user is not null;
$$;

create or replace function private._notify_admins(p_type text, p_payload jsonb)
returns void language sql volatile security definer set search_path = '' as $$
  insert into public.notifications(user_id, type, payload)
  select p.id, p_type, coalesce(p_payload, '{}'::jsonb)
  from public.profiles p where p.status = 'active' and 'admin' = any(p.roles);
$$;

-- Balance + immutable ledger, atomically. Negative balances are impossible.
create or replace function private._credit(p_user uuid, p_change integer, p_reason text, p_booking uuid)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if coalesce(p_change, 0) = 0 then return; end if;
  update public.profiles set credits_balance = credits_balance + p_change
   where id = p_user and credits_balance + p_change >= 0;
  if not found then raise exception 'Not enough credits for this action'; end if;
  insert into public.credits_ledger(user_id, change, reason, booking_id, created_by)
  values (p_user, p_change, p_reason, p_booking, auth.uid());
end;
$$;

create or replace function private._chk(p_ok boolean, p_blocking boolean, p_message text)
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object('ok', p_ok, 'blocking', p_blocking, 'message', p_message);
$$;

create or replace function private._failures(p_checks jsonb)
returns text language sql immutable set search_path = '' as $$
  select string_agg(e.value ->> 'message', '; ' order by e.key)
  from jsonb_each(p_checks) e
  where (e.value ->> 'ok')::boolean = false and (e.value ->> 'blocking')::boolean;
$$;

-- FR-10: every check with a plain-language reason. Request time is lenient about conflicts
-- (a taken slot can still be requested and waitlisted); approval time is strict.
create or replace function private._booking_checks(
  p_user uuid, p_resource uuid, p_range tstzrange, p_supervisor uuid, p_exclude uuid, p_for_approval boolean
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  p public.profiles%rowtype;
  r public.resources%rowtype;
  tz text := private._cfg('timezone');
  checks jsonb := '{}'::jsonb;
  hours numeric := private._hours(p_range);
  utier integer;
  needs_sup boolean := false;
  kind public.supervisor_kind;
  wk tstzrange;
  used numeric;
  n integer;
  cost integer;
  max_active integer := private._cfg('max_active_bookings')::integer;
  week_statuses public.booking_status[];
  active_statuses public.booking_status[];
begin
  select * into r from public.resources where id = p_resource;
  if not found then
    return jsonb_build_object('ok', false, 'cost', 0,
      'checks', jsonb_build_object('resource', private._chk(false, true, 'Resource not found')));
  end if;
  select * into p from public.profiles where id = p_user;

  -- Account standing
  if p.id is null or p.status <> 'active' then
    checks := checks || jsonb_build_object('account', private._chk(false, true, 'Your account is not active'));
  elsif p.blocked_until is not null and p.blocked_until > now() then
    checks := checks || jsonb_build_object('account', private._chk(false, true,
      'Booking is blocked until ' || to_char(p.blocked_until at time zone tz, 'DD Mon YYYY HH24:MI')
      || coalesce(' (' || p.block_reason || ')', '')));
  else
    checks := checks || jsonb_build_object('account', private._chk(true, true, 'Account in good standing'));
  end if;

  -- Resource status
  checks := checks || jsonb_build_object('resource', case
    when r.status = 'active' then private._chk(true, true, 'Resource is open for booking')
    when r.status = 'maintenance' then private._chk(false, true, 'Resource is under maintenance')
    else private._chk(false, true, 'Resource is not currently offered') end);

  -- Time and duration
  checks := checks || jsonb_build_object('time', case
    when lower(p_range) <= now() then private._chk(false, true, 'Start time must be in the future')
    when hours > r.max_hours then private._chk(false, true,
      format('%s h requested; the maximum per booking is %s h', round(hours, 2), r.max_hours))
    else private._chk(true, true, format('%s h, within the %s h limit', round(hours, 2), r.max_hours)) end);

  -- Availability window
  checks := checks || jsonb_build_object('availability', case
    when private._inside_availability(p_resource, p_range)
      then private._chk(true, true, 'Inside the published availability')
    else private._chk(false, true, 'Outside the hours this resource is offered') end);

  -- Eligibility tier (0 any student, 1 quiz, 2 certificate/graduation, 3 supervised unless graduated)
  utier := private._user_tier(p_user, p_resource);
  if r.tier = 0 then
    checks := checks || jsonb_build_object('eligibility', private._chk(true, true, 'Open to every verified student'));
  elsif r.tier = 1 then
    checks := checks || jsonb_build_object('eligibility', case when utier >= 1
      then private._chk(true, true, 'Safety quiz passed')
      else private._chk(false, true, 'Needs quiz: pass the safety quiz for this resource') end);
  elsif r.tier = 2 then
    checks := checks || jsonb_build_object('eligibility', case when utier >= 2
      then private._chk(true, true, 'Certificate approved or graduated')
      else private._chk(false, true, 'Needs certificate: upload a certificate for manager review') end);
  elsif utier >= 2 then
    checks := checks || jsonb_build_object('eligibility', private._chk(true, true, 'Graduated: independent use allowed'));
  else
    needs_sup := true;
    checks := checks || jsonb_build_object('eligibility', private._chk(true, true, 'Supervised use: a supervisor is required'));
  end if;

  -- Supervisor
  if p_supervisor is null then
    checks := checks || jsonb_build_object('supervisor', case when needs_sup
      then private._chk(false, true, 'Needs supervisor: choose a staff or peer supervisor with hours covering this slot')
      else private._chk(true, true, 'No supervisor needed') end);
  else
    kind := private._supervisor_kind(p_supervisor, p_resource);
    checks := checks || jsonb_build_object('supervisor', case
      when p_supervisor = p_user then private._chk(false, true, 'You cannot supervise your own booking')
      when kind is null then private._chk(false, true, 'This person is not an approved supervisor for this resource')
      when not exists (select 1 from public.supervisor_slots s
                       where s.supervisor_id = p_supervisor and s.resource_id = p_resource
                         and s.time_range @> p_range)
        then private._chk(false, true, 'The supervisor has not published hours covering this slot')
      when exists (select 1 from public.bookings b
                   where b.supervisor_id = p_supervisor and b.id is distinct from p_exclude
                     and b.status in ('approved','checked_in','overdue') and b.time_range && p_range)
        then private._chk(false, true, 'The supervisor is already supervising another session then')
      else private._chk(true, true, initcap(kind::text) || ' supervisor confirmed for this slot') end);
  end if;

  -- Conflict with an approved/active booking
  if exists (select 1 from public.bookings b
             where b.resource_id = p_resource and b.id is distinct from p_exclude
               and b.status in ('approved','checked_in','overdue') and b.time_range && p_range) then
    checks := checks || jsonb_build_object('conflict', case when p_for_approval
      then private._chk(false, true, 'The slot is already approved for someone else')
      else private._chk(false, false, 'The slot is taken; you can still request it and be waitlisted') end);
  else
    checks := checks || jsonb_build_object('conflict', private._chk(true, true, 'No conflicting approved booking'));
  end if;

  -- Weekly cap per student per resource (local week of the booking start)
  wk := private._week_of(lower(p_range));
  week_statuses := case when p_for_approval
    then array['approved','checked_in','overdue','returned','completed','no_show']::public.booking_status[]
    else array['requested','approved','checked_in','overdue','returned','completed','no_show']::public.booking_status[] end;
  select coalesce(sum(private._hours(b.time_range)), 0) into used
  from public.bookings b
  where b.user_id = p_user and b.resource_id = p_resource and b.id is distinct from p_exclude
    and b.status = any(week_statuses)
    and lower(b.time_range) >= lower(wk) and lower(b.time_range) < upper(wk);
  checks := checks || jsonb_build_object('weekly_cap', private._chk(used + hours <= r.weekly_cap_hours, true,
    format('%s of %s h this week on this resource', round(used + hours, 2), r.weekly_cap_hours)));

  -- Active bookings per student
  active_statuses := case when p_for_approval
    then array['approved','checked_in','overdue']::public.booking_status[]
    else array['requested','approved','checked_in','overdue']::public.booking_status[] end;
  select count(*) into n from public.bookings b
  where b.user_id = p_user and b.id is distinct from p_exclude and b.status = any(active_statuses);
  checks := checks || jsonb_build_object('active_limit', private._chk(n < max_active, true,
    format('%s of %s active bookings in use', n, max_active)));

  -- Credits
  cost := private._booking_cost(r.type, hours);
  checks := checks || jsonb_build_object('credits', private._chk(coalesce(p.credits_balance, 0) >= cost, true,
    format('Costs %s credits; balance %s', cost, coalesce(p.credits_balance, 0))));

  -- Open incidents on the student's own bookings
  select count(*) into n from public.incidents i join public.bookings b on b.id = i.booking_id
  where b.user_id = p_user and i.status in ('open','under_review');
  checks := checks || jsonb_build_object('open_incidents', case when n = 0
    then private._chk(true, true, 'No open incidents')
    else private._chk(false, true, format('%s open incident(s) must be resolved first', n)) end);

  return jsonb_build_object(
    'ok', not exists (select 1 from jsonb_each(checks) e
                      where (e.value ->> 'ok')::boolean = false and (e.value ->> 'blocking')::boolean),
    'cost', cost,
    'needs_supervisor', needs_sup,
    'supervisor_kind', kind,
    'checks', checks);
end;
$$;

-- PRD priority: 50 + 20[no booking of this resource in 14 days] + 15[verified deadline]
--               - 5 * hours this week - 25 * no-shows in 30 days. Ties: earlier request.
create or replace function private._priority(
  p_user uuid, p_resource uuid, p_range tstzrange, p_deadline boolean, p_exclude uuid
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  fresh boolean; h numeric; ns integer; wk tstzrange := private._week_of(lower(p_range)); score numeric;
begin
  fresh := not exists (
    select 1 from public.bookings b
    where b.user_id = p_user and b.resource_id = p_resource and b.id is distinct from p_exclude
      and b.status in ('approved','checked_in','overdue','returned','completed','no_show')
      and lower(b.time_range) >= now() - make_interval(days => private._cfg('priority_fresh_days')::int));
  select coalesce(sum(private._hours(b.time_range)), 0) into h from public.bookings b
  where b.user_id = p_user and b.id is distinct from p_exclude
    and b.status in ('approved','checked_in','overdue','returned','completed','no_show')
    and lower(b.time_range) >= lower(wk) and lower(b.time_range) < upper(wk);
  select count(*) into ns from public.bookings b
  where b.user_id = p_user and b.status = 'no_show'
    and lower(b.time_range) >= now() - make_interval(days => private._cfg('no_show_window_days')::int);
  score := private._cfg('priority_base')::numeric
         + case when fresh then private._cfg('priority_fresh_bonus')::numeric else 0 end
         + case when p_deadline then private._cfg('priority_deadline_bonus')::numeric else 0 end
         + private._cfg('priority_per_week_hour')::numeric * h
         + private._cfg('priority_per_no_show')::numeric * ns;
  return jsonb_build_object('score', round(score, 3), 'breakdown', jsonb_build_object(
    'base', private._cfg('priority_base')::numeric,
    'fresh_resource', case when fresh then private._cfg('priority_fresh_bonus')::numeric else 0 end,
    'verified_deadline', case when p_deadline then private._cfg('priority_deadline_bonus')::numeric else 0 end,
    'hours_this_week', round(h, 2),
    'hours_penalty', round(private._cfg('priority_per_week_hour')::numeric * h, 2),
    'no_shows_30d', ns,
    'no_show_penalty', private._cfg('priority_per_no_show')::numeric * ns,
    'total', round(score, 3)));
end;
$$;

-- Offers freed slots to waitlisted requests in rank order (score desc, earlier request first).
-- A booking whose earlier offer expired is skipped so the next person gets their turn.
create or replace function private._offer_freed_slots(p_resource uuid)
returns integer language plpgsql volatile security definer set search_path = '' as $$
declare w record; n integer := 0; exp timestamptz; offer_id uuid;
begin
  for w in
    select b.* from public.bookings b
    where b.resource_id = p_resource and b.status = 'waitlisted'
      and lower(b.time_range) > now() + interval '1 minute'
    order by b.priority_score desc, b.created_at asc
  loop
    continue when exists (select 1 from public.waitlist_offers o where o.booking_id = w.id);
    continue when exists (select 1 from public.bookings x
                          where x.resource_id = p_resource and x.status in ('approved','checked_in','overdue')
                            and x.time_range && w.time_range);
    continue when exists (select 1 from public.waitlist_offers o join public.bookings x on x.id = o.booking_id
                          where o.status = 'offered' and x.resource_id = p_resource and x.time_range && w.time_range);
    exp := least(now() + make_interval(mins => private._cfg('waitlist_offer_minutes')::int), lower(w.time_range));
    perform private._audit('waitlist_offer', 'Slot freed; offered in priority order');
    insert into public.waitlist_offers(booking_id, expires_at, created_by)
    values (w.id, exp, auth.uid()) returning id into offer_id;
    perform private._notify(w.user_id, 'waitlist_offer',
      jsonb_build_object('offer_id', offer_id, 'booking_id', w.id, 'expires_at', exp));
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Condition evidence must be complete (photo + every checklist item) and co-signed when supervised.
create or replace function private._report_problem(p_booking public.bookings, p_stage public.report_stage)
returns text language plpgsql stable security definer set search_path = '' as $$
declare cr public.condition_reports%rowtype; r public.resources%rowtype; label text := replace(p_stage::text, '_', '-');
begin
  select * into r from public.resources where id = p_booking.resource_id;
  select * into cr from public.condition_reports where booking_id = p_booking.id and stage = p_stage;
  if not found then return format('The %s condition report is missing', label); end if;
  if cardinality(cr.photo_urls) = 0 then return format('The %s report needs at least one photo', label); end if;
  if jsonb_array_length(cr.checklist) < jsonb_array_length(r.checklist) then
    return format('Complete every checklist item in the %s report', label);
  end if;
  if p_booking.supervisor_id is not null and not (p_booking.supervisor_id = any(cr.signed_by)) then
    return format('The supervisor must co-sign the %s report', label);
  end if;
  return null;
end;
$$;

-- Completed supervised sessions with a co-signed return and no adverse incident outcome.
create or replace function private._clean_supervised_sessions(p_user uuid, p_resource uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.bookings b
  where b.user_id = p_user and b.resource_id = p_resource and b.status = 'completed'
    and b.supervisor_id is not null
    and exists (select 1 from public.condition_reports cr
                where cr.booking_id = b.id and cr.stage = 'return' and b.supervisor_id = any(cr.signed_by))
    and not exists (select 1 from public.incidents i
                    where i.booking_id = b.id
                      and (i.status <> 'closed'
                           or (i.decision is not null and i.decision <> 'no_action'
                               and i.dispute_outcome is distinct from 'overturned')));
$$;

-- =============================================================================
-- Policy helpers (callable by authenticated because RLS policies use them)
-- =============================================================================
create or replace function public.has_role(required_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private._user_has_role(auth.uid(), required_role);
$$;

create or replace function public.can_manage_resource(target_resource uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private._manages_resource(auth.uid(), target_resource);
$$;

-- Department-level control: the department owner or an admin only (never a manager).
create or replace function public.can_manage_department(target_department uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private._is_active(auth.uid()) and (public.has_role('admin') or exists (
    select 1 from public.departments d where d.id = target_department and d.owner_id = auth.uid()));
$$;

-- Rules, tiers, limits, checklists, availability, quizzes, badges: owner or admin.
create or replace function public.can_configure_resource(target_resource uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.resources r
                 where r.id = target_resource and public.can_manage_department(r.department_id));
$$;

create or replace function public.is_booking_participant(target_booking uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bookings b
                 where b.id = target_booking
                   and (b.user_id = auth.uid() or b.supervisor_id = auth.uid()
                        or public.can_manage_resource(b.resource_id)));
$$;

create or replace function public.is_supervisor_for(target_resource uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private._supervisor_kind(auth.uid(), target_resource) is not null;
$$;

-- Students see only themselves; managers see people involved with their resources;
-- a student and their supervisor see each other.
create or replace function public.can_view_profile(target uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select target = auth.uid() or public.has_role('admin')
    or exists (select 1 from public.bookings b
               where (b.user_id = target or b.supervisor_id = target) and public.can_manage_resource(b.resource_id))
    or exists (select 1 from public.supervisor_approvals sa
               where sa.user_id = target and public.can_manage_resource(sa.resource_id))
    or exists (select 1 from public.user_badges ub join public.badges bd on bd.id = ub.badge_id
               where ub.user_id = target and public.can_manage_resource(bd.resource_id))
    or exists (select 1 from public.bookings b
               where (b.user_id = auth.uid() and b.supervisor_id = target)
                  or (b.supervisor_id = auth.uid() and b.user_id = target))
    or exists (select 1 from public.resources r
               where r.manager_id = target and public.can_configure_resource(r.id));
$$;

create or replace function public.uuid_or_null(t text)
returns uuid language sql immutable set search_path = '' as $$
  select case when t ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then t::uuid end;
$$;

create or replace function public.can_upload_booking_evidence(target_booking uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.bookings b
                 where b.id = target_booking
                   and b.status in ('approved','checked_in','overdue','returned','completed')
                   and (b.user_id = auth.uid() or b.supervisor_id = auth.uid()
                        or public.can_manage_resource(b.resource_id)));
$$;

create or replace function public.can_review_certificate_file(object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.user_badges ub join public.badges b on b.id = ub.badge_id
                 where ub.evidence_url = object_name and public.can_manage_resource(b.resource_id));
$$;

-- =============================================================================
-- Triggers
-- =============================================================================
-- New auth users get a least-privilege student profile; roles never come from client metadata.
create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'name', ''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_auth_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger profiles_touch          before update on public.profiles          for each row execute function public.touch_updated_at();
create trigger resources_touch         before update on public.resources         for each row execute function public.touch_updated_at();
create trigger quizzes_touch           before update on public.quizzes           for each row execute function public.touch_updated_at();
create trigger bookings_touch          before update on public.bookings          for each row execute function public.touch_updated_at();
create trigger condition_reports_touch before update on public.condition_reports for each row execute function public.touch_updated_at();
create trigger incidents_touch         before update on public.incidents         for each row execute function public.touch_updated_at();

-- Generic audit: one activity_log row per changed row, with actor, action, reason and before/after.
create or replace function private._audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb; v_new jsonb; v_id uuid; v_booking uuid;
  v_action text := nullif(current_setting('labpass.action', true), '');
  v_reason text := nullif(current_setting('labpass.reason', true), '');
begin
  if tg_op <> 'INSERT' then v_old := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then v_new := to_jsonb(new); end if;
  if tg_op = 'UPDATE' and (v_new - 'updated_at') = (v_old - 'updated_at') then return null; end if;
  v_id := coalesce(v_new ->> 'id', v_old ->> 'id')::uuid;
  v_booking := case when tg_table_name = 'bookings' then v_id
                    else nullif(coalesce(v_new ->> 'booking_id', v_old ->> 'booking_id'), '')::uuid end;
  if v_action is null then
    v_action := lower(tg_op);
    if tg_op = 'UPDATE' and (v_new ->> 'status') is distinct from (v_old ->> 'status') then
      v_action := 'status:' || (v_new ->> 'status');
    end if;
  end if;
  insert into public.activity_log(actor_id, entity, entity_id, booking_id, action, reason, before, after)
  values (auth.uid(), tg_table_name, v_id, v_booking, v_action, v_reason, v_old, v_new);
  return null;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['departments','resources','availability_slots','badges','quizzes','user_badges',
                           'supervisor_approvals','supervisor_slots','bookings','waitlist_offers',
                           'condition_reports','incidents','credits_ledger','user_flags']
  loop
    execute format('create trigger %I after insert or update or delete on public.%I
                    for each row execute function private._audit_row()', t || '_audit', t);
  end loop;
end $$;
-- Profiles: audit only access-relevant changes (not the credit balance, which the ledger records).
create trigger profiles_audit after update on public.profiles for each row
  when (old.roles is distinct from new.roles or old.status is distinct from new.status
        or old.department_id is distinct from new.department_id
        or old.blocked_until is distinct from new.blocked_until)
  execute function private._audit_row();

-- Append-only tables: nobody (including service_role) may edit or delete them.
create or replace function private._append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception '% is append-only', tg_table_name;
end;
$$;
create trigger activity_log_no_update  before update or delete on public.activity_log   for each row execute function private._append_only();
create trigger activity_log_no_trunc   before truncate on public.activity_log           for each statement execute function private._append_only();
create trigger credits_ledger_no_update before update or delete on public.credits_ledger for each row execute function private._append_only();
create trigger credits_ledger_no_trunc  before truncate on public.credits_ledger          for each statement execute function private._append_only();

-- Booking notifications (FR-22). Email is sent by a server job reading unemailed rows.
create or replace function private._booking_notify()
returns trigger language plpgsql security definer set search_path = '' as $$
declare r public.resources%rowtype; payload jsonb;
begin
  select * into r from public.resources where id = new.resource_id;
  payload := jsonb_build_object('booking_id', new.id, 'resource_id', r.id, 'resource', r.name,
                                'status', new.status, 'reason', new.reason, 'start', lower(new.time_range));
  if tg_op = 'INSERT' then
    perform private._notify(new.user_id, 'booking_status', payload);
    perform private._notify(r.manager_id, 'booking_request', payload);
  elsif new.status is distinct from old.status then
    perform private._notify(new.user_id, 'booking_status', payload);
    if new.status = 'approved' and new.supervisor_id is not null then
      perform private._notify(new.supervisor_id, 'supervision_assigned', payload);
    end if;
    if old.status = 'approved' and new.status = 'cancelled' and new.supervisor_id is not null then
      perform private._notify(new.supervisor_id, 'supervision_cancelled', payload);
    end if;
    if new.status in ('returned','overdue','no_show') then
      perform private._notify(r.manager_id, 'booking_' || new.status, payload);
    end if;
  end if;
  return null;
end;
$$;
create trigger bookings_notify after insert or update of status on public.bookings
  for each row execute function private._booking_notify();

-- Resource manager must hold the manager role; every resource gets a private check-in code.
create or replace function private._resource_validate()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not private._user_has_role(new.manager_id, 'manager') then
    raise exception 'The assigned manager must be an active user with the manager role';
  end if;
  return new;
end;
$$;
create trigger resources_validate before insert or update of manager_id on public.resources
  for each row execute function private._resource_validate();

create or replace function private._resource_code()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.resource_checkin_codes(resource_id) values (new.id) on conflict do nothing;
  return null;
end;
$$;
create trigger resources_checkin_code after insert on public.resources
  for each row execute function private._resource_code();

-- Published supervision hours that already cover an approved session cannot be removed or shrunk.
create or replace function private._protect_supervisor_slot()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.bookings b
             where b.supervisor_id = old.supervisor_id and b.resource_id = old.resource_id
               and b.status in ('approved','checked_in','overdue')
               and b.time_range && old.time_range
               and (tg_op = 'DELETE' or not (new.time_range @> b.time_range))) then
    raise exception 'These hours cover an approved supervised session; ask the manager to cancel or reassign it first';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
create trigger supervisor_slots_protect before update or delete on public.supervisor_slots
  for each row execute function private._protect_supervisor_slot();

