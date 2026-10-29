-- =============================================================================
-- LabPass — Supabase schema (v2, aligned with "LabPass — PRD and Tech Stack")
-- Migration: applied by `supabase db push` (or paste into the SQL Editor of a NEW/EMPTY project).
--
-- 18 tables: the 16 from the PRD data model, plus
--   user_flags              — no-show restriction reviews and AI pattern flags (FR-26, restriction rule)
--   resource_checkin_codes  — private QR/check-in codes, unreadable by students (FR-03, FR-14)
--
-- Every business rule value lives in public.labpass_config(); config.ts can read it via RPC.
-- All writes that change state go through SECURITY DEFINER RPCs; tables are read-only to
-- clients except the catalog (owner) and supervisor hours (peer supervisor).
-- =============================================================================


create extension if not exists pgcrypto with schema extensions;
create extension if not exists btree_gist with schema extensions;

-- Internal helpers live in `private`, which the Data API does not expose.
create schema if not exists private;

-- -----------------------------------------------------------------------------
-- Enumerated states
-- -----------------------------------------------------------------------------
create type public.profile_status    as enum ('active','suspended');
create type public.resource_status   as enum ('active','inactive','maintenance');
create type public.resource_type     as enum ('space','equipment','specialised');
create type public.badge_kind        as enum ('quiz','certificate','graduation');
create type public.approval_status   as enum ('pending','approved','rejected','suspended');
create type public.booking_status    as enum ('requested','approved','rejected','waitlisted','cancelled',
                                              'checked_in','no_show','overdue','returned','completed');
create type public.supervisor_kind   as enum ('staff','peer');
create type public.offer_status      as enum ('offered','accepted','expired','declined');
create type public.report_stage      as enum ('check_in','return');
create type public.incident_type     as enum ('damage','delay','missing_item','other');
create type public.incident_status   as enum ('open','under_review','decided','disputed','closed');
create type public.incident_decision as enum ('no_action','warning','credit_penalty','temporary_block');
create type public.dispute_outcome   as enum ('upheld','overturned');
create type public.flag_source       as enum ('no_show_rule','ai_pattern');
create type public.flag_status       as enum ('pending','confirmed','dismissed');

-- -----------------------------------------------------------------------------
-- Business rules (PRD "Business rules"). Edit here; keep config.ts in sync by calling
-- rpc('labpass_config') from the app instead of duplicating numbers.
-- -----------------------------------------------------------------------------
create or replace function public.labpass_config()
returns jsonb language sql immutable set search_path = '' as $$
  select jsonb_build_object(
    'timezone',                        'Asia/Kolkata',
    'max_active_bookings',             2,
    'default_weekly_hours_per_resource', 6,
    'weekly_credit_budget',            10,
    'credits_per_hour',                1,
    'credits_per_hour_specialised',    2,
    'supervisor_reward_per_hour',      1,
    'free_cancel_hours',               2,
    'checkin_grace_minutes',           15,
    'reminder_minutes',                60,
    'waitlist_offer_minutes',          30,
    'graduation_sessions',             3,
    'no_show_flag_count',              3,
    'no_show_window_days',             30,
    'no_show_block_days',              7,
    'photo_retention_days',            30,
    'priority_base',                   50,
    'priority_fresh_bonus',            20,
    'priority_fresh_days',             14,
    'priority_deadline_bonus',         15,
    'priority_per_week_hour',          -5,
    'priority_per_no_show',            -25
  );
$$;

create or replace function private._cfg(k text)
returns text language sql immutable set search_path = '' as $$
  select public.labpass_config() ->> k;
$$;

-- -----------------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text not null default '' check (length(name) <= 160),
  email           text,
  roll_no         text unique check (roll_no is null or length(trim(roll_no)) between 1 and 80),
  department_id   uuid,
  -- Owners are derived from departments.owner_id; peer supervisors from supervisor_approvals.
  roles           text[] not null default array['student']::text[]
                    check (cardinality(roles) > 0 and roles <@ array['student','manager','admin']::text[]),
  credits_balance integer not null default 0 check (credits_balance >= 0),
  status          public.profile_status not null default 'active',
  blocked_until   timestamptz,
  block_reason    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.departments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (length(trim(name)) between 1 and 120),
  owner_id   uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);
alter table public.profiles
  add constraint profiles_department_id_fkey foreign key (department_id)
  references public.departments(id) on delete set null;

create table public.resources (
  id               uuid primary key default gen_random_uuid(),
  department_id    uuid not null references public.departments(id) on delete restrict,
  manager_id       uuid not null references public.profiles(id) on delete restrict,
  name             text not null check (length(trim(name)) between 1 and 160),
  type             public.resource_type not null,
  tier             smallint not null check (tier between 0 and 3),
  location         text,
  photos           text[] not null default '{}',              -- resource-photos paths: <resource_id>/<file>
  max_hours        numeric(6,2) not null check (max_hours > 0),
  weekly_cap_hours numeric(7,2) not null default 6 check (weekly_cap_hours > 0), -- per student, per resource, per week
  checklist        jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  deposit_amount   numeric(12,2) not null default 0 check (deposit_amount >= 0), -- simulated only
  status           public.resource_status not null default 'active',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Kept out of `resources` so students cannot read the code and "check in" remotely.
create table public.resource_checkin_codes (
  resource_id uuid primary key references public.resources(id) on delete cascade,
  code        text not null unique default upper(encode(extensions.gen_random_bytes(4), 'hex')),
  rotated_at  timestamptz not null default now()
);

create table public.availability_slots (
  id          uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  weekday     smallint not null check (weekday between 0 and 6), -- Mon=0 … Sun=6, institution time zone
  start_time  time not null,
  end_time    time not null,
  check (start_time < end_time),
  unique (resource_id, weekday, start_time, end_time)
);

create table public.badges (
  id          uuid primary key default gen_random_uuid(),
  resource_id uuid not null references public.resources(id) on delete cascade,
  tier        smallint not null check (tier between 1 and 2),
  kind        public.badge_kind not null,
  name        text not null check (length(trim(name)) between 1 and 120),
  description text,
  check ((kind = 'quiz' and tier = 1) or (kind in ('certificate','graduation') and tier = 2)),
  unique (resource_id, kind)
);

create table public.user_badges (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  badge_id      uuid not null references public.badges(id) on delete cascade,
  status        public.approval_status not null default 'pending',
  evidence_url  text,          -- certificates bucket path: <user_id>/<file>
  ai_extraction jsonb,         -- "AI suggestion — needs review"
  reason        text,
  submitted_at  timestamptz not null default now(),
  granted_by    uuid references public.profiles(id) on delete set null,
  granted_at    timestamptz,
  decided_at    timestamptz,
  unique (user_id, badge_id),
  check (status <> 'approved' or granted_at is not null),
  check (status not in ('rejected','suspended') or length(trim(coalesce(reason,''))) > 0)
);

-- Each question: {"id": "q1", "text": "...", "options": [...], "answer": <option>}.
-- Students never read this table; they get questions without answers from get_quiz().
create or replace function private._quiz_questions_valid(q jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(q) = 'array' and jsonb_array_length(q) > 0
     and not exists (select 1 from jsonb_array_elements(q) e
                     where jsonb_typeof(e) <> 'object' or not (e ? 'id') or not (e ? 'answer'));
$$;

create table public.quizzes (
  id          uuid primary key default gen_random_uuid(),
  resource_id uuid not null unique references public.resources(id) on delete cascade,
  questions   jsonb not null check (private._quiz_questions_valid(questions)),
  pass_mark   numeric(5,2) not null default 80 check (pass_mark between 0 and 100), -- 4/5 = 80
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.supervisor_approvals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  resource_id uuid not null references public.resources(id) on delete cascade,
  status      public.approval_status not null default 'pending',
  approved_by uuid references public.profiles(id) on delete set null,
  reason      text,
  decided_at  timestamptz,
  created_at  timestamptz not null default now(),
  unique (user_id, resource_id),
  check (status = 'pending' or decided_at is not null),
  check (status not in ('rejected','suspended') or length(trim(coalesce(reason,''))) > 0)
);

create table public.supervisor_slots (
  id            uuid primary key default gen_random_uuid(),
  supervisor_id uuid not null references public.profiles(id) on delete cascade,
  resource_id   uuid not null references public.resources(id) on delete cascade,
  time_range    tstzrange not null,
  check (not isempty(time_range) and lower_inc(time_range) and not upper_inc(time_range)
         and lower(time_range) is not null and upper(time_range) is not null),
  exclude using gist (supervisor_id with =, time_range with &&)
);

create table public.bookings (
  id                   uuid primary key default gen_random_uuid(),
  resource_id          uuid not null references public.resources(id) on delete restrict,
  user_id              uuid not null references public.profiles(id) on delete restrict,
  supervisor_id        uuid references public.profiles(id) on delete restrict,
  supervisor_kind      public.supervisor_kind,
  time_range           tstzrange not null,
  purpose              text not null check (length(trim(purpose)) between 1 and 2000),
  status               public.booking_status not null default 'requested',
  priority_score       numeric(10,3) not null default 0,
  score_breakdown      jsonb not null default '{}'::jsonb check (jsonb_typeof(score_breakdown) = 'object'),
  checks               jsonb not null default '{}'::jsonb check (jsonb_typeof(checks) = 'object'),
  deadline_verified    boolean not null default false,
  deadline_verified_by uuid references public.profiles(id) on delete set null,
  credits_charged      integer not null default 0 check (credits_charged >= 0),
  decided_by           uuid references public.profiles(id) on delete set null,
  reason               text,
  reminder_sent_at     timestamptz,
  photos_purged_at     timestamptz,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  check (not isempty(time_range) and lower_inc(time_range) and not upper_inc(time_range)
         and lower(time_range) is not null and upper(time_range) is not null),
  check ((supervisor_id is null) = (supervisor_kind is null)),
  check (supervisor_id is null or supervisor_id <> user_id),
  -- PRD data-integrity rule: no two active bookings of one resource overlap.
  constraint bookings_no_overlap exclude using gist (resource_id with =, time_range with &&)
    where (status in ('approved','checked_in','overdue')),
  -- A supervisor cannot be in two supervised sessions at once.
  constraint bookings_supervisor_no_overlap exclude using gist (supervisor_id with =, time_range with &&)
    where (supervisor_id is not null and status in ('approved','checked_in','overdue'))
);

create table public.waitlist_offers (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  offered_at timestamptz not null default now(),
  expires_at timestamptz not null,
  status     public.offer_status not null default 'offered',
  created_by uuid references public.profiles(id) on delete set null,
  check (expires_at > offered_at)
);
create unique index waitlist_one_live_offer_per_booking
  on public.waitlist_offers(booking_id) where status = 'offered';

create table public.condition_reports (
  id         uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  stage      public.report_stage not null,
  checklist  jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  photo_urls text[] not null default '{}',   -- condition-photos bucket paths: <booking_id>/<file>
  notes      text,
  signed_by  uuid[] not null default '{}',   -- reset whenever the content changes
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (booking_id, stage)
);

create table public.incidents (
  id                uuid primary key default gen_random_uuid(),
  booking_id        uuid not null references public.bookings(id) on delete restrict,
  type              public.incident_type not null,
  description       text not null check (length(trim(description)) between 1 and 5000),
  photo_urls        text[] not null default '{}',
  opened_by         uuid references public.profiles(id) on delete set null,
  ai_summary        text,    -- "AI suggestion — needs review"
  ai_photo_diff     jsonb,   -- "AI suggestion — needs review"
  decision          public.incident_decision,
  decided_by        uuid references public.profiles(id) on delete set null,
  reason            text,    -- manager's written reason for the decision
  penalty_credits   integer check (penalty_credits is null or penalty_credits >= 0),
  block_until       timestamptz,
  user_response     text,
  dispute_outcome   public.dispute_outcome,
  resolved_by       uuid references public.profiles(id) on delete set null,
  resolution_reason text,
  resolved_at       timestamptz,
  status            public.incident_status not null default 'open',
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (status in ('open','under_review') or decision is not null
         or (status = 'closed' and decision is null))
);

create table public.credits_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete restrict,
  change     integer not null check (change <> 0),
  reason     text not null check (length(trim(reason)) between 1 and 500),
  booking_id uuid references public.bookings(id) on delete restrict,
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null check (length(trim(type)) between 1 and 100),
  payload    jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  read_at    timestamptz,
  emailed_at timestamptz,   -- set by the server job that sends the Resend email
  created_at timestamptz not null default now()
);

-- Append-only: no foreign keys (nothing may cascade into it) and triggers block UPDATE/DELETE/TRUNCATE.
create table public.activity_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid,                 -- null = system job or trusted server process
  entity     text not null,
  entity_id  uuid not null,
  booking_id uuid,                 -- lets the booking timeline include reports, offers, incidents, credits
  action     text not null,
  reason     text,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);

create table public.user_flags (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  source              public.flag_source not null,
  evidence            jsonb not null default '{}'::jsonb check (jsonb_typeof(evidence) = 'object'),
  proposed_block_days integer check (proposed_block_days is null or proposed_block_days between 1 and 30),
  status              public.flag_status not null default 'pending',
  decided_by          uuid references public.profiles(id) on delete set null,
  reason              text,
  decided_at          timestamptz,
  created_at          timestamptz not null default now(),
  check (status = 'pending' or (decided_at is not null and length(trim(coalesce(reason,''))) > 0))
);
create unique index user_flags_one_pending
  on public.user_flags(user_id, source) where status = 'pending';

-- -----------------------------------------------------------------------------
-- Indexes
-- -----------------------------------------------------------------------------
create index resources_department_status_idx on public.resources(department_id, status);
create index resources_manager_idx           on public.resources(manager_id);
create index bookings_user_created_idx       on public.bookings(user_id, created_at desc);
create index bookings_resource_status_idx    on public.bookings(resource_id, status);
create index bookings_supervisor_idx         on public.bookings(supervisor_id) where supervisor_id is not null;
create index bookings_time_gist_idx          on public.bookings using gist(time_range);
create index supervisor_slots_resource_idx   on public.supervisor_slots(resource_id);
create index supervisor_approvals_user_idx   on public.supervisor_approvals(user_id, status);
create index user_badges_badge_idx           on public.user_badges(badge_id, status);
create index incidents_booking_idx           on public.incidents(booking_id, status);
create index notifications_user_unread_idx   on public.notifications(user_id, created_at desc) where read_at is null;
create index notifications_unemailed_idx     on public.notifications(created_at) where emailed_at is null;
create index activity_log_entity_idx         on public.activity_log(entity, entity_id, created_at desc);
create index activity_log_booking_idx        on public.activity_log(booking_id, created_at) where booking_id is not null;
create index credits_ledger_user_created_idx on public.credits_ledger(user_id, created_at desc);

