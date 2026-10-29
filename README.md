# LabPass

LabPass lets departments of one university share idle labs, rooms and equipment with students from any department. Students earn access through a skills passport, specialised equipment is unlocked by peer supervisors, contested slots go to whoever an explainable fairness score favours, and every handover is backed by photos.

- **Live app:** https://lab-pass-rho.vercel.app
- **Project document:** [docs/PROJECT.md](docs/PROJECT.md) (problem, features, architecture, AI, fairness, demo accounts)
- **API reference for the team:** [API.md](API.md)

## What it does

| For | LabPass gives them |
| --- | --- |
| Students | One list of every shareable resource, with "can I book this?" and the next step shown on each; safety quizzes, certificate upload, booking, waitlist, QR check-in and return with photos, notifications and email |
| Peer supervisors | Apply to supervise Tier 3 equipment, publish available hours, co-sign handovers, earn credits |
| Managers | Approve, reject or waitlist with reasons, see competing requests ranked by priority score, confirm returns, review certificates and incidents (with AI suggestions) |
| Department owners | List resources with tiers, limits, opening hours, checklists, photos and a printable QR |
| Admins | Idle Radar (utilisation, dead hours, bottlenecks), restriction flags, dispute resolution |

## Tech stack

| Layer | Choice |
| --- | --- |
| App | Next.js 16 (App Router, server actions), React 19, TypeScript |
| UI | Tailwind CSS 4, shadcn/ui, Radix UI, lucide-react |
| Database, auth, files | Supabase: Postgres (rules as database functions, row-level security, audit triggers), Auth (email + password), Storage, Realtime |
| Scheduled jobs | Supabase pg_cron (in-database jobs every minute) and pg_cron + pg_net calling `/api/jobs` every 5 minutes |
| AI | Google Gemini through the Vercel AI SDK (`ai`, `@ai-sdk/google`), structured output validated with zod |
| Email | Resend HTTP API, sending from the verified domain `labpass-team.xyz` |
| QR | `qrcode` (generate), `html5-qrcode` (scan) |
| Hosting | Vercel (auto-deploy from `main`, preview per pull request) |

## Run it locally

Requirements: Node.js 20 or later, and access to the team's Supabase project.

```bash
git clone https://github.com/mudit08d24-cpu/LabPass.git
cd LabPass
npm install
cp .env.example .env.local     # Windows: copy .env.example .env.local
# fill in .env.local (see below)
npm run dev                    # http://localhost:3000
```

`npm run build` checks types and builds for production.

### Environment variables

Set these in `.env.local` for local work and in Vercel → Settings → Environment Variables for the live site. Never commit `.env.local`.

| Variable | What it is |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key; server-only, used by background jobs and AI saves |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini API key from Google AI Studio |
| `GEMINI_MODEL` | Optional; Gemini model name (defaults to the one in `lib/ai.ts`) |
| `CRON_SECRET` | Long random string; must equal the Vault secret `labpass_cron_secret` that pg_cron sends |
| `RESEND_API_KEY` | Resend API key with sending access |
| `EMAIL_FROM` | Sender, e.g. `LabPass <noreply@labpass-team.xyz>` |
| `NEXT_PUBLIC_APP_URL` | The site's own address, used in email links |

### Database

The schema, rules and security live in `labpass-A-database/supabase/migrations/` (apply them in order). Demo data:

1. Create the demo accounts in Supabase → Authentication → Users (listed in `labpass-A-database/seed/seed-demo-setup.sql`).
2. Run `labpass-A-database/seed/seed-demo-setup.sql`.
3. Run `seed/seed-quiz-and-checklists.sql`.
4. Run `docs/sql/ai_outputs.sql` (audit table for AI outputs).

### Background jobs

`POST /api/jobs` (header `x-cron-secret`) sends queued notification emails, deletes condition photos 30 days after a booking closes, and raises usage-pattern flags. Supabase calls it every 5 minutes; it does nothing without the secret.

## Project structure

```
app/                    pages (app router), server actions for AI, /api/jobs, /auth/callback
components/             screens' shared components and UI kit
lib/actions/            server actions: bookings, badges, check-in, uploads, incidents, admin, …
lib/jobs/               background jobs: emails, photo purge, usage-pattern flags
lib/screens/            the screens' data layer (real backend, or demo data when NEXT_PUBLIC_USE_MOCKS=true)
lib/supabase/           Supabase clients and generated database types
labpass-A-database/     Supabase migrations and demo seed
seed/                   quizzes and handover checklists
docs/                   project document and extra SQL
```

## Team

Built in 48 hours by kulez team. Roles and contributions are in [docs/PROJECT.md](docs/PROJECT.md#13-team-roles-and-contributions).
