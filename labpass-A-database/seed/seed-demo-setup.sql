-- =============================================================================
-- LabPass demo setup: roles, departments, the six resources, opening hours and a ready
-- peer supervisor. Run order:
--   1. Create the six accounts in Supabase Dashboard → Authentication → Users → Add user →
--      Create new user, with "Auto Confirm User" ticked (same password for all, for the judges):
--        kulezteam+priya@gmail.com       Priya, student (CSE)
--        kulezteam+arjun@gmail.com       Arjun, second student for the waitlist (CSE)
--        kulezteam+supervisor@gmail.com  peer supervisor for the laser cutter (ECE student)
--        kulezteam+rao@gmail.com         Mr Rao, lab manager
--        kulezteam+owner@gmail.com       ECE department owner
--        kulezteam+admin@gmail.com       platform admin
--   2. Run THIS file in the SQL editor.
--   3. Run seed-quiz-and-checklists.sql (checklists and Tier 1 quizzes).
-- Safe to re-run: existing rows are kept or updated, never duplicated.
-- =============================================================================

begin;

-- 0) All six accounts must exist (each gets a student profile with 10 credits on creation).
do $$
declare missing text;
begin
  select string_agg(e, ', ') into missing
  from unnest(array['kulezteam+priya@gmail.com','kulezteam+arjun@gmail.com','kulezteam+supervisor@gmail.com',
                    'kulezteam+rao@gmail.com','kulezteam+owner@gmail.com','kulezteam+admin@gmail.com']) e
  where not exists (select 1 from public.profiles p where lower(p.email) = e);
  if missing is not null then
    raise exception 'Create these accounts first (Dashboard → Authentication → Users → Add user, Auto Confirm): %', missing;
  end if;
end $$;

-- Small helper for this script only: profile id by email.
create temporary table demo_people on commit drop as
select lower(p.email) as email, p.id from public.profiles p
where lower(p.email) like 'kulezteam+%@gmail.com';

-- 1) Names and roles.
update public.profiles p set name = v.name, roles = v.roles, roll_no = v.roll_no
from (values
  ('kulezteam+priya@gmail.com',      'Priya Sharma',  array['student']::text[], 'CSE21001'),
  ('kulezteam+arjun@gmail.com',      'Arjun Mehta',   array['student']::text[], 'CSE21002'),
  ('kulezteam+supervisor@gmail.com', 'Kavya Iyer',    array['student']::text[], 'ECE20014'),
  ('kulezteam+rao@gmail.com',        'Mr Rao',        array['manager']::text[], null),
  ('kulezteam+owner@gmail.com',      'Dr Menon',      array['manager']::text[], null),
  ('kulezteam+admin@gmail.com',      'LabPass Admin', array['admin']::text[],   null)
) v(email, name, roles, roll_no)
where lower(p.email) = v.email;

-- 2) Departments: ECE is owned by the owner account; the others by the admin (demo only).
insert into public.departments (name, owner_id)
select v.name, (select id from demo_people where email = v.owner_email)
from (values
  ('Electronics and Communication (ECE)', 'kulezteam+owner@gmail.com'),
  ('Computer Science (CSE)',              'kulezteam+admin@gmail.com'),
  ('Design and Media',                    'kulezteam+admin@gmail.com')
) v(name, owner_email)
on conflict (name) do update set owner_id = excluded.owner_id;

update public.profiles p set department_id = d.id
from (values
  ('kulezteam+priya@gmail.com',      'Computer Science (CSE)'),
  ('kulezteam+arjun@gmail.com',      'Computer Science (CSE)'),
  ('kulezteam+supervisor@gmail.com', 'Electronics and Communication (ECE)'),
  ('kulezteam+rao@gmail.com',        'Electronics and Communication (ECE)'),
  ('kulezteam+owner@gmail.com',      'Electronics and Communication (ECE)')
) v(email, dept)
join public.departments d on d.name = v.dept
where lower(p.email) = v.email;

-- 3) The six resources (exact names the quiz seed expects). Mr Rao manages all of them.
insert into public.resources (department_id, manager_id, name, type, tier, location, max_hours, weekly_cap_hours, deposit_amount)
select d.id, (select id from demo_people where email = 'kulezteam+rao@gmail.com'),
       v.name, v.type::public.resource_type, v.tier, v.location, v.max_hours, 6, v.deposit
from (values
  ('Seminar room', 'space',       0, 'Computer Science (CSE)',              'CSE Block, Room 204',        3, 0),
  ('Robotics lab', 'space',       1, 'Electronics and Communication (ECE)', 'ECE Block, Lab 3',           3, 0),
  ('Oscilloscope', 'equipment',   1, 'Electronics and Communication (ECE)', 'ECE Block, Lab 1, Bench 4',  3, 1000),
  ('DSLR',         'equipment',   1, 'Design and Media',                    'Media Centre, Equipment desk', 4, 2000),
  ('3D printer',   'specialised', 2, 'Electronics and Communication (ECE)', 'ECE Block, Maker Space',     4, 500),
  ('Laser cutter', 'specialised', 3, 'Electronics and Communication (ECE)', 'ECE Block, Maker Space',     2, 1000)
) v(name, type, tier, dept, location, max_hours, deposit)
join public.departments d on d.name = v.dept
where not exists (select 1 from public.resources r where r.name = v.name);

-- 4) Opening hours: Monday to Saturday, 08:00–20:00 (IST), so the demo works on any day but Sunday.
insert into public.availability_slots (resource_id, weekday, start_time, end_time)
select r.id, wd, '08:00', '20:00'
from public.resources r, generate_series(0, 5) wd
where r.name in ('Seminar room','Robotics lab','Oscilloscope','DSLR','3D printer','Laser cutter')
on conflict do nothing;

-- 5) Badges: "Safety quiz" (Tier 1) for the three quiz resources, "Safety certificate" (Tier 2) for
--    the 3D printer and Laser cutter. (seed-quiz-and-checklists.sql adds the quizzes and checklists.)
insert into public.badges (resource_id, tier, kind, name, description)
select r.id, v.tier, v.kind::public.badge_kind, v.badge_name, v.description
  from public.resources r
  join (values
    ('Robotics lab', 1, 'quiz', 'Safety quiz — Robotics lab', 'Passed the 5-question safety quiz.'),
    ('Oscilloscope', 1, 'quiz', 'Safety quiz — Oscilloscope', 'Passed the 5-question safety quiz.'),
    ('DSLR', 1, 'quiz', 'Safety quiz — DSLR', 'Passed the 5-question safety quiz.'),
    ('3D printer', 2, 'certificate', 'Safety certificate — 3D printer', 'Upload a 3D printing safety or training certificate; the manager reviews it.'),
    ('Laser cutter', 2, 'certificate', 'Safety certificate — Laser cutter', 'Upload a laser safety certificate; the manager reviews it. Needed to become a peer supervisor.')
  ) as v(resource_name, tier, kind, badge_name, description) on v.resource_name = r.name
on conflict (resource_id, kind) do nothing;

-- Ready peer supervisor for the Laser cutter (Tier 3 bookings need one):
-- certificate badge approved by Mr Rao, supervisor application approved.

insert into public.user_badges (user_id, badge_id, status, reason, granted_by, granted_at, decided_at)
select (select id from demo_people where email = 'kulezteam+supervisor@gmail.com'), b.id, 'approved',
       'Demo: laser safety certificate checked', (select id from demo_people where email = 'kulezteam+rao@gmail.com'), now(), now()
from public.badges b join public.resources r on r.id = b.resource_id
where r.name = 'Laser cutter' and b.kind = 'certificate'
on conflict (user_id, badge_id) do nothing;

insert into public.supervisor_approvals (user_id, resource_id, status, approved_by, reason, decided_at)
select (select id from demo_people where email = 'kulezteam+supervisor@gmail.com'), r.id, 'approved',
       (select id from demo_people where email = 'kulezteam+rao@gmail.com'), 'Demo: approved peer supervisor', now()
from public.resources r where r.name = 'Laser cutter'
on conflict (user_id, resource_id) do nothing;

-- 6) Supervision hours for the next 14 days, in IST: Kavya 10:00–17:00, Mr Rao (staff) 09:00–13:00.
--    Re-run this file before the demo if it is more than 14 days after the first run.
insert into public.supervisor_slots (supervisor_id, resource_id, time_range)
select s.id, r.id,
       tstzrange(((days.d + sv.from_t) at time zone 'Asia/Kolkata'), ((days.d + sv.to_t) at time zone 'Asia/Kolkata'), '[)')
from public.resources r,
     (select (now() at time zone 'Asia/Kolkata')::date + i as d from generate_series(0, 13) i) days,
     (values ('kulezteam+supervisor@gmail.com', time '10:00', time '17:00'),
             ('kulezteam+rao@gmail.com',        time '09:00', time '13:00')) sv(email, from_t, to_t)
     join demo_people s on s.email = sv.email
where r.name = 'Laser cutter'
  and not exists (
    select 1 from public.supervisor_slots x
    where x.supervisor_id = s.id
      and x.time_range && tstzrange(((days.d + sv.from_t) at time zone 'Asia/Kolkata'), ((days.d + sv.to_t) at time zone 'Asia/Kolkata'), '[)'));

commit;

-- Result
select p.name, p.email, p.roles, d.name as department, p.credits_balance as credits
from public.profiles p left join public.departments d on d.id = p.department_id
where lower(p.email) like 'kulezteam+%@gmail.com' order by p.roles, p.name;
