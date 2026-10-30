# LabPass API

Agreed at the hour-4 sync (A and B), and checked against A's live database (`labpass-supabase`: 8 migrations on the `Lab_Pass` Supabase project). **C and D: start with the Team checklist below**, then use the rest of this file as the reference for every function.

## Who does what

- **A — database (final):** every rule and state change is a database function in `labpass_schema.sql`: booking checks, credits, waitlist, supervisors, incidents, quiz, graduation, notifications rows, scheduled jobs, Idle Radar data.
- **B — server code:**
  1. Server actions that screens call. Each one calls one of A's functions and returns a plain-language result.
  2. Sending notification emails (Resend).
  3. Deleting condition photos after 30 days.
  4. QR picture from a resource's check-in code.
  5. Uploads.

  All five are done: the code is in `lib/`, `app/api/jobs/` and `seed/`.
- **Folder layout:** the repo (`mudit08d24-cpu/LabPass`) has no `src/` folder: `app/`, `lib/` and `components/` sit at the top, and `@/` means the top folder. Imports look like `@/lib/actions/bookings`. A's generated types go at `lib/supabase/types.ts`.
- **Rules** (limits, credits, timings, priority weights) live only in the database, in `labpass_config()`. Code reads them with `getRules()` (`lib/rules.ts`). `lib/config.ts` holds only upload settings.
- **Scheduled jobs** run on **pg_cron** (see the end of this file).

### Member B's roadmap tasks: where each one is

At the hour-4 sync, A and B agreed that rules and state changes live in A's database, and B builds the server code around them. So some of B's roadmap tasks are done inside A's database, and B's actions call them.

| Hours | Roadmap task (Member B) | Status | Where |
|---|---|---|---|
| 0–4 | Agree functions and response shapes in `API.md` | Done | this file |
| 0–4 | Fairness formula, caps, timings, credit costs in one config | Done (in the database, as agreed) | A's `labpass_config()`; read with `getRules()` |
| 0–4 | 5-question safety quiz and resource checklists | Done | `seed/seed-quiz-and-checklists.sql` |
| 4–12 | QR code per resource + check-in code validation | Done | QR: B's `getResourceQr`, `rotateCheckinCode`, `checkIn`. Validation: A's `check_in_booking` |
| 4–12 | Photo and certificate upload helpers (type and size limits) | Done | B's `lib/actions/uploads.ts` |
| 4–12 | Quiz grading + Tier 1 badge | Done | A's `submit_quiz`; B's `getQuiz`, `submitQuiz` |
| 4–12 | Notification service: in-app rows + Realtime + email | Done | Rows: A's `_notify` and `bookings_notify` trigger. Bell: B's `useNotifications`. Email: B's `/api/jobs` |
| 12–24 | Credits: deduct on approval, refund on early cancellation, show balance | Done | Deduct: A's `manager_decide_booking` and `accept_waitlist_offer`. Refund: A's `cancel_booking` (free more than 2 h before the start; always when a manager cancels). Balance: B's `getCreditBalance` |
| 12–24 | Peer supervisor: apply, approve, suspend (reason required), publish hours | Done | A's `apply_as_supervisor`, `decide_supervisor`; B's `applyAsSupervisor`, `decideSupervisor`, `publishSupervisorHours`, `removeSupervisorHours`, `listMySupervisorHours` |
| 12–24 | Supervisor availability check, used by `request_booking` | Done | Inside A's `request_booking` (`supervisor` check: approved supervisor, published hours cover the slot, not already supervising then). Picker: B's `listSupervisorAvailability` |
| 12–24 | Co-sign check-in and return; supervisor credits on co-signed return | Done | A's `sign_condition_report` (assigned supervisor only) and `confirm_return` (1 credit per supervised hour when both reports are co-signed); B's `signConditionReport`, `confirmReturn` |
| 12–24 | Notify on approve, reject, waitlist and cancel | Done | A's `bookings_notify` trigger fires on every status change (student, plus the supervisor on approve and cancel). Approved, rejected and waitlisted are also emailed; cancelled is in-app only |
| 24–36 | Priority score with breakdown | Done | A's `_priority`; shown by `evaluateBooking`, `getMyWaitlistRank` |
| 24–36 | Waitlist ranking + auto-promotion with a 30-minute window | Done | A's `_offer_freed_slots`, `my_waitlist_rank`, `accept/decline_waitlist_offer`; B's actions |
| 24–36 | Scheduled jobs: reminder, no-show, overdue, offer expiry | Done | A's `run_scheduled_jobs`, already scheduled by A with pg_cron (migration 08) |
| 24–36 | Incidents: report, photos, response or dispute, decision with reason, maintenance | Done | A's incident functions; B's `lib/actions/incidents.ts`, `setResourceStatus` |
| 24–36 | No-show strikes; restriction only after admin confirms | Done | A's `_flag_no_show_patterns` proposes; B's `listPendingFlags`, `decideUserFlag` |
| 24–36 | Tier 3 → Tier 2 graduation counter + manager sign-off | Done | A's `graduation_progress`, `graduate_student`; B's actions |
| extra | Delete condition photos after 30 days (PRD privacy) | Done | B's `lib/jobs/purge-photos.ts` in `/api/jobs` |
| 36–44 | Test every workflow function with each role; check audit rows | **Waiting** for the repo and A's deployed database | test checklist in "Still open" |
| 36–44 | Help D run the full journey; fix backend bugs C reports first | **Later** | — |
| 44–48 | Write the fairness and allocation section of the project doc | Drafted | [LabPass — Fairness and Allocation](https://claude.ai/artifact/6NmAeVrcUW4v9WjNzzaFFE): D merges it into the project doc |

---

## Team checklist (read this first)

### A — database

- [ ] **Seed the quiz and checklists:** after the six demo resources exist, run `seed/seed-quiz-and-checklists.sql`. It matches resources by name, so they must be exactly: `Seminar room`, `Robotics lab`, `Oscilloscope`, `DSLR`, `3D printer`, `Laser cutter`.
- [x] **Storage fix (agreed):** done in migration 05: `condition-photos` only accepts .jpg, .jpeg, .png and .webp.
- [ ] **Demo accounts need real inboxes,** because emails now go to everyone. Use team members' real addresses, or Gmail "plus" addresses that all land in one inbox: `kulezteam+priya@gmail.com`, `kulezteam+rao@gmail.com`, `kulezteam+admin@gmail.com`, … Made-up addresses bounce and hurt the domain's reputation.
- [x] **Database jobs:** done in migration 08 (`labpass-jobs` every minute, `labpass-weekly-credits` Monday 00:01 IST).
- [ ] **Server jobs timer:** enable `pg_net`, store the shared secret, and add the one remaining schedule, `labpass-server-jobs`, which calls B's `/api/jobs`. The exact SQL is in "Scheduled jobs" at the end of this file. It needs D's live URL.
- [ ] **Hand D the Supabase keys privately:** project URL, anon key and service-role key. Never paste the service-role key in a group chat or the repo.
- [ ] **`types.ts`:** in this repo it goes at `lib/supabase/types.ts` (there's no `src/`). Change the `gen:types` script's output path to match, re-run it after every new migration and commit it.

### C — screens

- [ ] **Call B's functions only.** Every screen calls the functions in this file. Never write to Supabase or upload files directly from a component.
- [ ] **Results:** every function returns `{ ok: true, data }` or `{ ok: false, error }`. Show `error` to the user as it is; it's already a plain sentence.
- [ ] **Booking checklist:** `checks` is an object keyed by check name. `blocking: false` failures are warnings (the student can still request and be waitlisted); `blocking: true` failures stop the request. See "Bookings".
- [ ] **Priority breakdown** is an object, not a list. See "Waitlist and fairness".
- [ ] **Quiz:** send the chosen option's **text** as the answer, not its position. See "Quiz, certificates and graduation".
- [ ] **Check-in screen order:** upload photos → save the check-in report → check in. See "QR codes and check-in".
- [ ] **Build a `/check-in` page** that reads `?code=` from the address. That's where the printed QR sends a phone camera; pass the code to `checkIn(code)`.
- [ ] **Uploads:** save the returned `path`, not a link. Show resource photos with `resourcePhotoUrl(path)`, check-in/return/incident photos with `getConditionPhotoUrl(path)`, and certificates with `getCertificateUrl(path)`. Set `accept` on file inputs. See "Uploads".
- [ ] **Notification bell:** `getNotifications()` on the server, then `useNotifications(userId, initial)` in the bell. See "Notifications".
- [ ] **Notification links:** build these pages, or change the paths in one place (see "Notification links" below).
- [ ] **Rule numbers** ("2 active bookings", "30-minute window") come from `getRules()`, never typed into a screen.

### D — repo, deploy and email

- [ ] **Repo and deploy:** create the GitHub repo, the Next.js app and the Vercel project (auto-deploy from `main`). B's `lib/` and `app/api/jobs/` files go into the repo's top-level `lib/` and `app/` (the repo has no `src/`); `seed/` and this `API.md` go at the top. A's `supabase/` folder goes at the top and A's `types.ts` at `lib/supabase/types.ts`. Add the `package.json` scripts from A's `supabase/README.md`, with `lib/supabase/types.ts` changed to `lib/supabase/types.ts`.
- [ ] **Packages:** `npm install @supabase/ssr @supabase/supabase-js qrcode server-only` and `npm install -D @types/qrcode`.
- [ ] **Upload size:** in `next.config.ts`, add `serverActions: { bodySizeLimit: "11mb" }` inside the existing `experimental` block. The default is 1 MB, which would reject most photos; A's buckets allow up to 10 MB.
- [ ] **Login settings (from A's README):** in Supabase → Authentication, turn on Email with **Confirm email**, set the Site URL to the live Vercel URL, and add `https://<live-url>/auth/callback` and `http://localhost:3000/auth/callback` to Redirect URLs. The app needs an `/auth/callback` route (C or D) to finish the email confirmation.
- [ ] **Environment variables:** add every variable in "Setup for B's code" to Vercel.
- [ ] **Email domain:** follow "D: email domain" below. **Start this early**, because DNS checks can take a few hours.
- [ ] **Share the live URL** with A for the `labpass-server-jobs` schedule, and set it as `NEXT_PUBLIC_APP_URL`.
- [ ] **Test email:** after the domain is verified, run the test command in "D: email domain".

---

## Notification links

Every notification has a link to a page. These are the pages B's code links to. **C:** build pages at these paths, or change them in `LINKS` at the top of `lib/notifications/messages.ts`; every notification and email then uses the new paths.

| Link key in `LINKS` | Path | Opened from | Who sees it |
|---|---|---|---|
| `booking` | `/bookings/<booking_id>` | booking approved, rejected, waitlisted, cancelled, checked in, overdue, returned, completed, no-show; reminder; waitlist offer | student |
| `managerRequest` | `/manage/requests/<booking_id>` | new booking request; returned (confirm it); overdue; no-show | manager |
| `certificateReview` | `/manage/certificates/<user_badge_id>` | certificate to review | manager |
| `supervisorApplications` | `/manage/supervisors` | new peer supervisor application | manager |
| `supervising` | `/supervising` | you're supervising; supervision cancelled; supervisor application approved | peer supervisor |
| `passport` | `/passport` | certificate approved or rejected; graduated; supervisor rejected or suspended; booking restricted or restriction lifted | student |
| `incident` | `/incidents/<incident_id>` | incident reported; incident decision; dispute result | student and manager |
| `adminIncident` | `/admin/incidents/<incident_id>` | incident disputed | admin |
| `adminFlags` | `/admin/flags` | restriction to review; AI usage-pattern flag | admin |

Also needed: **`/check-in?code=<code>`**, the page the printed QR opens (see "QR codes and check-in").

**Which notifications are also emailed:** booking approved, rejected, waitlisted or overdue; waitlist offer; reminder; incident decision (the six in PRD FR-22). All other notifications appear only in the bell. This also keeps us inside Resend's free plan of 100 emails a day.

---

## D: email domain

So emails reach every user (not only the Resend account owner), Resend needs a domain we control.

1. **Get a domain.** A free `*.vercel.app` address won't work, because you can't add the records Resend needs. Options:
   - buy a cheap one (a `.xyz` or `.in` is usually a few hundred rupees for the first year) from Namecheap, Porkbun, Cloudflare or Vercel, or
   - check whether a team member's GitHub Student Developer Pack includes a free domain offer.
2. **Add it in Resend:** resend.com → Domains → Add domain. Use a **subdomain**, e.g. `updates.labpass.xyz`, which Resend recommends to keep the main domain's reputation separate.
3. **Add the DNS records Resend shows** at wherever the domain's DNS is managed. Always copy the values from the Resend dashboard:
   - `MX` record, name `send`, priority `10`
   - `TXT` record (SPF), name `send`
   - `TXT` record (DKIM), name `resend._domainkey`
   - Optional but recommended for landing in the inbox: `TXT` record, name `_dmarc`, value `v=DMARC1; p=none;`

   If the domain's DNS is managed in Vercel, Resend's **Auto Configure** button adds the records for you.
4. **Verify:** click **Verify DNS Records** in Resend. It can take minutes to a few hours. If it's still pending after 72 hours, check the records for copy-paste mistakes.
5. **API key:** Resend → API Keys → create one with sending access → Vercel variable `RESEND_API_KEY`.
6. **Sender:** set `EMAIL_FROM` to an address on the verified subdomain, e.g. `LabPass <notifications@updates.labpass.xyz>`. The address doesn't need a real inbox.
7. **Test** (after deploying):
   ```bash
   curl -X POST "https://<live-url>/api/jobs?test=kulezteam@gmail.com" -H "x-cron-secret: <CRON_SECRET>"
   ```
   The reply says `"ok": true` and the email arrives. If it lands in spam, mark it "Not spam" once and check the `_dmarc` record.

**Free plan limits:** 100 emails a day and 3,000 a month. Five full test runs with six demo users stay well inside this, because only the six email-worthy notification types are sent.

---

## Conventions

- **Import from the action files.** Every function below is a server action in `lib/actions/<file>.ts` (the file is named in each section heading). Screens import and call them, e.g. `import { requestBooking } from "@/lib/actions/bookings"`. Screens never write to Supabase or upload files directly.
- **Every action returns** `{ ok: true, data }` or `{ ok: false, error, reasons? }`.
  - `error` is always a sentence a user can read. Show it as it is.
  - `reasons` appears when A's database refuses a booking request, an approval or a waitlist offer: one entry per failed check, for a bullet list.
- **After a change, refresh the page data** (`router.refresh()` in the client component), so lists show the new status.
- **Times:** send and receive ISO strings (`"2026-10-29T08:30:00.000Z"`). Idle Radar dates are `"YYYY-MM-DD"`. Show times in `Asia/Kolkata`; `formatWhen()` in `lib/notifications/messages.ts` does this.
- **Shared types** for screens are in `lib/types/booking.ts` (checklist, priority, eligibility, waitlist). Table and enum types come from A's generated `types.ts`.
- **Errors, in detail** (`lib/actions/errors.ts`):
  - `Booking blocked: …`, `Cannot approve: …`, `Cannot accept: …` → a sentence plus `reasons`.
  - `Not authorized` → "You don't have permission to do this."
  - A's other messages ("A written reason is required", "Only requested bookings can be decided") are already plain, so they pass through.
  - Anything else → "Something went wrong. Please try again."
- **Reads that aren't listed here** (resource lists, a booking's details, the manager's request queue, the activity timeline) can be read directly with the Supabase client. A's row-level security only returns what the logged-in user may see.

---

## Resources and discovery (`lib/actions/resources.ts`)

| B action | Calls A's | Returns |
|---|---|---|
| `getMyEligibility(resourceId)` | `my_eligibility` | `{ status, resourceTier, yourTier }` · status: `eligible \| needs_quiz \| needs_certificate \| needs_supervisor`; or `{ status: "blocked", until, reason }` |
| `getMyEligibilities(resourceIds[])` | `my_eligibility` ×N | `{ [resourceId]: Eligibility \| null }` · one server round trip for a whole list (Browse) |
| `getBusyTimesMany(resourceIds[], from, to)` | `resource_busy_times` ×N | `{ [resourceId]: { start, end }[] \| null }` · one round trip for Browse → "Free right now" |
| `getBusyTimes(resourceId, from, to)` | `resource_busy_times` | `{ start, end }[]` — booked times, without names |
| `listSupervisorAvailability(resourceId, from, to)` | `list_supervisor_availability` | `{ slotId, supervisorId, supervisorName, kind, start, end }[]` · kind: `staff \| peer` |
| `setResourceStatus(resourceId, status, reason)` | `set_resource_status` | — · status: `active \| inactive \| maintenance`; reason required |
| `listAssignableManagers()` | `list_assignable_managers` | `{ id, name }[]` |

## Bookings (`lib/actions/bookings.ts`)

| B action | Calls A's | Returns |
|---|---|---|
| `evaluateBooking(resourceId, start, end, supervisorId?)` | `evaluate_booking` | booking checklist (below) |
| `requestBooking(resourceId, start, end, purpose, supervisorId?)` | `request_booking` | `{ bookingId }` · if refused: `error` + `reasons` |
| `decideBooking(bookingId, decision, reason?)` | `manager_decide_booking` | — · decision: `approved \| rejected \| waitlisted`; reason required to reject or waitlist. Approving charges credits and waitlists overlapping requests; if a check now fails: `error` + `reasons` |
| `setDeadlineVerified(bookingId, verified, reason)` | `set_deadline_verified` | `{ score, breakdown }` · manager; +15 priority on a pending or waitlisted request |
| `cancelBooking(bookingId, reason?)` | `cancel_booking` | `{ refundedCredits }` · students: free more than 2 hours before the start; managers: reason required, always refunded |

**Booking checklist** (`BookingEvaluation` in `lib/types/booking.ts`):
```json
{
  "ok": false, "cost": 2, "needs_supervisor": false, "supervisor_kind": null,
  "checks": {
    "credits":  { "ok": true,  "blocking": true,  "message": "Costs 2 credits; balance 10" },
    "conflict": { "ok": false, "blocking": false, "message": "The slot is taken; you can still request it and be waitlisted" }
  },
  "priority": { "score": 60, "breakdown": { } }
}
```
- `checks` is an **object keyed by check name**: `account`, `resource`, `time`, `availability`, `eligibility`, `supervisor`, `conflict`, `weekly_cap`, `active_limit`, `credits`, `open_incidents`.
- A failed check with `blocking: false` is a warning (the student can still request and be waitlisted). A failed check with `blocking: true` stops the request.

## Waitlist and fairness (`lib/actions/bookings.ts`)

| B action | Calls A's | Returns |
|---|---|---|
| `getMyWaitlistRank(bookingId)` | `my_waitlist_rank` | `{ rank, of, score, breakdown, liveOffer }` · `liveOffer`: `{ id, expiresAt }` or `null` |
| `acceptWaitlistOffer(offerId)` | `accept_waitlist_offer` | — · booking becomes `approved`, credits charged; if a check now fails: `error` + `reasons` |
| `declineWaitlistOffer(offerId)` | `decline_waitlist_offer` | — · request cancelled, next in rank gets the offer |

**Priority breakdown** (an object, not a list):
```json
{ "base": 50, "fresh_resource": 20, "verified_deadline": 0, "hours_this_week": 2,
  "hours_penalty": -10, "no_shows_30d": 0, "no_show_penalty": 0, "total": 60 }
```
`liveOffer.expiresAt` drives the 30-minute countdown.

## Check-in, return and condition reports (`lib/actions/bookings.ts`)

| B action | Calls A's | Returns |
|---|---|---|
| `saveConditionReport(bookingId, stage, checklist, photoPaths, notes?)` | `save_condition_report` | `{ reportId }` · stage: `check_in \| return` |
| `signConditionReport(reportId)` | `sign_condition_report` | — · only the booking's assigned supervisor can co-sign |
| `checkIn(scannedOrTyped, bookingId?)` | `check_in_booking` | `{ bookingId }` · in `lib/actions/checkin.ts`, see QR codes below |
| `returnBooking(bookingId)` | `return_booking` | — |
| `confirmReturn(bookingId, reason?)` | `confirm_return` | `{ supervisorReward }` · manager; a peer supervisor who co-signed both reports earns credits |

- **`checklist`:** one `{ item, ok, note? }` per item in the resource's checklist, in the same order (`ChecklistAnswer` in `lib/types/booking.ts`). A's database refuses check-in or return until every item has an entry.
- **`photoPaths`:** at least one, from `uploadEvidencePhoto(bookingId, …)`.
- **Saving again** replaces the report and clears earlier signatures, so a co-sign always covers the final version.
- **Order of a handover:**
  - Check-in: `uploadEvidencePhoto` → `saveConditionReport(…, "check_in", …)` → (supervised: supervisor calls `signConditionReport`) → `checkIn`
  - Return: `uploadEvidencePhoto` → `saveConditionReport(…, "return", …)` → (supervised: `signConditionReport`) → `returnBooking` → manager `confirmReturn`

## QR codes and check-in (`lib/actions/checkin.ts`)

| B action | Uses | Returns |
|---|---|---|
| `getResourceQr(resourceId)` | `get_checkin_code` + `qrcode` library | `{ resourceId, resourceName, code, link, qrDataUrl }` |
| `rotateCheckinCode(resourceId)` | `rotate_checkin_code` | same as above, with the new code; the old printed QR stops working |
| `checkIn(scannedOrTyped, bookingId?)` | `check_in_booking` | `{ bookingId }` |

- **Who sees the QR:** manager, owner or admin only. A's `get_checkin_code` returns nothing to students, so nobody can check in without being at the resource.
- **What the QR holds:** a link, `<APP_URL>/check-in?code=3FA09C1B`. The 8-character `code` is also printed under it for typing in.
- `qrDataUrl` is a PNG: use it as `<img src>` and as a download link for printing.
- **`checkIn`** accepts the scanned link, a bare code, or a typed code (`parseCheckinCode` in `lib/checkin-code.ts`, also usable in the scanner component).
  - With `bookingId`: checks in that booking.
  - Without it (the phone camera opened `/check-in?code=…`): finds the student's approved booking whose check-in window is open now. If there are several, it asks the student to open the booking they want.
- **Check-in window:** from 15 minutes before the start to 15 minutes after.

## Quiz, certificates and graduation (`lib/actions/badges.ts`)

| B action | Calls A's | Returns |
|---|---|---|
| `getQuiz(resourceId)` | `get_quiz` | `{ quizId, passMark, questions: { id, text, options }[] }` (no answers), or `null` if the resource has no quiz |
| `submitQuiz(resourceId, answers)` | `submit_quiz` | `{ correct, total, score, passed }` · passing awards the Tier 1 badge |
| `submitCertificate(badgeId, formData)` | upload + `submit_certificate` | `{ userBadgeId, path }` · in `lib/actions/uploads.ts` |
| `decideCertificate(userBadgeId, decision, reason?)` | `decide_certificate` | — · `approved \| rejected`; reason required to reject |
| `getGraduationProgress(resourceId, userId?)` | `graduation_progress` | `{ cleanSessions, required, graduated, readyForSignoff }` · `userId` only for managers |
| `graduateStudent(userId, resourceId, reason)` | `graduate_student` | — · manager sign-off, Tier 3 → Tier 2 |

- **Quiz answers:** send `{ "<question id>": "<the chosen option's text>" }`, e.g. `{ "q1": "Check its condition and complete the check-in checklist" }`. A's database compares the option text with the stored answer. `score` and `passMark` are percentages (80 = 4 of 5).
- **Quiz content:** one quiz per Tier 1 resource (oscilloscope, DSLR, robotics lab), seeded from `seed/seed-quiz-and-checklists.sql`.

## Peer supervisors (`lib/actions/supervisors.ts`)

| B action | Calls A's | Returns |
|---|---|---|
| `applyAsSupervisor(resourceId)` | `apply_as_supervisor` | `{ approvalId }` · Tier 2 students only; the manager is notified |
| `decideSupervisor(approvalId, decision, reason?)` | `decide_supervisor` | — · `approved \| rejected \| suspended`; reason required to reject or suspend |
| `publishSupervisorHours(resourceId, start, end)` | insert into `supervisor_slots` (A's rules allow it) | `{ slotId }` · approved supervisors only; hours can't overlap their other hours |
| `removeSupervisorHours(slotId)` | delete from `supervisor_slots` | — · refused if an approved supervised session falls inside |
| `listMySupervisorHours()` | `supervisor_slots` (own rows) | `{ slotId, resourceId, start, end }[]` |

## Incidents (`lib/actions/incidents.ts`)

| B action | Calls A's | Returns |
|---|---|---|
| `openIncident(bookingId, type, description, photoPaths?)` | `open_incident` | `{ incidentId }` · type: `damage \| delay \| missing_item \| other`; booking checked in, overdue, returned or completed |
| `startIncidentReview(incidentId)` | `start_incident_review` | — · manager |
| `decideIncident(incidentId, decision, reason, { penaltyCredits?, blockDays? })` | `decide_incident` | `{ penaltyCredits, blockUntil }` · decision: `no_action \| warning \| credit_penalty \| temporary_block`; `credit_penalty` needs `penaltyCredits`, `temporary_block` needs `blockDays` (1–30) |
| `respondToIncident(incidentId, response, dispute?)` | `respond_to_incident` | — · student; `dispute: true` (only after a decision) sends it to an admin |
| `closeIncident(incidentId, reason?)` | `close_incident` | — · manager, decided and undisputed only |
| `resolveIncidentDispute(incidentId, outcome, reason)` | `resolve_incident_dispute` | — · admin; `upheld \| overturned`; overturning refunds the penalty and lifts the block |

**AI on incidents** (D): the AI photo comparison and summary are saved by D's server code with A's `save_incident_ai`. They appear on the incident row as `ai_summary` and `ai_photo_diff`. Always label them "AI suggestion — needs review".

## Credits (`lib/actions/credits.ts`)

| B action | Uses | Returns |
|---|---|---|
| `getCreditBalance(limit = 30)` | `profiles.credits_balance` + `credits_ledger` (own rows) | `{ balance, history: { change, reason, bookingId, createdAt }[] }` |
| `adjustCredits(userId, change, reason, bookingId?)` | `adjust_credits` | — · admin only; `change` is a whole number, positive or negative |

## Admin and Idle Radar (`lib/actions/admin.ts`)

| B action | Calls A's | Returns |
|---|---|---|
| `listPendingFlags()` | `user_flags` (admin only) | `{ id, userId, userName, source, evidence, proposedBlockDays, createdAt }[]` · source: `no_show_rule \| ai_pattern` |
| `decideUserFlag(flagId, confirm, reason, blockDays?)` | `decide_user_flag` | — · confirm blocks booking (default: the proposed length) or dismiss |
| `scanUsagePatterns()` | `record_ai_pattern_flag` (admin only) | `{ scanned, flagged, skipped, errors }` · FR-26 rule-based scan, also runs every 5 min from `/api/jobs`; new flags have source `ai_pattern` and `evidence.signals: string[]` |
| `liftUserBlock(userId, reason)` | `lift_user_block` | — |
| `getIdleRadar(from, to)` | `idle_radar` | `{ resourceId, resourceName, departmentId, availableHours, bookedHours, usedHours, utilisation, noShowRate, waitlistLength, hoursUnlocked, bottleneck }[]` |
| `getIdleRadarHourly(resourceId, from, to)` | `idle_radar_hourly` | `{ weekday, hour, bookedHours }[]` · weekday Mon = 0 |

- **Idle Radar:** `from` and `to` are dates like `"2026-10-15"` and both days are included. Admins see every resource; owners see their departments.
- **Ratios:** `utilisation` and `noShowRate` are 0 to 1 (show as %), or `null` when there's nothing to measure.
- **`bottleneck`** is true when 3 or more students are waiting or the resource is 80% or more booked.
- **`hoursUnlocked`** is the number of hours used under peer supervision.

## Notifications (`lib/actions/notifications.ts`, `lib/notifications/`)

| B function | Uses | Returns |
|---|---|---|
| `getNotifications(limit = 30)` | `notifications` table (own rows only) | `{ items: { id, type, payload, readAt, createdAt, title, body, href }[], unread }` |
| `markNotificationRead(id)` | `mark_notification_read` | — |
| `markAllNotificationsRead()` | `mark_notification_read` for each unread | `{ marked }` |
| `useNotifications(userId, initial)` (client hook) | Supabase Realtime | `{ items, unread, markRead, markAllRead }` — updates live |
| `describeNotification(type, payload)` | — | `{ title, body, href }` |

- **A's database creates every notification row**: on booking changes, waitlist offers, reminders, certificates, supervisors, incidents and restrictions. There's no `notify()` to call.
- **Wording:** `describeNotification` turns each of A's 20 notification types into a title, a message and a link. The bell and the email use it, so they always say the same thing. Each notification's link is listed in "Notification links" near the top of this file.
- **Live bell:** load `getNotifications()` on the server, pass it to `useNotifications(userId, initial)` in the bell component. New notifications appear without a refresh.
- **Email:** B's `/api/jobs` route emails the six PRD notification types (`shouldEmail` in `messages.ts`, listed in "Notification links"). The rest are bell-only. Notifications older than 12 hours aren't emailed.

## Uploads (`lib/actions/uploads.ts`)

Files are sent as `FormData` with the field name `file`.

| B action | Rules | Returns |
|---|---|---|
| `uploadResourcePhoto(resourceId, formData)` | owner/admin · JPG/PNG/WebP · max 10 MB | `{ path, url }` |
| `uploadEvidencePhoto(bookingId, formData)` | check-in, return and incident photos · JPG/PNG/WebP only · max 10 MB · booking approved, checked in, overdue, returned or completed | `{ path }` |
| `submitCertificate(badgeId, formData)` | student · PDF/JPG/PNG/WebP · max 10 MB | `{ userBadgeId, path }` — uploads, then submits for manager review |
| `getConditionPhotoUrl(path)` | a check-in, return or incident photo path | `{ url }` (link valid 1 hour) |
| `getConditionPhotoUrls(paths)` | several photos at once (e.g. check-in and return side by side) | `{ path, url }[]` |
| `getCertificateUrl(path)` | a certificate path (`user_badges.evidence_url`) | `{ url }` (link valid 1 hour) |
| `resourcePhotoUrl(path)` (`lib/storage.ts`, works in client code) | a resource photo path | public link |

- **Buckets (A's migrations 04 and 05), all with a 10 MB limit.** Paths are stored without the bucket name:

  | Bucket | Access | Path | Holds |
  |---|---|---|---|
  | `resource-photos` | public | `<resource_id>/<file>` | listing photos |
  | `condition-photos` | private, images only | `<booking_id>/<file>` | check-in, return and incident photos |
  | `certificates` | private | `<user_id>/<file>` | certificates (PDF or image) |

- **A's tables store paths, not links.** Save `path` in `resources.photos`, and pass photo paths to `saveConditionReport` and `openIncident`. A's database refuses photo paths outside `<bookingId>/`.
- **Showing files:** resource photos with `resourcePhotoUrl(path)`. Condition photos and certificates are private, so use `getConditionPhotoUrl(path)` and `getCertificateUrl(path)`.
- **Evidence can't be replaced:** A's storage rules let users add booking photos and certificates but not overwrite or delete them.
- **File inputs:** `accept="image/jpeg,image/png,image/webp"` on photo inputs; add `application/pdf` only on the certificate input.

## Rules (`lib/rules.ts`)

| Function | Returns |
|---|---|
| `getRules()` (server only) | every value in `labpass_config()`, e.g. `max_active_bookings`, `weekly_credit_budget`, `waitlist_offer_minutes` |

Screens that show a rule ("2 of 2 active bookings", "30-minute window") read it from here, never from hard-coded numbers.

---

## Scheduled jobs (pg_cron — agreed)

| Job | Runs | What |
|---|---|---|
| `labpass-jobs` | every minute | `select public.run_scheduled_jobs()`: overdue, no-shows (then waitlist offers and no-show flags), offer expiry, stale requests, reminders. **Done by A** (migration 08) |
| `labpass-weekly-credits` | Monday 00:01 IST (Sunday 18:31 UTC) | `select public.grant_weekly_credits()`. **Done by A** (migration 08) |
| `labpass-server-jobs` | every 5 minutes | pg_net calls B's `/api/jobs` route with a secret header. **To add** (SQL below) |

**B's `/api/jobs` route** (Next.js, uses the service-role key, rejects calls without the secret):
1. Email new notifications of the six PRD types, then set `emailed_at` (done).
2. Delete condition photos 30 days after the booking closes (unless an incident is open): A's `condition_photos_due_for_purge()` lists them, B's job deletes the files through the Storage API, then calls `mark_condition_photos_purged(booking_id)` (done). Incident photos are kept.

**A's setup SQL for the remaining timer** (Supabase → SQL editor, after enabling the `pg_net` extension under Database → Extensions; `pg_cron` is already on):

```sql
-- 1. Store the shared secret (same value as CRON_SECRET in Vercel). Run once.
select vault.create_secret('<the CRON_SECRET value>', 'labpass_cron_secret');

-- 2. Server jobs: calls B's /api/jobs every 5 minutes. Replace <live-url> with D's Vercel URL.
select cron.schedule('labpass-server-jobs', '*/5 * * * *', $$
  select net.http_post(
    url     := 'https://<live-url>/api/jobs',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets
                                   where name = 'labpass_cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$$);
```

To check it's running: `select * from cron.job_run_details order by start_time desc limit 10;`

## Setup for B's code

**Packages:** `npm install @supabase/ssr @supabase/supabase-js qrcode server-only` and `npm install -D @types/qrcode`.

**Environment variables:**

| Name | Where | What |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel + `.env.local` | Supabase project URL (from A) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel + `.env.local` | Supabase anon key (from A) |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel only, never in the repo | used only by `/api/jobs` |
| `NEXT_PUBLIC_APP_URL` | Vercel | live URL, for QR links and email links |
| `RESEND_API_KEY` | Vercel | from resend.com |
| `EMAIL_FROM` | Vercel | an address on the domain verified in Resend, e.g. `LabPass <notifications@updates.labpass.xyz>` (see "D: email domain") |
| `CRON_SECRET` | Vercel + Supabase Vault | long random string; pg_cron sends it to `/api/jobs` |

**B's files (repo paths):**
`lib/config.ts`, `lib/rules.ts`, `lib/storage.ts`, `lib/ranges.ts`, `lib/checkin-code.ts`, `lib/email.ts`,
`lib/supabase/server.ts`, `lib/supabase/client.ts`, `lib/supabase/admin.ts` (A's `types.ts` sits next to them),
`lib/types/booking.ts`, `lib/actions/errors.ts`, `lib/actions/db.ts`,
`lib/actions/resources.ts`, `lib/actions/bookings.ts`, `lib/actions/checkin.ts`, `lib/actions/badges.ts`, `lib/actions/supervisors.ts`,
`lib/actions/incidents.ts`, `lib/actions/credits.ts`, `lib/actions/admin.ts`, `lib/actions/notifications.ts`, `lib/actions/uploads.ts`,
`lib/notifications/messages.ts`, `lib/notifications/use-notifications.ts`, `lib/jobs/send-emails.ts`, `lib/jobs/purge-photos.ts`,
`app/api/jobs/route.ts`, `seed/quiz-and-checklists.ts`, `seed/make-seed-sql.ts`, `seed/seed-quiz-and-checklists.sql`.

If the repo already has `lib/supabase/server.ts` or `client.ts` from setup, keep those and skip mine: B's code gets its client through `getDb()` in `lib/actions/db.ts`, so it works whether those files use A's `Database` types or not. A's `lib/supabase/types.ts` is A's file; B's files only import it.

## Still open

- B: test every action against the real Supabase project once A's schema is deployed and the repo exists. Log in as each demo role and check:
  - [ ] **Student:** request a booking; a blocked request lists its reasons; cancel more than 2 hours before → credits refunded.
  - [ ] **Manager:** approve → credits deducted, overlapping requests waitlisted, student's bell and email update; reject without a reason is refused.
  - [ ] **Waitlist:** cancel an approved booking → next student gets an offer with a 30-minute countdown; accept charges credits.
  - [ ] **Supervisor:** apply → manager approves → publish hours → student picks them for the laser cutter → co-sign check-in and return → manager confirms → supervisor earns credits.
  - [ ] **Handover:** check-in refused without photo or checklist; QR scan and typed code both work.
  - [ ] **Incident:** report with photo → manager decides a credit penalty with a reason → student disputes → admin overturns → credits refunded.
  - [ ] **Admin:** 3 no-shows create a flag; nothing is blocked until the admin confirms.
  - [ ] **Audit:** every step above adds a row to `activity_log`.
  - [ ] **Jobs:** `/api/jobs` returns `ok`, emails arrive, and old photos are deleted.
- C and D: work through the Team checklist at the top.

---

## D — AI functions (`app/actions/ai-*.ts`, wrapper `lib/ai.ts`)

Model: Google Gemini via the Vercel AI SDK (`GEMINI_MODEL`, default `gemini-3.7-flash`). Every AI result has `label: "AI suggestion — needs review"`, is stored in `ai_outputs`, and never changes a booking, badge or penalty by itself. If `ok` is `false`, show the note and let the person decide without AI; the flow must keep working.

| D action | Who can call | Returns | Screen |
|---|---|---|---|
| `matchResources(need)` | any logged-in user | `{ ok, items: { resourceId, name, reason }[], label }` · keyword matches when AI fails | student browse page (FR-06) |
| `reviewCertificate(userBadgeId)` | manager, admin | `{ ok, extracted: { name, course, issuer, date, relevantToResource } \| null, mismatches: string[], note, label }` · also saved to `user_badges.ai_extraction` | `/manage/certificates/<user_badge_id>` (FR-08) |
| `compareConditionPhotos(bookingId)` | manager, admin | planned (hours 24–36) | incident review (FR-20) |
| `summariseIncident(incidentId)` | manager, admin | planned (hours 24–36) | incident review (FR-20) |

- **Certificates** must be PDF, PNG, JPG or WEBP. Call `reviewCertificate` when the manager opens the review page; show `note` and `mismatches` next to the certificate, then the manager uses B's `decideCertificate`.
- **Idle Radar and usage-pattern flags** are A's database functions with B's actions (`getIdleRadar`, `listPendingFlags`, see "Admin and Idle Radar"). `ai_pattern` flags come from B's rule-based scan (`lib/jobs/pattern-flags.ts`): late cancellations, repeated overdue returns, one student holding most of a contested resource.
