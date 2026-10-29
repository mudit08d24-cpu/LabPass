-- =============================================================================
-- Resource operations
-- =============================================================================
-- Managers (not only owners) may put a resource under maintenance, with a reason.
create or replace function public.set_resource_status(p_resource uuid, p_status public.resource_status, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_resource(p_resource) then raise exception 'Not authorized'; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'A written reason is required'; end if;
  perform private._audit('set_status:' || p_status, trim(p_reason));
  update public.resources set status = p_status where id = p_resource;
end;
$$;

create or replace function public.get_checkin_code(p_resource uuid)
returns text language sql stable security definer set search_path = '' as $$
  select c.code from public.resource_checkin_codes c
  where c.resource_id = p_resource and public.can_manage_resource(p_resource);
$$;

create or replace function public.rotate_checkin_code(p_resource uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare new_code text;
begin
  if not public.can_manage_resource(p_resource) then raise exception 'Not authorized'; end if;
  insert into public.activity_log(actor_id, entity, entity_id, action)
  values (auth.uid(), 'resources', p_resource, 'rotate_checkin_code');
  update public.resource_checkin_codes
     set code = upper(encode(extensions.gen_random_bytes(4), 'hex')), rotated_at = now()
   where resource_id = p_resource returning code into new_code;
  return new_code;
end;
$$;

-- Owners pick from these when assigning a manager.
create or replace function public.list_assignable_managers()
returns table(id uuid, name text) language sql stable security definer set search_path = '' as $$
  select p.id, p.name from public.profiles p
  where p.status = 'active' and 'manager' = any(p.roles)
    and (public.has_role('admin') or exists (select 1 from public.departments d where d.owner_id = auth.uid()))
  order by p.name;
$$;

create or replace function public.adjust_credits(p_user_id uuid, p_change integer, p_reason text, p_booking_id uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role('admin') then raise exception 'Only an admin can adjust credits manually'; end if;
  if coalesce(p_change, 0) = 0 or length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'Change and reason are required'; end if;
  if p_booking_id is not null and not exists (select 1 from public.bookings where id = p_booking_id and user_id = p_user_id) then
    raise exception 'Booking does not belong to this user';
  end if;
  perform private._audit('adjust_credits', trim(p_reason));
  perform private._credit(p_user_id, p_change, trim(p_reason), p_booking_id);
end;
$$;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.notifications set read_at = coalesce(read_at, now())
   where id = p_notification_id and user_id = auth.uid();
  if not found then raise exception 'Notification not found'; end if;
end;
$$;

-- =============================================================================
-- Idle Radar (FR-25): admins see everything, owners see their departments.
-- =============================================================================
create or replace function public.idle_radar(p_from date, p_to date)
returns table(resource_id uuid, resource_name text, department_id uuid, available_hours numeric,
              booked_hours numeric, used_hours numeric, utilisation numeric, no_show_rate numeric,
              waitlist_length integer, hours_unlocked numeric, bottleneck boolean)
language sql stable security definer set search_path = '' as $$
  with win as (
    select (p_from::timestamp at time zone private._cfg('timezone')) as s,
           ((p_to + 1)::timestamp at time zone private._cfg('timezone')) as e),
  res as (
    select r.* from public.resources r where public.can_manage_department(r.department_id)),
  avail as (
    select a.resource_id, sum(extract(epoch from (a.end_time - a.start_time)) / 3600.0) as h
    from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') g(day)
    join public.availability_slots a on a.weekday = extract(isodow from g.day)::int - 1
    group by a.resource_id),
  bk as (
    select b.resource_id,
      sum(private._hours(b.time_range)) filter (where b.status in ('approved','checked_in','overdue','returned','completed','no_show')) as booked,
      sum(private._hours(b.time_range)) filter (where b.status in ('checked_in','overdue','returned','completed')) as used,
      count(*) filter (where b.status = 'no_show') as ns,
      count(*) filter (where b.status in ('checked_in','overdue','returned','completed')) as shows,
      sum(private._hours(b.time_range)) filter (where b.status in ('returned','completed') and b.supervisor_kind = 'peer') as peer
    from public.bookings b, win
    where lower(b.time_range) >= win.s and lower(b.time_range) < win.e
    group by b.resource_id),
  wl as (
    select b.resource_id, count(*) as n from public.bookings b
    where b.status = 'waitlisted' and lower(b.time_range) > now() group by b.resource_id)
  select r.id, r.name, r.department_id,
         round(coalesce(av.h, 0), 2), round(coalesce(bk.booked, 0), 2), round(coalesce(bk.used, 0), 2),
         case when coalesce(av.h, 0) > 0 then round(coalesce(bk.booked, 0) / av.h, 3) end,
         case when coalesce(bk.ns, 0) + coalesce(bk.shows, 0) > 0 then round(bk.ns::numeric / (bk.ns + bk.shows), 3) end,
         coalesce(wl.n, 0)::integer,
         round(coalesce(bk.peer, 0), 2),
         coalesce(wl.n, 0) >= 3 or (coalesce(av.h, 0) > 0 and coalesce(bk.booked, 0) / av.h >= 0.8)
  from res r
  left join avail av on av.resource_id = r.id
  left join bk on bk.resource_id = r.id
  left join wl on wl.resource_id = r.id
  order by r.name;
$$;

-- Peak and dead hours heatmap: booked hours per local weekday (Mon=0) and hour.
create or replace function public.idle_radar_hourly(p_resource uuid, p_from date, p_to date)
returns table(weekday integer, hour integer, booked_hours numeric)
language sql stable security definer set search_path = '' as $$
  with b as (
    select lower(x.time_range) at time zone private._cfg('timezone') as ls,
           upper(x.time_range) at time zone private._cfg('timezone') as le
    from public.bookings x
    where x.resource_id = p_resource and public.can_configure_resource(p_resource)
      and x.status in ('approved','checked_in','overdue','returned','completed','no_show')
      and lower(x.time_range) >= (p_from::timestamp at time zone private._cfg('timezone'))
      and lower(x.time_range) <  ((p_to + 1)::timestamp at time zone private._cfg('timezone')))
  select extract(isodow from h)::int - 1, extract(hour from h)::int,
         round(sum(extract(epoch from (least(h + interval '1 hour', b.le) - greatest(h, b.ls))) / 3600.0), 2)
  from b, lateral generate_series(date_trunc('hour', b.ls), b.le - interval '1 microsecond', interval '1 hour') h
  group by 1, 2 order by 1, 2;
$$;

-- =============================================================================
-- Scheduled jobs (FR-23) — service_role / pg_cron only
-- =============================================================================
create or replace function public.mark_bookings_overdue()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  perform private._audit('auto_overdue', 'End time passed without a return');
  update public.bookings set status = 'overdue', reason = 'End time passed without a return'
   where status = 'checked_in' and upper(time_range) < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function private._flag_no_show_patterns()
returns integer language plpgsql security definer set search_path = '' as $$
declare u record; n integer := 0; flag_id uuid; cnt integer := private._cfg('no_show_flag_count')::int;
begin
  for u in
    select b.user_id, count(*) as ns, max(lower(b.time_range)) as latest
    from public.bookings b
    where b.status = 'no_show'
      and lower(b.time_range) >= now() - make_interval(days => private._cfg('no_show_window_days')::int)
    group by b.user_id having count(*) >= cnt
  loop
    -- Skip if already flagged since the latest no-show (pending, confirmed or dismissed).
    continue when exists (select 1 from public.user_flags f
                          where f.user_id = u.user_id and f.source = 'no_show_rule' and f.created_at >= u.latest);
    continue when exists (select 1 from public.user_flags f
                          where f.user_id = u.user_id and f.source = 'no_show_rule' and f.status = 'pending');
    perform private._audit('flag_no_shows', format('%s no-shows in %s days', u.ns, private._cfg('no_show_window_days')));
    insert into public.user_flags(user_id, source, evidence, proposed_block_days)
    values (u.user_id, 'no_show_rule',
            jsonb_build_object('no_shows', u.ns, 'window_days', private._cfg('no_show_window_days')::int),
            private._cfg('no_show_block_days')::int)
    returning id into flag_id;
    perform private._notify_admins('restriction_review', jsonb_build_object('flag_id', flag_id, 'user_id', u.user_id, 'no_shows', u.ns));
    n := n + 1;
  end loop;
  return n;
end;
$$;

create or replace function public.mark_booking_no_shows()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer; rids uuid[]; rid uuid;
begin
  perform private._audit('auto_no_show', 'No check-in within the grace period');
  with upd as (
    update public.bookings set status = 'no_show', reason = 'No check-in within the grace period'
     where status = 'approved'
       and lower(time_range) < now() - make_interval(mins => private._cfg('checkin_grace_minutes')::int)
    returning resource_id)
  select count(*), array_agg(distinct resource_id) into n, rids from upd;
  foreach rid in array coalesce(rids, '{}') loop perform private._offer_freed_slots(rid); end loop;
  perform private._flag_no_show_patterns();
  return n;
end;
$$;

create or replace function public.expire_waitlist_offers()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer; rids uuid[]; rid uuid;
begin
  perform private._audit('offer_expired', 'Not accepted within the offer window');
  with upd as (
    update public.waitlist_offers set status = 'expired'
     where status = 'offered' and expires_at <= now()
    returning booking_id)
  select count(*), array_agg(distinct b.resource_id) into n, rids
  from upd join public.bookings b on b.id = upd.booking_id;
  foreach rid in array coalesce(rids, '{}') loop perform private._offer_freed_slots(rid); end loop;
  return n;
end;
$$;

-- Requests nobody decided and waitlist entries whose slot has started are closed with a reason.
create or replace function public.expire_stale_requests()
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  perform private._audit('expire_request', 'The slot started before the request could be approved');
  update public.waitlist_offers o set status = 'expired'
    from public.bookings b
   where o.booking_id = b.id and o.status = 'offered'
     and b.status in ('requested','waitlisted') and lower(b.time_range) <= now();
  update public.bookings set status = 'cancelled', reason = 'The slot started before the request could be approved'
   where status in ('requested','waitlisted') and lower(time_range) <= now();
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.queue_booking_reminders()
returns integer language plpgsql security definer set search_path = '' as $$
declare b record; n integer := 0;
begin
  perform private._audit('reminder_sent', null);
  for b in
    select x.id, x.user_id, x.supervisor_id, x.time_range, r.name
    from public.bookings x join public.resources r on r.id = x.resource_id
    where x.status = 'approved' and x.reminder_sent_at is null
      and lower(x.time_range) > now()
      and lower(x.time_range) <= now() + make_interval(mins => private._cfg('reminder_minutes')::int)
    for update of x skip locked
  loop
    perform private._notify(b.user_id, 'reminder', jsonb_build_object('booking_id', b.id, 'resource', b.name, 'start', lower(b.time_range)));
    perform private._notify(b.supervisor_id, 'reminder', jsonb_build_object('booking_id', b.id, 'resource', b.name, 'start', lower(b.time_range)));
    update public.bookings set reminder_sent_at = now() where id = b.id;
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- One entry point for a single cron schedule (every minute or every 5 minutes).
create or replace function public.run_scheduled_jobs()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  return jsonb_build_object(
    'overdue',        public.mark_bookings_overdue(),
    'no_shows',       public.mark_booking_no_shows(),
    'offers_expired', public.expire_waitlist_offers(),
    'stale_closed',   public.expire_stale_requests(),
    'reminders',      public.queue_booking_reminders());
end;
$$;

-- Weekly sponsored budget: tops each active student up to 10 credits (earned credits above 10 are kept).
create or replace function public.grant_weekly_credits()
returns integer language plpgsql security definer set search_path = '' as $$
declare p record; n integer := 0; budget integer := private._cfg('weekly_credit_budget')::int;
begin
  perform private._audit('weekly_credits', 'Weekly sponsored credit top-up');
  for p in select id, credits_balance from public.profiles
           where status = 'active' and 'student' = any(roles) and credits_balance < budget for update
  loop
    perform private._credit(p.id, budget - p.credits_balance, 'Weekly sponsored credit top-up', null);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Privacy retention: the server job lists these, deletes the files through the Storage API,
-- then calls mark_condition_photos_purged(). (Supabase blocks deleting storage objects via SQL.)
create or replace function public.condition_photos_due_for_purge()
returns table(booking_id uuid, photo_paths text[]) language sql stable security definer set search_path = '' as $$
  select b.id, array(select unnest(cr.photo_urls) from public.condition_reports cr where cr.booking_id = b.id)
  from public.bookings b
  where b.photos_purged_at is null
    and b.status in ('completed','cancelled','no_show','rejected')
    and b.updated_at < now() - make_interval(days => private._cfg('photo_retention_days')::int)
    and not exists (select 1 from public.incidents i where i.booking_id = b.id and i.status <> 'closed')
    and exists (select 1 from public.condition_reports cr where cr.booking_id = b.id and cardinality(cr.photo_urls) > 0);
$$;

create or replace function public.mark_condition_photos_purged(p_booking_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private._audit('photos_purged', 'Retention period ended');
  update public.condition_reports set photo_urls = '{}' where booking_id = p_booking_id;
  update public.bookings set photos_purged_at = now() where id = p_booking_id;
end;
$$;

-- =============================================================================
-- AI outputs (stored for audit, never change a booking or penalty) — service_role only
-- =============================================================================
create or replace function public.save_incident_ai(p_incident_id uuid, p_summary text, p_photo_diff jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private._audit('ai_suggestion', 'AI suggestion — needs review');
  update public.incidents set ai_summary = p_summary, ai_photo_diff = p_photo_diff where id = p_incident_id;
end;
$$;

create or replace function public.save_certificate_ai(p_user_badge_id uuid, p_extraction jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private._audit('ai_suggestion', 'AI suggestion — needs review');
  update public.user_badges set ai_extraction = p_extraction where id = p_user_badge_id;
end;
$$;

-- Smart-matching results and other AI outputs that have no home column.
create or replace function public.log_ai_suggestion(
  p_feature text, p_entity text, p_entity_id uuid, p_output jsonb, p_actor uuid default null, p_booking_id uuid default null
) returns void language sql security definer set search_path = '' as $$
  insert into public.activity_log(actor_id, entity, entity_id, booking_id, action, reason, after)
  values (p_actor, p_entity, p_entity_id, p_booking_id, 'ai_suggestion:' || p_feature, 'AI suggestion — needs review', p_output);
$$;

create or replace function public.record_ai_pattern_flag(p_user uuid, p_evidence jsonb, p_proposed_block_days integer default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare flag_id uuid;
begin
  perform private._audit('ai_flag', 'AI suggestion — needs review');
  insert into public.user_flags(user_id, source, evidence, proposed_block_days)
  values (p_user, 'ai_pattern', p_evidence, p_proposed_block_days)
  on conflict (user_id, source) where status = 'pending'
  do update set evidence = excluded.evidence, proposed_block_days = excluded.proposed_block_days
  returning id into flag_id;
  perform private._notify_admins('ai_pattern_flag', jsonb_build_object('flag_id', flag_id, 'user_id', p_user));
  return flag_id;
end;
$$;

-- =============================================================================
-- Row-Level Security
-- =============================================================================
alter table public.profiles               enable row level security;
alter table public.departments            enable row level security;
alter table public.resources              enable row level security;
alter table public.resource_checkin_codes enable row level security;  -- no policies: RPC access only
alter table public.availability_slots     enable row level security;
alter table public.badges                 enable row level security;
alter table public.user_badges            enable row level security;
alter table public.quizzes                enable row level security;
alter table public.supervisor_approvals   enable row level security;
alter table public.supervisor_slots       enable row level security;
alter table public.bookings               enable row level security;
alter table public.waitlist_offers        enable row level security;
alter table public.condition_reports      enable row level security;
alter table public.incidents              enable row level security;
alter table public.credits_ledger         enable row level security;
alter table public.notifications          enable row level security;
alter table public.activity_log           enable row level security;
alter table public.user_flags             enable row level security;

-- Departments: names are public to signed-in users (cross-department discovery, FR-04).
create policy departments_read on public.departments for select to authenticated using (true);

create policy profiles_read on public.profiles for select to authenticated using (public.can_view_profile(id));
create policy profiles_self_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy resources_read on public.resources for select to authenticated
  using (status = 'active' or public.can_manage_resource(id));
create policy resources_insert on public.resources for insert to authenticated
  with check (public.can_manage_department(department_id));
create policy resources_update on public.resources for update to authenticated
  using (public.can_configure_resource(id)) with check (public.can_manage_department(department_id));
create policy resources_delete on public.resources for delete to authenticated
  using (public.can_configure_resource(id));

create policy availability_read on public.availability_slots for select to authenticated
  using (exists (select 1 from public.resources r where r.id = resource_id));
create policy availability_write on public.availability_slots for all to authenticated
  using (public.can_configure_resource(resource_id)) with check (public.can_configure_resource(resource_id));

create policy badges_read on public.badges for select to authenticated
  using (exists (select 1 from public.resources r where r.id = resource_id));
create policy badges_write on public.badges for all to authenticated
  using (public.can_configure_resource(resource_id)) with check (public.can_configure_resource(resource_id));

-- Answers are inside questions, so only staff read the table; students use get_quiz().
create policy quizzes_read on public.quizzes for select to authenticated
  using (public.can_manage_resource(resource_id));
create policy quizzes_write on public.quizzes for all to authenticated
  using (public.can_configure_resource(resource_id)) with check (public.can_configure_resource(resource_id));

create policy user_badges_read on public.user_badges for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.badges b
         where b.id = badge_id and public.can_manage_resource(b.resource_id)));

create policy approvals_read on public.supervisor_approvals for select to authenticated
  using (user_id = auth.uid() or public.can_manage_resource(resource_id));

create policy supervisor_slots_read on public.supervisor_slots for select to authenticated
  using (supervisor_id = auth.uid() or public.can_manage_resource(resource_id));
create policy supervisor_slots_insert on public.supervisor_slots for insert to authenticated
  with check (supervisor_id = auth.uid() and public.is_supervisor_for(resource_id));
create policy supervisor_slots_update on public.supervisor_slots for update to authenticated
  using (supervisor_id = auth.uid()) with check (supervisor_id = auth.uid() and public.is_supervisor_for(resource_id));
create policy supervisor_slots_delete on public.supervisor_slots for delete to authenticated
  using (supervisor_id = auth.uid() or public.can_manage_resource(resource_id));

create policy bookings_read on public.bookings for select to authenticated
  using (user_id = auth.uid() or supervisor_id = auth.uid() or public.can_manage_resource(resource_id));
create policy waitlist_offers_read on public.waitlist_offers for select to authenticated
  using (exists (select 1 from public.bookings b where b.id = booking_id
                 and (b.user_id = auth.uid() or public.can_manage_resource(b.resource_id))));
create policy condition_reports_read on public.condition_reports for select to authenticated
  using (public.is_booking_participant(booking_id));
create policy incidents_read on public.incidents for select to authenticated
  using (public.is_booking_participant(booking_id));
create policy credits_ledger_read on public.credits_ledger for select to authenticated
  using (user_id = auth.uid() or public.has_role('admin')
         or (booking_id is not null and exists (select 1 from public.bookings b
             where b.id = booking_id and public.can_manage_resource(b.resource_id))));
create policy notifications_read on public.notifications for select to authenticated
  using (user_id = auth.uid());
-- FR-24: both parties (and the supervisor) see the booking timeline; admin sees everything.
create policy activity_log_read on public.activity_log for select to authenticated
  using (public.has_role('admin') or actor_id = auth.uid()
         or (booking_id is not null and public.is_booking_participant(booking_id)));
create policy user_flags_read on public.user_flags for select to authenticated
  using (public.has_role('admin'));

-- =============================================================================
-- Table privileges (Supabase grants everything to anon/authenticated by default)
-- =============================================================================
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.departments, public.resources, public.availability_slots,
  public.badges, public.user_badges, public.quizzes, public.supervisor_approvals, public.supervisor_slots,
  public.bookings, public.waitlist_offers, public.condition_reports, public.incidents,
  public.credits_ledger, public.notifications, public.activity_log, public.user_flags
  to authenticated;
grant update (name, roll_no) on public.profiles to authenticated;
grant insert (id, department_id, manager_id, name, type, tier, location, photos, max_hours, weekly_cap_hours,
              checklist, deposit_amount, status),
      update (manager_id, name, type, tier, location, photos, max_hours, weekly_cap_hours,
              checklist, deposit_amount, status),
      delete on public.resources to authenticated;
grant insert (resource_id, weekday, start_time, end_time), update (weekday, start_time, end_time), delete
  on public.availability_slots to authenticated;
grant insert (resource_id, tier, kind, name, description), update (name, description), delete
  on public.badges to authenticated;
grant insert (resource_id, questions, pass_mark), update (questions, pass_mark), delete
  on public.quizzes to authenticated;
grant insert (supervisor_id, resource_id, time_range), update (time_range), delete
  on public.supervisor_slots to authenticated;

-- =============================================================================
-- Function privileges. Supabase grants EXECUTE on new functions to anon and authenticated
-- by default, so revoke everything and grant back explicitly.
-- =============================================================================
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;
revoke execute on all functions in schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;
grant execute on all functions in schema private to service_role;
grant execute on function private._quiz_questions_valid(jsonb) to authenticated;  -- quizzes CHECK constraint

-- Used inside RLS / storage policies
grant execute on function
  public.has_role(text), public.can_manage_resource(uuid), public.can_manage_department(uuid),
  public.can_configure_resource(uuid), public.is_booking_participant(uuid), public.is_supervisor_for(uuid),
  public.can_view_profile(uuid), public.uuid_or_null(text), public.can_upload_booking_evidence(uuid),
  public.can_review_certificate_file(text)
  to authenticated;

-- App RPCs
grant execute on function
  public.labpass_config(),
  public.my_eligibility(uuid), public.resource_busy_times(uuid, timestamptz, timestamptz),
  public.list_supervisor_availability(uuid, timestamptz, timestamptz),
  public.evaluate_booking(uuid, timestamptz, timestamptz, uuid),
  public.request_booking(uuid, timestamptz, timestamptz, text, uuid),
  public.manager_decide_booking(uuid, text, text), public.set_deadline_verified(uuid, boolean, text),
  public.my_waitlist_rank(uuid), public.accept_waitlist_offer(uuid), public.decline_waitlist_offer(uuid),
  public.cancel_booking(uuid, text),
  public.save_condition_report(uuid, public.report_stage, jsonb, text[], text),
  public.sign_condition_report(uuid), public.check_in_booking(uuid, text), public.return_booking(uuid),
  public.confirm_return(uuid, text),
  public.get_quiz(uuid), public.submit_quiz(uuid, jsonb),
  public.submit_certificate(uuid, text), public.decide_certificate(uuid, text, text),
  public.graduation_progress(uuid, uuid), public.graduate_student(uuid, uuid, text),
  public.apply_as_supervisor(uuid), public.decide_supervisor(uuid, text, text),
  public.open_incident(uuid, public.incident_type, text, text[]), public.start_incident_review(uuid),
  public.decide_incident(uuid, public.incident_decision, text, integer, integer),
  public.respond_to_incident(uuid, text, boolean), public.close_incident(uuid, text),
  public.resolve_incident_dispute(uuid, public.dispute_outcome, text),
  public.decide_user_flag(uuid, boolean, text, integer), public.lift_user_block(uuid, text),
  public.set_resource_status(uuid, public.resource_status, text),
  public.get_checkin_code(uuid), public.rotate_checkin_code(uuid), public.list_assignable_managers(),
  public.adjust_credits(uuid, integer, text, uuid), public.mark_notification_read(uuid),
  public.idle_radar(date, date), public.idle_radar_hourly(uuid, date, date)
  to authenticated;
-- Not granted to authenticated (service_role / pg_cron only): run_scheduled_jobs and the job functions,
-- grant_weekly_credits, condition_photos_due_for_purge, mark_condition_photos_purged,
-- save_incident_ai, save_certificate_ai, log_ai_suggestion, record_ai_pattern_flag.

-- =============================================================================
-- Storage buckets (paths are stored in the tables without the bucket name)
--   resource-photos   (public):  <resource_id>/<file>  — owner/admin upload, anyone can view
--   condition-photos  (private): <booking_id>/<file>   — check-in, return and incident photos;
--                                 borrower, supervisor, manager and admin can view
--   certificates      (private): <user_id>/<file>      — the uploader and the reviewing manager only
-- Condition photos and certificates are insert-only for users, so evidence cannot be swapped later.
-- =============================================================================
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types) values
  ('resource-photos',  'resource-photos',  true,  10485760, array['image/jpeg','image/png','image/webp']),
  ('condition-photos', 'condition-photos', false, 10485760, array['image/jpeg','image/png','image/webp']),
  ('certificates',     'certificates',     false, 10485760, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy lp_resource_photos_read on storage.objects for select
  using (bucket_id = 'resource-photos');
create policy lp_resource_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'resource-photos'
              and public.can_configure_resource(public.uuid_or_null((storage.foldername(name))[1])));
create policy lp_resource_photos_update on storage.objects for update to authenticated
  using (bucket_id = 'resource-photos'
         and public.can_configure_resource(public.uuid_or_null((storage.foldername(name))[1])))
  with check (bucket_id = 'resource-photos'
              and public.can_configure_resource(public.uuid_or_null((storage.foldername(name))[1])));
create policy lp_resource_photos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'resource-photos'
         and public.can_configure_resource(public.uuid_or_null((storage.foldername(name))[1])));

create policy lp_condition_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'condition-photos'
         and public.is_booking_participant(public.uuid_or_null((storage.foldername(name))[1])));
create policy lp_condition_photos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'condition-photos'
              and public.can_upload_booking_evidence(public.uuid_or_null((storage.foldername(name))[1])));

create policy lp_certificates_read on storage.objects for select to authenticated
  using (bucket_id = 'certificates'
         and (public.uuid_or_null((storage.foldername(name))[1]) = auth.uid()
              or public.can_review_certificate_file(name)));
create policy lp_certificates_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'certificates'
              and public.uuid_or_null((storage.foldername(name))[1]) = auth.uid());

-- =============================================================================
-- Realtime: notification bell, live request queue, waitlist offers
-- =============================================================================
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['bookings','notifications','waitlist_offers'] loop
      if not exists (select 1 from pg_publication_tables
                     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;


-- =============================================================================
-- After running (not executed automatically)
-- =============================================================================
-- 1) Seed data from a trusted path (SQL editor / service role): profiles.roles, profiles.department_id,
--    departments.owner_id, then resources, availability_slots, badges, quizzes. Run
--    select public.grant_weekly_credits();   to give students their first 10 credits.
-- 2) Schedule jobs with pg_cron (Database → Extensions → pg_cron), or call the same RPCs from
--    Vercel Cron with the service-role key:
--      select cron.schedule('labpass-jobs',    '* * * * *',  $$select public.run_scheduled_jobs()$$);
--      select cron.schedule('labpass-credits', '1 0 * * 1',  $$select public.grant_weekly_credits()$$);
--    (cron times are UTC; 00:01 UTC Monday is 05:31 IST.)
-- 3) Server jobs (Next.js + service role): send Resend emails for notifications where emailed_at is null,
--    then set emailed_at; purge photos listed by condition_photos_due_for_purge() via the Storage API,
--    then call mark_condition_photos_purged(booking_id).
-- 4) AI: the server calls the model, then save_incident_ai / save_certificate_ai / log_ai_suggestion /
--    record_ai_pattern_flag. If the AI call fails, skip the call — nothing in the flow waits on it.
-- 5) QR: encode the resource's check-in code (get_checkin_code) in the printed QR; check_in_booking
--    needs that code, so a student must be at the resource to check in.
