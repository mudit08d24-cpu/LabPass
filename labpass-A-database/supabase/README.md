# LabPass — Supabase setup

**Status:** the schema is live on the `Lab_Pass` project (ref `ggkjmbaomjucvbqioxku`). The eleven files in
`migrations/` match the project's migration history exactly, so `supabase db push` reports it as up to date.

| Migration | Contents |
| --- | --- |
| `20261028134224_labpass_01_tables` | Extensions, enums, `labpass_config()`, 18 tables, indexes |
| `20261028134346_labpass_02_logic` | Internal helpers (`private` schema), policy helpers, audit and notification triggers |
| `20261028135331_labpass_03_rpcs` | App RPCs: booking, waitlist, handover, quiz, certificate, graduation, supervision, incidents, admin |
| `20261028135500_labpass_04_security` | Jobs, AI hooks, Row-Level Security, grants, storage buckets and policies, Realtime |
| `20261028135920_labpass_05_condition_photo_extensions` | `condition-photos` uploads must end in .jpg, .jpeg, .png or .webp |
| `20261028155729_labpass_06_performance` | Foreign-key indexes, faster RLS policies (no behaviour change) |
| `20261028155735_labpass_07_signup_credits` | New accounts start with the 10-credit weekly budget (via the ledger) |
| `20261028155741_labpass_08_scheduled_jobs` | `pg_cron`: `run_scheduled_jobs()` every minute; weekly credit top-up Monday 00:01 IST |
| `20261029042650_labpass_09_app_jobs_trigger` | `pg_net`: calls the app's `/api/jobs` (emails, photo purge) once the app URL is in Vault |
| `20261029120103_labpass_10_server_jobs_header` | The timer sends the secret in `x-cron-secret` (B's route) and `Authorization: Bearer` |
| `20261029120444_labpass_11_server_jobs_name` | Renames that timer to `labpass-server-jobs`, every 5 minutes, as in `API.md` |

A brand-new project (staging, or a teammate's local stack) gets the same database with `supabase db push`
or `supabase start`.

## Still to do in the Dashboard

1. **Authentication → Sign In / Providers → Email:** enabled, with **Confirm email** on.
2. **Authentication → URL Configuration:** Site URL = your production Vercel URL; add
   `https://<your-app>.vercel.app/auth/callback` and `http://localhost:3000/auth/callback` to Redirect URLs.
   (Or run `npx supabase config push` after linking — it applies the `[auth]` block in `config.toml`.)

## CLI setup for the team

```bash
npm i -D supabase
npx supabase login
npx supabase link --project-ref ggkjmbaomjucvbqioxku
npx supabase migration list      # local and remote should match
```

## Regenerating types

`src/lib/supabase/types.ts` was generated from the live project. After every new migration run
`npm run gen:types` (needs `npx supabase login` once) and commit the result. Range columns
(`time_range`) come through as `unknown`; they are strings like
`["2026-10-29 10:00:00+05:30","2026-10-29 11:00:00+05:30")`.

## Environment variables (Vercel and `.env.local`)

| Variable | Where |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API (publishable / anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API — server only, never `NEXT_PUBLIC_` |

B's code also needs `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, `EMAIL_FROM` and `CRON_SECRET`; see "Setup for B's code" in `API.md`.

## Scheduled jobs

Running in `pg_cron` (Database → Cron in the Dashboard shows run history):

| Job | Schedule | Does |
| --- | --- | --- |
| `labpass-jobs` | every minute | overdue, no-shows (then offers freed slots and flags 3 no-shows in 30 days), offer expiry, closes stale requests, 1-hour reminders |
| `labpass-weekly-credits` | Sun 18:31 UTC = Mon 00:01 IST | tops every active student up to 10 credits |
| `labpass-server-jobs` | every 5 minutes | calls the app's `/api/jobs` (sends queued emails, purges expired photos); does nothing until `labpass_app_url` is set |

The app URL and the shared secret are stored in Supabase Vault, not in the repo. `labpass_cron_secret` is
already set (it must equal `CRON_SECRET` in Vercel). After the first deploy, run once in the SQL editor:

```sql
select vault.create_secret('https://<your-app>.vercel.app', 'labpass_app_url');
```

To change it later: `select vault.update_secret((select id from vault.secrets where name = 'labpass_app_url'), 'https://new-url');`

## Storage paths

| Bucket | Access | Path |
| --- | --- | --- |
| `resource-photos` | public | `<resource_id>/<file>` |
| `condition-photos` | private | `<booking_id>/<file>.jpg/.jpeg/.png/.webp` (check-in, return and incident photos) |
| `certificates` | private | `<user_id>/<file>` |

Store paths without the bucket name. For private buckets, show files with `createSignedUrl`.

## Using the types

```ts
import { createClient } from "@supabase/supabase-js"
import type { Database, Tables } from "@/lib/supabase/types"

const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
const { data: id, error } = await supabase.rpc("request_booking", {
  p_resource_id, p_start, p_end, p_purpose: "Project work",
})
type Booking = Tables<"bookings">
```
