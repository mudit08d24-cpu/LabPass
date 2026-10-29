-- =============================================================================
-- Discovery and eligibility RPCs
-- =============================================================================
-- FR-05: eligible / needs_quiz / needs_certificate / needs_supervisor / blocked.
create or replace function public.my_eligibility(p_resource uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare r public.resources%rowtype; p public.profiles%rowtype; utier integer;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then raise exception 'Authentication required'; end if;
  select * into r from public.resources where id = p_resource and (status = 'active' or public.can_manage_resource(id));
  if not found then raise exception 'Resource not found'; end if;
  utier := private._user_tier(p.id, r.id);
  if p.status <> 'active' or (p.blocked_until is not null and p.blocked_until > now()) then
    return jsonb_build_object('status', 'blocked', 'until', p.blocked_until, 'reason', p.block_reason);
  end if;
  return jsonb_build_object('resource_tier', r.tier, 'your_tier', utier, 'status', case
    when r.tier = 0 or (r.tier = 1 and utier >= 1) or (r.tier >= 2 and utier >= 2) then 'eligible'
    when r.tier = 1 then 'needs_quiz'
    when r.tier = 2 then 'needs_certificate'
    else 'needs_supervisor' end);
end;
$$;

-- Busy times for a resource without revealing who booked them.
create or replace function public.resource_busy_times(p_resource uuid, p_from timestamptz, p_to timestamptz)
returns table(time_range tstzrange) language sql stable security definer set search_path = '' as $$
  select b.time_range from public.bookings b
  where auth.uid() is not null and b.resource_id = p_resource
    and b.status in ('approved','checked_in','overdue') and b.time_range && tstzrange(p_from, p_to)
  order by lower(b.time_range);
$$;

-- Supervisor hours a student can pick from (FR-09).
create or replace function public.list_supervisor_availability(p_resource uuid, p_from timestamptz, p_to timestamptz)
returns table(slot_id uuid, supervisor_id uuid, supervisor_name text, kind public.supervisor_kind, time_range tstzrange)
language sql stable security definer set search_path = '' as $$
  select s.id, s.supervisor_id, p.name, private._supervisor_kind(s.supervisor_id, s.resource_id), s.time_range
  from public.supervisor_slots s join public.profiles p on p.id = s.supervisor_id
  where auth.uid() is not null and s.resource_id = p_resource
    and s.time_range && tstzrange(p_from, p_to)
    and private._supervisor_kind(s.supervisor_id, s.resource_id) is not null
  order by lower(s.time_range);
$$;

-- =============================================================================
-- Booking RPCs (no direct client writes to bookings)
-- =============================================================================
-- FR-10 preview: run every check and show the priority score before submitting.
create or replace function public.evaluate_booking(
  p_resource_id uuid, p_start timestamptz, p_end timestamptz, p_supervisor_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare rng tstzrange;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_start is null or p_end is null or p_end <= p_start then raise exception 'Booking time range is invalid'; end if;
  rng := tstzrange(p_start, p_end, '[)');
  return private._booking_checks(auth.uid(), p_resource_id, rng, p_supervisor_id, null, false)
         || jsonb_build_object('priority', private._priority(auth.uid(), p_resource_id, rng, false, null));
end;
$$;

create or replace function public.request_booking(
  p_resource_id uuid, p_start timestamptz, p_end timestamptz, p_purpose text, p_supervisor_id uuid default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); rng tstzrange; res jsonb; pr jsonb; new_id uuid;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if p_start is null or p_end is null or p_end <= p_start then raise exception 'Booking time range is invalid'; end if;
  if length(trim(coalesce(p_purpose, ''))) not between 1 and 2000 then
    raise exception 'Please describe the purpose (1–2000 characters)';
  end if;
  perform 1 from public.profiles where id = actor for update;  -- serialises this student's requests
  rng := tstzrange(p_start, p_end, '[)');
  res := private._booking_checks(actor, p_resource_id, rng, p_supervisor_id, null, false);
  if not (res ->> 'ok')::boolean then
    raise exception using message = 'Booking blocked: ' || private._failures(res -> 'checks'),
                          detail = (res -> 'checks')::text;
  end if;
  pr := private._priority(actor, p_resource_id, rng, false, null);
  perform private._audit('request', null);
  insert into public.bookings(resource_id, user_id, supervisor_id, supervisor_kind, time_range, purpose,
                              priority_score, score_breakdown, checks)
  values (p_resource_id, actor, p_supervisor_id, (res ->> 'supervisor_kind')::public.supervisor_kind, rng,
          trim(p_purpose), (pr ->> 'score')::numeric, pr -> 'breakdown', res -> 'checks')
  returning id into new_id;
  return new_id;
end;
$$;

-- FR-11. Approving charges credits and moves overlapping requests to the waitlist.
create or replace function public.manager_decide_booking(p_booking_id uuid, p_decision text, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); b public.bookings%rowtype; res jsonb; cost integer; why text := nullif(trim(p_reason), '');
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found or not public.can_manage_resource(b.resource_id) then raise exception 'Not authorized'; end if;
  if b.status <> 'requested' then raise exception 'Only requested bookings can be decided'; end if;
  if p_decision not in ('approved','rejected','waitlisted') then raise exception 'Invalid decision'; end if;
  if p_decision in ('rejected','waitlisted') and why is null then
    raise exception 'A written reason is required to % a request', case p_decision when 'rejected' then 'reject' else 'waitlist' end;
  end if;

  if p_decision = 'approved' then
    perform 1 from public.profiles where id = b.user_id for update;
    res := private._booking_checks(b.user_id, b.resource_id, b.time_range, b.supervisor_id, b.id, true);
    if not (res ->> 'ok')::boolean then
      raise exception using message = 'Cannot approve: ' || private._failures(res -> 'checks'),
                            detail = (res -> 'checks')::text;
    end if;
    cost := (res ->> 'cost')::integer;
    perform private._audit('approve', why);
    begin
      update public.bookings set status = 'approved', decided_by = actor, reason = why,
             checks = res -> 'checks', credits_charged = cost
       where id = b.id;
    exception when exclusion_violation then
      raise exception 'This slot or supervisor was just taken by another approved booking';
    end;
    perform private._credit(b.user_id, -cost, 'Booking charge', b.id);
    perform private._audit('auto_waitlist', 'An overlapping request was approved; you are on the waitlist in priority order');
    update public.bookings
       set status = 'waitlisted', decided_by = actor,
           reason = 'An overlapping request was approved; you are on the waitlist in priority order'
     where resource_id = b.resource_id and status = 'requested' and id <> b.id and time_range && b.time_range;
  else
    perform private._audit(case p_decision when 'rejected' then 'reject' else 'waitlist' end, why);
    update public.bookings set status = p_decision::public.booking_status, decided_by = actor, reason = why
     where id = b.id;
  end if;
end;
$$;

-- Assumption from the PRD: managers enter faculty-verified deadlines on the student's behalf.
create or replace function public.set_deadline_verified(p_booking_id uuid, p_verified boolean, p_reason text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; pr jsonb;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found or not public.can_manage_resource(b.resource_id) then raise exception 'Not authorized'; end if;
  if b.status not in ('requested','waitlisted') then raise exception 'Only pending or waitlisted requests can be rescored'; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'A reason is required'; end if;
  pr := private._priority(b.user_id, b.resource_id, b.time_range, p_verified, b.id);
  perform private._audit('deadline_verification', trim(p_reason));
  update public.bookings set deadline_verified = p_verified,
         deadline_verified_by = case when p_verified then auth.uid() end,
         priority_score = (pr ->> 'score')::numeric, score_breakdown = pr -> 'breakdown'
   where id = b.id;
  return pr;
end;
$$;

-- FR-13: waitlisted students see rank and score breakdown.
create or replace function public.my_waitlist_rank(p_booking_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare b public.bookings%rowtype; rnk integer; total integer; offer jsonb;
begin
  select * into b from public.bookings where id = p_booking_id;
  if not found or (b.user_id <> auth.uid() and not public.can_manage_resource(b.resource_id)) then
    raise exception 'Not authorized';
  end if;
  if b.status <> 'waitlisted' then raise exception 'Booking is not waitlisted'; end if;
  select count(*) + 1 into rnk from public.bookings x
  where x.resource_id = b.resource_id and x.status = 'waitlisted' and x.id <> b.id and x.time_range && b.time_range
    and (x.priority_score > b.priority_score or (x.priority_score = b.priority_score and x.created_at < b.created_at));
  select count(*) into total from public.bookings x
  where x.resource_id = b.resource_id and x.status = 'waitlisted' and x.time_range && b.time_range;
  select to_jsonb(o) into offer from public.waitlist_offers o where o.booking_id = b.id and o.status = 'offered';
  return jsonb_build_object('rank', rnk, 'of', total, 'score', b.priority_score,
                            'breakdown', b.score_breakdown, 'live_offer', offer);
end;
$$;

create or replace function public.accept_waitlist_offer(p_offer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.waitlist_offers%rowtype; b public.bookings%rowtype; res jsonb; cost integer;
begin
  select * into o from public.waitlist_offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  select * into b from public.bookings where id = o.booking_id for update;
  if b.user_id <> auth.uid() then raise exception 'Not authorized'; end if;
  if o.status <> 'offered' or o.expires_at <= now() or b.status <> 'waitlisted' or lower(b.time_range) <= now() then
    raise exception 'This offer is no longer valid';
  end if;
  perform 1 from public.profiles where id = b.user_id for update;
  res := private._booking_checks(b.user_id, b.resource_id, b.time_range, b.supervisor_id, b.id, true);
  if not (res ->> 'ok')::boolean then
    raise exception using message = 'Cannot accept: ' || private._failures(res -> 'checks'),
                          detail = (res -> 'checks')::text;
  end if;
  cost := (res ->> 'cost')::integer;
  perform private._audit('accept_offer', 'Waitlist offer accepted');
  begin
    update public.bookings set status = 'approved', reason = 'Waitlist offer accepted',
           checks = res -> 'checks', credits_charged = cost
     where id = b.id;
  exception when exclusion_violation then
    raise exception 'The slot is no longer free';
  end;
  perform private._credit(b.user_id, -cost, 'Booking charge (waitlist offer)', b.id);
  update public.waitlist_offers set status = 'accepted' where id = o.id;
end;
$$;

create or replace function public.decline_waitlist_offer(p_offer_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare o public.waitlist_offers%rowtype; b public.bookings%rowtype;
begin
  select * into o from public.waitlist_offers where id = p_offer_id for update;
  if not found then raise exception 'Offer not found'; end if;
  select * into b from public.bookings where id = o.booking_id for update;
  if b.user_id <> auth.uid() then raise exception 'Not authorized'; end if;
  if o.status <> 'offered' then raise exception 'This offer is no longer open'; end if;
  perform private._audit('decline_offer', 'Student declined the waitlist offer');
  update public.waitlist_offers set status = 'declined' where id = o.id;
  update public.bookings set status = 'cancelled', reason = 'Declined the waitlist offer' where id = b.id;
  perform private._offer_freed_slots(b.resource_id);
end;
$$;

-- Students: free cancellation (refund) more than 2 h before start. Managers: reason required, always refunded.
create or replace function public.cancel_booking(p_booking_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); b public.bookings%rowtype; is_owner boolean; refund integer := 0;
  why text := nullif(trim(p_reason), '');
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  is_owner := b.user_id = actor;
  if not is_owner and not public.can_manage_resource(b.resource_id) then raise exception 'Not authorized'; end if;
  if not is_owner and why is null then raise exception 'A reason is required when a manager cancels a booking'; end if;
  if b.status not in ('requested','approved','waitlisted') then
    raise exception 'Booking cannot be cancelled in its current state';
  end if;
  if b.status = 'approved' and b.credits_charged > 0
     and (not is_owner or lower(b.time_range) - now() > make_interval(hours => private._cfg('free_cancel_hours')::int)) then
    refund := b.credits_charged;
  end if;
  perform private._audit('cancel', coalesce(why, 'Cancelled by student'));
  update public.bookings set status = 'cancelled', decided_by = actor, reason = coalesce(why, 'Cancelled by student')
   where id = b.id;
  update public.waitlist_offers set status = 'expired' where booking_id = b.id and status = 'offered';
  if refund > 0 then
    perform private._credit(b.user_id, refund,
      case when is_owner then 'Refund: free cancellation' else 'Refund: cancelled by manager' end, b.id);
  end if;
  if b.status = 'approved' then perform private._offer_freed_slots(b.resource_id); end if;
  return jsonb_build_object('refunded_credits', refund);
end;
$$;

-- =============================================================================
-- Handover RPCs (FR-14, FR-15, FR-17)
-- =============================================================================
create or replace function public.save_condition_report(
  p_booking_id uuid, p_stage public.report_stage, p_checklist jsonb default '[]'::jsonb,
  p_photo_paths text[] default '{}', p_notes text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); b public.bookings%rowtype; is_owner boolean; report_id uuid;
begin
  select * into b from public.bookings where id = p_booking_id;
  if not found then raise exception 'Booking not found'; end if;
  is_owner := b.user_id = actor;
  if not is_owner and not public.can_manage_resource(b.resource_id) then raise exception 'Not authorized'; end if;
  if p_stage = 'check_in' and b.status <> 'approved' then
    raise exception 'The check-in report can only be filled before check-in';
  end if;
  if p_stage = 'return' and b.status not in ('checked_in','overdue') then
    raise exception 'The return report can only be filled while the resource is in use';
  end if;
  if jsonb_typeof(coalesce(p_checklist, 'null'::jsonb)) <> 'array' then raise exception 'Checklist must be a JSON array'; end if;
  if exists (select 1 from unnest(coalesce(p_photo_paths, '{}')) ph
             where ph not like b.id || '/%') then
    raise exception 'Photos must be uploaded to condition-photos under %/', b.id;
  end if;
  perform private._audit('save_' || p_stage || '_report', null);
  -- Any edit clears earlier signatures, so a co-sign always covers the final content.
  insert into public.condition_reports(booking_id, stage, checklist, photo_urls, notes, signed_by)
  values (b.id, p_stage, p_checklist, coalesce(p_photo_paths, '{}'), p_notes,
          case when is_owner then array[actor] else '{}'::uuid[] end)
  on conflict (booking_id, stage) do update
    set checklist = excluded.checklist, photo_urls = excluded.photo_urls,
        notes = excluded.notes, signed_by = excluded.signed_by
  returning id into report_id;
  return report_id;
end;
$$;

create or replace function public.sign_condition_report(p_report_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare cr public.condition_reports%rowtype; b public.bookings%rowtype;
begin
  select * into cr from public.condition_reports where id = p_report_id for update;
  if not found then raise exception 'Report not found'; end if;
  select * into b from public.bookings where id = cr.booking_id;
  if b.supervisor_id is distinct from auth.uid() then raise exception 'Only the assigned supervisor may co-sign'; end if;
  if (cr.stage = 'check_in' and b.status <> 'approved')
     or (cr.stage = 'return' and b.status not in ('checked_in','overdue')) then
    raise exception 'This report can no longer be signed';
  end if;
  if cardinality(cr.photo_urls) = 0 then raise exception 'The report needs a photo before it can be signed'; end if;
  perform private._audit('cosign_' || cr.stage, null);
  update public.condition_reports
     set signed_by = array(select distinct x from unnest(signed_by || array[auth.uid()]) x)
   where id = cr.id;
end;
$$;

-- p_code is the code in the resource's QR (or typed from the printed label).
create or replace function public.check_in_booking(p_booking_id uuid, p_code text)
returns void language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; r public.resources%rowtype; grace interval; problem text;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found or b.user_id <> auth.uid() then raise exception 'Not authorized'; end if;
  if b.status <> 'approved' then raise exception 'Only approved bookings can check in'; end if;
  grace := make_interval(mins => private._cfg('checkin_grace_minutes')::int);
  if now() < lower(b.time_range) - grace or now() > lower(b.time_range) + grace then
    raise exception 'Check-in opens % minutes before the start and closes % minutes after it',
      private._cfg('checkin_grace_minutes'), private._cfg('checkin_grace_minutes');
  end if;
  if not exists (select 1 from public.resource_checkin_codes c
                 where c.resource_id = b.resource_id and c.code = upper(trim(coalesce(p_code, '')))) then
    raise exception 'The QR or check-in code does not match this resource';
  end if;
  select * into r from public.resources where id = b.resource_id;
  if r.status <> 'active' then raise exception 'This resource is not available right now'; end if;
  problem := private._report_problem(b, 'check_in');
  if problem is not null then raise exception '%', problem; end if;
  perform private._audit('check_in', null);
  update public.bookings set status = 'checked_in' where id = b.id;
end;
$$;

create or replace function public.return_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; problem text;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found or b.user_id <> auth.uid() then raise exception 'Not authorized'; end if;
  if b.status not in ('checked_in','overdue') then raise exception 'Booking cannot be returned in this state'; end if;
  problem := private._report_problem(b, 'return');
  if problem is not null then raise exception '%', problem; end if;
  perform private._audit('return', null);
  update public.bookings set status = 'returned' where id = b.id;
end;
$$;

-- Manager confirms; a peer supervisor who co-signed both ends earns 1 credit per supervised hour.
create or replace function public.confirm_return(p_booking_id uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare b public.bookings%rowtype; reward integer := 0;
begin
  select * into b from public.bookings where id = p_booking_id for update;
  if not found or not public.can_manage_resource(b.resource_id) then raise exception 'Not authorized'; end if;
  if b.status <> 'returned' then raise exception 'Only returned bookings can be confirmed'; end if;
  perform private._audit('confirm_return', nullif(trim(p_reason), ''));
  update public.bookings set status = 'completed', decided_by = auth.uid(), reason = nullif(trim(p_reason), '')
   where id = b.id;
  if b.supervisor_kind = 'peer' and (select count(*) from public.condition_reports cr
                                     where cr.booking_id = b.id and b.supervisor_id = any(cr.signed_by)) = 2 then
    reward := greatest(1, round(private._hours(b.time_range) * private._cfg('supervisor_reward_per_hour')::numeric))::integer;
    perform private._credit(b.supervisor_id, reward, 'Peer supervision reward', b.id);
  end if;
  return jsonb_build_object('supervisor_reward', reward);
end;
$$;

-- =============================================================================
-- Eligibility: quiz (FR-07), certificate (FR-08), graduation (FR-18), passport (FR-27)
-- =============================================================================
create or replace function public.get_quiz(p_resource uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('quiz_id', q.id, 'pass_mark', q.pass_mark,
           'questions', (select jsonb_agg(e - 'answer') from jsonb_array_elements(q.questions) e))
  from public.quizzes q join public.resources r on r.id = q.resource_id
  where auth.uid() is not null and q.resource_id = p_resource and r.status = 'active';
$$;

-- p_answers: {"<question id>": <chosen answer>, ...}. Graded on the server; answers never leave the DB.
create or replace function public.submit_quiz(p_resource uuid, p_answers jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid(); q public.quizzes%rowtype; r public.resources%rowtype;
  total integer; correct integer; score numeric; passed boolean; v_badge uuid;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into r from public.resources where id = p_resource and status = 'active';
  if not found then raise exception 'Resource not found'; end if;
  select * into q from public.quizzes where resource_id = p_resource;
  if not found then raise exception 'This resource has no quiz'; end if;
  if jsonb_typeof(coalesce(p_answers, 'null'::jsonb)) <> 'object' then raise exception 'Answers must be a JSON object'; end if;
  total := jsonb_array_length(q.questions);
  select count(*) into correct from jsonb_array_elements(q.questions) e
  where p_answers -> (e ->> 'id') = e -> 'answer';
  score := round(100.0 * correct / total, 2);
  passed := score >= q.pass_mark;
  insert into public.activity_log(actor_id, entity, entity_id, action, after)
  values (actor, 'quizzes', q.id, case when passed then 'quiz_passed' else 'quiz_failed' end,
          jsonb_build_object('correct', correct, 'total', total, 'score', score));
  if passed then
    perform private._audit('quiz_badge', format('Passed the safety quiz (%s/%s)', correct, total));
    select b.id into v_badge from public.badges b where b.resource_id = p_resource and b.kind = 'quiz';
    if v_badge is null then
      insert into public.badges(resource_id, tier, kind, name)
      values (p_resource, 1, 'quiz', left('Safety quiz — ' || r.name, 120)) returning id into v_badge;
    end if;
    insert into public.user_badges(user_id, badge_id, status, reason, granted_at, decided_at)
    values (actor, v_badge, 'approved', format('Passed the safety quiz (%s/%s)', correct, total), now(), now())
    on conflict (user_id, badge_id) do update
      set status = 'approved', reason = excluded.reason, granted_at = now(), decided_at = now(), granted_by = null
      where public.user_badges.status <> 'approved';
  end if;
  return jsonb_build_object('correct', correct, 'total', total, 'score', score, 'passed', passed);
end;
$$;

-- Upload the file to the certificates bucket at <your user id>/<file> first.
create or replace function public.submit_certificate(p_badge_id uuid, p_file_path text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); bd public.badges%rowtype; r public.resources%rowtype; ub_id uuid;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  select * into bd from public.badges where id = p_badge_id and kind = 'certificate';
  if not found then raise exception 'Certificate badge not found'; end if;
  select * into r from public.resources where id = bd.resource_id;
  if coalesce(p_file_path, '') not like actor || '/%' then
    raise exception 'Upload the certificate to the certificates bucket under %/ first', actor;
  end if;
  if exists (select 1 from public.user_badges where user_id = actor and badge_id = bd.id and status = 'approved') then
    raise exception 'You already hold this badge';
  end if;
  perform private._audit('submit_certificate', null);
  insert into public.user_badges(user_id, badge_id, status, evidence_url, submitted_at)
  values (actor, bd.id, 'pending', p_file_path, now())
  on conflict (user_id, badge_id) do update
    set status = 'pending', evidence_url = excluded.evidence_url, submitted_at = now(),
        ai_extraction = null, reason = null, decided_at = null, granted_by = null, granted_at = null
  returning id into ub_id;
  perform private._notify(r.manager_id, 'certificate_review',
    jsonb_build_object('user_badge_id', ub_id, 'resource_id', r.id, 'resource', r.name));
  return ub_id;
end;
$$;

create or replace function public.decide_certificate(p_user_badge_id uuid, p_decision text, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare ub public.user_badges%rowtype; bd public.badges%rowtype; why text := nullif(trim(p_reason), '');
begin
  select * into ub from public.user_badges where id = p_user_badge_id for update;
  if not found then raise exception 'Submission not found'; end if;
  select * into bd from public.badges where id = ub.badge_id;
  if not public.can_manage_resource(bd.resource_id) then raise exception 'Not authorized'; end if;
  if ub.status <> 'pending' then raise exception 'Only pending submissions can be decided'; end if;
  if p_decision not in ('approved','rejected') then raise exception 'Invalid decision'; end if;
  if p_decision = 'rejected' and why is null then raise exception 'A reason is required to reject a certificate'; end if;
  perform private._audit(case p_decision when 'approved' then 'approve_certificate' else 'reject_certificate' end, why);
  update public.user_badges
     set status = p_decision::public.approval_status, reason = why, decided_at = now(), granted_by = auth.uid(),
         granted_at = case when p_decision = 'approved' then now() end
   where id = ub.id;
  perform private._notify(ub.user_id, 'certificate_' || p_decision,
    jsonb_build_object('badge_id', bd.id, 'badge', bd.name, 'reason', why));
end;
$$;

create or replace function public.graduation_progress(p_resource uuid, p_user uuid default null)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare target uuid := coalesce(p_user, auth.uid()); clean integer; needed integer := private._cfg('graduation_sessions')::int;
begin
  if target is null then raise exception 'Authentication required'; end if;
  if target <> auth.uid() and not public.can_manage_resource(p_resource) then raise exception 'Not authorized'; end if;
  clean := private._clean_supervised_sessions(target, p_resource);
  return jsonb_build_object('clean_supervised_sessions', clean, 'required', needed,
    'graduated', private._user_tier(target, p_resource) >= 2,
    'ready_for_signoff', clean >= needed and private._user_tier(target, p_resource) < 2);
end;
$$;

create or replace function public.graduate_student(p_user uuid, p_resource uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.resources%rowtype; v_badge uuid; needed integer := private._cfg('graduation_sessions')::int;
begin
  select * into r from public.resources where id = p_resource;
  if not found or not public.can_manage_resource(p_resource) then raise exception 'Not authorized'; end if;
  if r.tier <> 3 then raise exception 'Graduation applies to Tier 3 resources'; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'A reason is required'; end if;
  if private._user_tier(p_user, p_resource) >= 2 then raise exception 'Student is already Tier 2 for this resource'; end if;
  if private._clean_supervised_sessions(p_user, p_resource) < needed then
    raise exception 'Student needs % clean supervised sessions first', needed;
  end if;
  perform private._audit('graduate', trim(p_reason));
  select b.id into v_badge from public.badges b where b.resource_id = p_resource and b.kind = 'graduation';
  if v_badge is null then
    insert into public.badges(resource_id, tier, kind, name)
    values (p_resource, 2, 'graduation', left('Independent use — ' || r.name, 120)) returning id into v_badge;
  end if;
  insert into public.user_badges(user_id, badge_id, status, reason, granted_by, granted_at, decided_at)
  values (p_user, v_badge, 'approved', trim(p_reason), auth.uid(), now(), now())
  on conflict (user_id, badge_id) do update
    set status = 'approved', reason = excluded.reason, granted_by = excluded.granted_by,
        granted_at = now(), decided_at = now();
  perform private._notify(p_user, 'graduated', jsonb_build_object('resource_id', r.id, 'resource', r.name));
end;
$$;

-- =============================================================================
-- Peer supervision (FR-16)
-- =============================================================================
create or replace function public.apply_as_supervisor(p_resource uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); r public.resources%rowtype; app_id uuid;
begin
  select * into r from public.resources where id = p_resource and status = 'active';
  if not found or actor is null then raise exception 'Resource not found'; end if;
  if private._user_tier(actor, p_resource) < 2 then
    raise exception 'Only students with Tier 2 status for this resource can apply as peer supervisors';
  end if;
  if exists (select 1 from public.supervisor_approvals
             where user_id = actor and resource_id = p_resource and status = 'approved') then
    raise exception 'You are already an approved supervisor for this resource';
  end if;
  perform private._audit('apply_supervisor', null);
  insert into public.supervisor_approvals(user_id, resource_id, status)
  values (actor, p_resource, 'pending')
  on conflict (user_id, resource_id) do update
    set status = 'pending', reason = null, decided_at = null, approved_by = null, created_at = now()
  returning id into app_id;
  perform private._notify(r.manager_id, 'supervisor_application',
    jsonb_build_object('approval_id', app_id, 'resource_id', r.id, 'resource', r.name));
  return app_id;
end;
$$;

-- approved (from pending or suspended), rejected (from pending), suspended (from approved). Reason required except approve.
create or replace function public.decide_supervisor(p_approval_id uuid, p_decision text, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare sa public.supervisor_approvals%rowtype; why text := nullif(trim(p_reason), '');
begin
  select * into sa from public.supervisor_approvals where id = p_approval_id for update;
  if not found or not public.can_manage_resource(sa.resource_id) then raise exception 'Not authorized'; end if;
  if not ((p_decision = 'approved'  and sa.status in ('pending','suspended'))
       or (p_decision = 'rejected'  and sa.status = 'pending')
       or (p_decision = 'suspended' and sa.status = 'approved')) then
    raise exception 'Cannot move a % application to %', sa.status, p_decision;
  end if;
  if p_decision in ('rejected','suspended') and why is null then raise exception 'A written reason is required'; end if;
  perform private._audit('supervisor_' || p_decision, why);
  update public.supervisor_approvals
     set status = p_decision::public.approval_status, reason = why, approved_by = auth.uid(), decided_at = now()
   where id = sa.id;
  perform private._notify(sa.user_id, 'supervisor_' || p_decision,
    jsonb_build_object('resource_id', sa.resource_id, 'reason', why));
end;
$$;

-- =============================================================================
-- Incidents (FR-19 to FR-21)
-- =============================================================================
create or replace function public.open_incident(
  p_booking_id uuid, p_type public.incident_type, p_description text, p_photo_paths text[] default '{}'
) returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); b public.bookings%rowtype; r public.resources%rowtype; incident_id uuid;
begin
  select * into b from public.bookings where id = p_booking_id;
  if not found or not public.is_booking_participant(b.id) then raise exception 'Not authorized'; end if;
  if b.status not in ('checked_in','overdue','returned','completed') then
    raise exception 'An incident cannot be opened from this booking state';
  end if;
  if length(trim(coalesce(p_description, ''))) = 0 then raise exception 'Describe what happened'; end if;
  if exists (select 1 from unnest(coalesce(p_photo_paths, '{}')) ph where ph not like b.id || '/%') then
    raise exception 'Photos must be uploaded to condition-photos under %/', b.id;
  end if;
  select * into r from public.resources where id = b.resource_id;
  perform private._audit('open_incident', null);
  insert into public.incidents(booking_id, type, description, photo_urls, opened_by)
  values (b.id, p_type, trim(p_description), coalesce(p_photo_paths, '{}'), actor)
  returning id into incident_id;
  if actor = b.user_id then
    perform private._notify(r.manager_id, 'incident_opened', jsonb_build_object('incident_id', incident_id, 'booking_id', b.id, 'resource', r.name));
  else
    perform private._notify(b.user_id, 'incident_opened', jsonb_build_object('incident_id', incident_id, 'booking_id', b.id, 'resource', r.name));
  end if;
  return incident_id;
end;
$$;

create or replace function public.start_incident_review(p_incident_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare i public.incidents%rowtype; b public.bookings%rowtype;
begin
  select * into i from public.incidents where id = p_incident_id for update;
  if not found then raise exception 'Incident not found'; end if;
  select * into b from public.bookings where id = i.booking_id;
  if not public.can_manage_resource(b.resource_id) then raise exception 'Not authorized'; end if;
  if i.status <> 'open' then raise exception 'Only open incidents can move to review'; end if;
  perform private._audit('start_review', null);
  update public.incidents set status = 'under_review' where id = i.id;
end;
$$;

-- No automatic penalties: the manager chooses, with a written reason.
create or replace function public.decide_incident(
  p_incident_id uuid, p_decision public.incident_decision, p_reason text,
  p_penalty_credits integer default null, p_block_days integer default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  i public.incidents%rowtype; b public.bookings%rowtype; why text := nullif(trim(p_reason), '');
  bal integer; applied integer; blk timestamptz;
begin
  select * into i from public.incidents where id = p_incident_id for update;
  if not found then raise exception 'Incident not found'; end if;
  select * into b from public.bookings where id = i.booking_id;
  if not public.can_manage_resource(b.resource_id) then raise exception 'Not authorized'; end if;
  if i.status <> 'under_review' then raise exception 'Start the review before deciding'; end if;
  if why is null then raise exception 'A written reason is required'; end if;
  perform private._audit('decide_incident', why);
  if p_decision = 'credit_penalty' then
    if coalesce(p_penalty_credits, 0) <= 0 then raise exception 'Give a positive credit penalty'; end if;
    select credits_balance into bal from public.profiles where id = b.user_id for update;
    applied := least(p_penalty_credits, bal);
    perform private._credit(b.user_id, -applied, 'Incident penalty: ' || why, b.id);
  elsif p_decision = 'temporary_block' then
    if coalesce(p_block_days, 0) not between 1 and 30 then raise exception 'Block length must be 1–30 days'; end if;
    blk := now() + make_interval(days => p_block_days);
    update public.profiles set blocked_until = greatest(coalesce(blocked_until, blk), blk),
           block_reason = 'Incident decision: ' || why
     where id = b.user_id;
  end if;
  update public.incidents set status = 'decided', decision = p_decision, reason = why, decided_by = auth.uid(),
         penalty_credits = applied, block_until = blk
   where id = i.id;
  perform private._notify(b.user_id, 'incident_decision', jsonb_build_object('incident_id', i.id, 'booking_id', b.id,
    'decision', p_decision, 'reason', why, 'penalty_credits', applied, 'block_until', blk));
  return jsonb_build_object('penalty_credits', applied, 'block_until', blk);
end;
$$;

-- Student responds at any point before closure; p_dispute = true escalates a decision to admins.
create or replace function public.respond_to_incident(p_incident_id uuid, p_response text, p_dispute boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare i public.incidents%rowtype; b public.bookings%rowtype;
begin
  select * into i from public.incidents where id = p_incident_id for update;
  if not found then raise exception 'Incident not found'; end if;
  select * into b from public.bookings where id = i.booking_id;
  if b.user_id <> auth.uid() then raise exception 'Not authorized'; end if;
  if length(trim(coalesce(p_response, ''))) = 0 then raise exception 'Write a response'; end if;
  if p_dispute and i.status <> 'decided' then raise exception 'Only a decided incident can be disputed'; end if;
  if i.status not in ('open','under_review','decided') then raise exception 'This incident no longer accepts responses'; end if;
  perform private._audit(case when p_dispute then 'dispute' else 'respond' end, trim(p_response));
  update public.incidents set user_response = trim(p_response),
         status = case when p_dispute then 'disputed'::public.incident_status else status end
   where id = i.id;
  if p_dispute then
    perform private._notify_admins('incident_dispute', jsonb_build_object('incident_id', i.id, 'booking_id', b.id));
  end if;
end;
$$;

create or replace function public.close_incident(p_incident_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare i public.incidents%rowtype; b public.bookings%rowtype;
begin
  select * into i from public.incidents where id = p_incident_id for update;
  if not found then raise exception 'Incident not found'; end if;
  select * into b from public.bookings where id = i.booking_id;
  if not public.can_manage_resource(b.resource_id) then raise exception 'Not authorized'; end if;
  if i.status <> 'decided' then raise exception 'Only decided, undisputed incidents can be closed by a manager'; end if;
  perform private._audit('close_incident', nullif(trim(p_reason), ''));
  update public.incidents set status = 'closed' where id = i.id;
end;
$$;

-- Admin resolves disputes. Overturning refunds the credit penalty and lifts the block it caused.
create or replace function public.resolve_incident_dispute(p_incident_id uuid, p_outcome public.dispute_outcome, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare i public.incidents%rowtype; b public.bookings%rowtype; why text := nullif(trim(p_reason), '');
begin
  if not public.has_role('admin') then raise exception 'Only an admin can resolve disputes'; end if;
  select * into i from public.incidents where id = p_incident_id for update;
  if not found or i.status <> 'disputed' then raise exception 'Incident is not disputed'; end if;
  if why is null then raise exception 'A written reason is required'; end if;
  select * into b from public.bookings where id = i.booking_id;
  perform private._audit('resolve_dispute:' || p_outcome, why);
  if p_outcome = 'overturned' then
    if coalesce(i.penalty_credits, 0) > 0 then
      perform private._credit(b.user_id, i.penalty_credits, 'Refund: incident penalty overturned', b.id);
    end if;
    if i.block_until is not null then
      update public.profiles set blocked_until = null, block_reason = null
       where id = b.user_id and blocked_until = i.block_until;
    end if;
  end if;
  update public.incidents set status = 'closed', dispute_outcome = p_outcome, resolution_reason = why,
         resolved_by = auth.uid(), resolved_at = now()
   where id = i.id;
  perform private._notify(b.user_id, 'incident_dispute_resolved',
    jsonb_build_object('incident_id', i.id, 'outcome', p_outcome, 'reason', why));
end;
$$;

-- =============================================================================
-- Admin: restrictions and pattern flags (restriction rule, FR-26)
-- =============================================================================
create or replace function public.decide_user_flag(p_flag_id uuid, p_confirm boolean, p_reason text, p_block_days integer default null)
returns void language plpgsql security definer set search_path = '' as $$
declare f public.user_flags%rowtype; why text := nullif(trim(p_reason), ''); days integer; blk timestamptz;
begin
  if not public.has_role('admin') then raise exception 'Only an admin can decide flags'; end if;
  select * into f from public.user_flags where id = p_flag_id for update;
  if not found or f.status <> 'pending' then raise exception 'Flag is not pending'; end if;
  if why is null then raise exception 'A written reason is required'; end if;
  perform private._audit(case when p_confirm then 'confirm_flag' else 'dismiss_flag' end, why);
  if p_confirm then
    days := coalesce(p_block_days, f.proposed_block_days, private._cfg('no_show_block_days')::int);
    if days not between 1 and 30 then raise exception 'Block length must be 1–30 days'; end if;
    blk := now() + make_interval(days => days);
    update public.profiles set blocked_until = greatest(coalesce(blocked_until, blk), blk), block_reason = why
     where id = f.user_id;
    perform private._notify(f.user_id, 'account_restricted', jsonb_build_object('until', blk, 'reason', why));
  end if;
  update public.user_flags set status = case when p_confirm then 'confirmed'::public.flag_status else 'dismissed'::public.flag_status end,
         reason = why, decided_by = auth.uid(), decided_at = now()
   where id = f.id;
end;
$$;

create or replace function public.lift_user_block(p_user uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.has_role('admin') then raise exception 'Only an admin can lift a block'; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'A written reason is required'; end if;
  perform private._audit('lift_block', trim(p_reason));
  update public.profiles set blocked_until = null, block_reason = null where id = p_user;
  perform private._notify(p_user, 'account_unrestricted', jsonb_build_object('reason', trim(p_reason)));
end;
$$;

