-- Performance fixes from the Supabase advisor (no behaviour change).

-- 1) Cover every foreign key with an index.
create index if not exists bookings_deadline_verified_by_idx      on public.bookings(deadline_verified_by);
create index if not exists bookings_decided_by_idx                on public.bookings(decided_by);
create index if not exists credits_ledger_booking_idx             on public.credits_ledger(booking_id);
create index if not exists credits_ledger_created_by_idx          on public.credits_ledger(created_by);
create index if not exists departments_owner_idx                  on public.departments(owner_id);
create index if not exists incidents_decided_by_idx               on public.incidents(decided_by);
create index if not exists incidents_opened_by_idx                on public.incidents(opened_by);
create index if not exists incidents_resolved_by_idx              on public.incidents(resolved_by);
create index if not exists profiles_department_idx                on public.profiles(department_id);
create index if not exists supervisor_approvals_approved_by_idx   on public.supervisor_approvals(approved_by);
create index if not exists supervisor_approvals_resource_idx      on public.supervisor_approvals(resource_id);
create index if not exists user_badges_granted_by_idx             on public.user_badges(granted_by);
create index if not exists user_flags_decided_by_idx              on public.user_flags(decided_by);
create index if not exists waitlist_offers_created_by_idx         on public.waitlist_offers(created_by);

-- 2) Evaluate auth.uid() once per query instead of once per row.
alter policy profiles_self_update on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy user_badges_read on public.user_badges
  using (user_id = (select auth.uid()) or exists (select 1 from public.badges b
         where b.id = badge_id and public.can_manage_resource(b.resource_id)));
alter policy approvals_read on public.supervisor_approvals
  using (user_id = (select auth.uid()) or public.can_manage_resource(resource_id));
alter policy supervisor_slots_read on public.supervisor_slots
  using (supervisor_id = (select auth.uid()) or public.can_manage_resource(resource_id));
alter policy supervisor_slots_insert on public.supervisor_slots
  with check (supervisor_id = (select auth.uid()) and public.is_supervisor_for(resource_id));
alter policy supervisor_slots_update on public.supervisor_slots
  using (supervisor_id = (select auth.uid()))
  with check (supervisor_id = (select auth.uid()) and public.is_supervisor_for(resource_id));
alter policy supervisor_slots_delete on public.supervisor_slots
  using (supervisor_id = (select auth.uid()) or public.can_manage_resource(resource_id));
alter policy bookings_read on public.bookings
  using (user_id = (select auth.uid()) or supervisor_id = (select auth.uid())
         or public.can_manage_resource(resource_id));
alter policy waitlist_offers_read on public.waitlist_offers
  using (exists (select 1 from public.bookings b where b.id = booking_id
                 and (b.user_id = (select auth.uid()) or public.can_manage_resource(b.resource_id))));
alter policy credits_ledger_read on public.credits_ledger
  using (user_id = (select auth.uid()) or public.has_role('admin')
         or (booking_id is not null and exists (select 1 from public.bookings b
             where b.id = booking_id and public.can_manage_resource(b.resource_id))));
alter policy notifications_read on public.notifications
  using (user_id = (select auth.uid()));
alter policy activity_log_read on public.activity_log
  using (public.has_role('admin') or actor_id = (select auth.uid())
         or (booking_id is not null and public.is_booking_participant(booking_id)));

-- 3) One permissive policy per action: split the "for all" write policies so reads are checked once.
drop policy availability_write on public.availability_slots;
create policy availability_insert on public.availability_slots for insert to authenticated
  with check (public.can_configure_resource(resource_id));
create policy availability_update on public.availability_slots for update to authenticated
  using (public.can_configure_resource(resource_id)) with check (public.can_configure_resource(resource_id));
create policy availability_delete on public.availability_slots for delete to authenticated
  using (public.can_configure_resource(resource_id));

drop policy badges_write on public.badges;
create policy badges_insert on public.badges for insert to authenticated
  with check (public.can_configure_resource(resource_id));
create policy badges_update on public.badges for update to authenticated
  using (public.can_configure_resource(resource_id)) with check (public.can_configure_resource(resource_id));
create policy badges_delete on public.badges for delete to authenticated
  using (public.can_configure_resource(resource_id));

-- Quizzes: staff read (answers live in the table); owners/admins write.
drop policy quizzes_write on public.quizzes;
create policy quizzes_insert on public.quizzes for insert to authenticated
  with check (public.can_configure_resource(resource_id));
create policy quizzes_update on public.quizzes for update to authenticated
  using (public.can_configure_resource(resource_id)) with check (public.can_configure_resource(resource_id));
create policy quizzes_delete on public.quizzes for delete to authenticated
  using (public.can_configure_resource(resource_id));
