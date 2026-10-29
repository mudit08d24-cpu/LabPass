-- LabPass: table that stores every AI output for audit (PRD: "Store every AI output").
-- Who runs it: Member A (or D with A's OK) in Supabase -> SQL Editor -> New query -> Run.

create table if not exists public.ai_outputs (
  id uuid primary key default gen_random_uuid(),
  feature text not null,          -- 'smart_match', 'certificate', 'photo_diff', 'incident_summary', 'test'
  ref_id text,                    -- booking / incident / user id the output relates to
  output jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists ai_outputs_ref_idx on public.ai_outputs (feature, ref_id);

alter table public.ai_outputs enable row level security;
-- No policies on purpose: only the server (service_role key) can read or write.
-- Optional, later: let admins read it from the app
-- create policy "admins read ai outputs" on public.ai_outputs for select
--   using (exists (select 1 from public.profiles p where p.id = auth.uid() and 'admin' = any(p.roles)));
