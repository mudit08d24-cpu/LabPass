# LabPass — Database API (Member A)

The reference for everything the database provides: tables, the functions B's code calls, who may call them, storage, timers and rules. Checked against the live `Lab_Pass` Supabase project (ref `ggkjmbaomjucvbqioxku`) on 29 Oct 2026. B's `API.md` describes the server actions that wrap these functions. Screens call B's actions, not the functions in this file.

---

## Team checklist: A's part (all done)

- [x] Schema live: 11 migrations, listed in "Migrations" below.
- [x] Auth: email and password; each new account gets a profile and 10 starting credits.
- [x] Storage: buckets `resource-photos`, `condition-photos`, `certificates`; condition photos are images only (migration 05).
- [x] Seeds: `seed-demo-setup.sql` (accounts' roles, departments, six resources, hours, badges, ready supervisor) and B's `seed-quiz-and-checklists.sql`.
- [x] Database timers: `labpass-jobs` (every minute) and `labpass-weekly-credits` (Monday 00:01 IST).
- [x] Server timer: `labpass-server-jobs` calls `https://lab-pass-rho.vercel.app/api/jobs` every 5 minutes; returning 200 with `ok: true` since 20:50 IST on 29 Oct.
- [x] `types.ts`: generated from the live project; the repo copy is `lib/supabase/types.ts`.
- [x] Keys handed to D privately.

---

## Ground rules

- **Every rule and state change happens in the database.** Booking checks, credits, waitlist, supervisors, incidents, quiz grading, graduation, notifications and the audit log all live in database functions. The app never changes these tables directly.
- **Row-level security is on for every table.** A normal read with the logged-in user's Supabase client only returns rows that user may see, so screens can read lists directly.
- **Errors are plain sentences.** Functions refuse with messages such as `A written reason is required` or `Only requested bookings can be decided`; show them as they are. A refused booking request returns `Booking blocked: …`, with the failed checks as reasons (see B's API.md).
- **Every decision is audited.** Each state change writes a row to `activity_log` with who did it, before and after, and the reason.
- **Times** are stored as `timestamptz`, and booking times as `tstzrange` `[start, end)`. Rules are worked out in IST (`Asia/Kolkata`).

---

## Roles

`profiles.roles` is a text array.

| Role | Can do |
|---|---|
| `student` | Book, check in and return, take quizzes, upload certificates, apply as a peer supervisor, report and dispute incidents |
| `manager` | Manage resources they are assigned to (`resources.manager_id`): decide bookings, confirm returns, review certificates and supervisors, decide incidents, see the QR code. A department owner (`departments.owner_id`) can also configure every resource in the department |
| `admin` | Everything, plus resolve disputes, confirm or dismiss no-show flags, lift blocks, adjust credits by hand |

A peer supervisor is a student with an approved row in `supervisor_approvals` for a resource.

---

## Tables

| Table | What it holds | Users may write directly? |
|---|---|---|
| `profiles` | One per account: name, email, roll no, roles, department, `credits_balance`, `status`, `blocked_until` | Own `name` and `roll_no` only |
| `departments` | Name and owner | No (admin, via SQL) |
| `resources` | Name, type (`space` / `equipment` / `specialised`), tier 0–3, location, `max_hours`, `weekly_cap_hours`, deposit, checklist, photos, status | Managers and owners of the department: insert and update |
| `availability_slots` | Opening hours per weekday (0 = Monday) | Resource managers and owners |
| `resource_checkin_codes` | The 8-character code behind each resource's QR | No; use `get_checkin_code` and `rotate_checkin_code` |
| `badges` | Per-resource badge: `quiz`, `certificate` or `graduation` | Resource managers and owners |
| `quizzes` | One per resource: questions (JSON) and pass mark | Resource managers and owners |
| `user_badges` | A student's badge, with status `pending` / `approved` / `rejected` / `suspended` | No; use the functions |
| `bookings` | Request, status, priority score and breakdown, credits charged, supervisor | No; use the functions |
| `waitlist_offers` | A freed slot offered to a waitlisted student, with `expires_at` | No |
| `condition_reports` | Check-in and return reports: checklist answers, photo paths, notes, co-signers | No; use `save_condition_report` |
| `supervisor_approvals` | Peer supervisor applications and decisions | No |
| `supervisor_slots` | Hours a supervisor publishes for a resource | The supervisor: their own slots |
| `incidents` | Report, photos, decision, penalty, response, dispute outcome, AI fields | No |
| `credits_ledger` | Every credit change, with a reason | No |
| `user_flags` | No-show or AI pattern flags waiting for an admin | No |
| `notifications` | In-app notifications; `emailed_at` is set once the email is sent | No; use `mark_notification_read` |
| `activity_log` | The audit trail | No |

**Realtime** is on for `notifications`, `bookings` and `waitlist_offers`, which drive the bell, live status and the offer countdown.

### Booking status

```
requested ─► approved ─► checked_in ─► returned ─► completed
    │            │             └─► overdue ─► returned
    │            ├─► cancelled
    │            └─► no_show
    ├─► rejected
    ├─► waitlisted ─► (offer accepted) ─► approved
    └─► cancelled
```

---

## Functions

Call with `supabase.rpc('name', { p_…: … })`. Argument names must match exactly; `lib/supabase/types.ts` has the full types. "Who" is checked inside each function, so calling as the wrong user gives `Not authorized`.

### Reading

| Function | Arguments | Returns | Who |
|---|---|---|---|
| `labpass_config` | none | JSON of every rule (see "Rules") | anyone logged in |
| `my_eligibility` | `p_resource` | what the user still needs for this resource (badges, tier) | the user |
| `resource_busy_times` | `p_resource, p_from, p_to` | busy `time_range`s (no names) | anyone logged in |
| `list_supervisor_availability` | `p_resource, p_from, p_to` | `slot_id, supervisor_id, supervisor_name, kind (staff/peer), time_range` | anyone logged in |
| `evaluate_booking` | `p_resource_id, p_start, p_end, p_supervisor_id?` | each check with `ok`, `blocking` and reason, plus priority score and breakdown; nothing saved | the student |
| `my_waitlist_rank` | `p_booking_id` | rank, size and score of a waitlisted booking | the student or the manager |
| `graduation_progress` | `p_resource, p_user?` | supervised sessions done against the 3 needed | the student or the manager |
| `get_quiz` | `p_resource` | questions without the answers | anyone logged in |
| `idle_radar` | `p_from, p_to` (dates) | per resource: available, booked and used hours, utilisation, no-show rate, waitlist length, bottleneck, hours unlocked | managers (their departments), admin |
| `idle_radar_hourly` | `p_resource, p_from, p_to` | booked hours by weekday and hour, for a heatmap | resource managers and owners, admin |
| `list_assignable_managers` | none | `id, name` | admin |

### Bookings and waitlist

| Function | Arguments | Returns | Who |
|---|---|---|---|
| `request_booking` | `p_resource_id, p_start, p_end, p_purpose, p_supervisor_id?` | booking id (status `requested` or `waitlisted`) | student |
| `manager_decide_booking` | `p_booking_id, p_decision` (`approved` / `rejected` / `waitlisted`), `p_reason?` | none. Approving charges credits and waitlists overlapping requests; a reason is required to reject or waitlist | the resource's manager |
| `set_deadline_verified` | `p_booking_id, p_verified, p_reason` | new score and breakdown (+15) | manager |
| `cancel_booking` | `p_booking_id, p_reason?` | `{ refunded_credits }`. Free more than 2 h before the start; always refunded when a manager cancels (reason required). Offers the slot to the waitlist | the student or the manager |
| `accept_waitlist_offer` | `p_offer_id` | none. The booking becomes `approved` and credits are charged | the student |
| `decline_waitlist_offer` | `p_offer_id` | none. The next student gets the offer | the student |

### Handover (check-in and return)

| Function | Arguments | Returns | Who |
|---|---|---|---|
| `get_checkin_code` | `p_resource` | the 8-character code, or `null` for students | manager, owner, admin |
| `rotate_checkin_code` | `p_resource` | the new code (old printed QR codes stop working) | manager, owner, admin |
| `save_condition_report` | `p_booking_id, p_stage` (`check_in` / `return`), `p_checklist`, `p_notes?`, `p_photo_paths` | report id. Saving again replaces the report and clears signatures | the student or the manager |
| `sign_condition_report` | `p_report_id` | none | the assigned supervisor only |
| `check_in_booking` | `p_booking_id, p_code` | none. Needs the check-in report with every checklist item, at least one photo and (if supervised) the supervisor's co-sign; the code must match the resource; open from 15 minutes before to 15 minutes after the start | the student |
| `return_booking` | `p_booking_id` | none. Needs the return report | the student |
| `confirm_return` | `p_booking_id, p_reason?` | `{ supervisor_reward }`. Booking becomes `completed`; a peer supervisor who co-signed both reports earns 1 credit per hour | manager |

### Badges, quiz, graduation

| Function | Arguments | Returns | Who |
|---|---|---|---|
| `submit_quiz` | `p_resource, p_answers` | score, passed, per-question result. A pass grants the Tier 1 badge | student |
| `submit_certificate` | `p_badge_id, p_file_path` | user-badge id (`pending`); the manager is notified | student (file uploaded first, see "Storage") |
| `decide_certificate` | `p_user_badge_id, p_decision` (`approved` / `rejected`), `p_reason?` | none; a reason is required to reject | manager |
| `graduate_student` | `p_user, p_resource, p_reason` | none. Tier 3 → Tier 2 after 3 supervised sessions | manager |

### Peer supervisors

| Function | Arguments | Returns | Who |
|---|---|---|---|
| `apply_as_supervisor` | `p_resource` | approval id. Needs an approved Tier 2 badge for the resource | student |
| `decide_supervisor` | `p_approval_id, p_decision` (`approved` / `rejected` / `suspended`), `p_reason?` | none; a reason is required to reject or suspend | manager |

Supervisors publish hours by inserting into `supervisor_slots` (`resource_id, supervisor_id, time_range`) for resources they are approved for, and remove them by deleting their own rows (managers can delete them too). `request_booking` checks that the chosen supervisor is approved, that their hours cover the slot, and that they are not already supervising at that time.

### Incidents

| Function | Arguments | Returns | Who |
|---|---|---|---|
| `open_incident` | `p_booking_id, p_type` (`damage` / `delay` / `missing_item` / `other`), `p_description, p_photo_paths?` | incident id | the student or the manager |
| `start_incident_review` | `p_incident_id` | none | manager |
| `decide_incident` | `p_incident_id, p_decision` (`no_action` / `warning` / `credit_penalty` / `temporary_block`), `p_reason, p_penalty_credits?, p_block_days?` | applied penalty | manager |
| `respond_to_incident` | `p_incident_id, p_response, p_dispute?` | none; `p_dispute = true` sends it to an admin | the student |
| `close_incident` | `p_incident_id, p_reason?` | none (decided, undisputed incidents) | manager |
| `resolve_incident_dispute` | `p_incident_id, p_outcome` (`upheld` / `overturned`), `p_reason` | none; overturning refunds credits and lifts the block | admin |

### Admin

| Function | Arguments | Returns | Who |
|---|---|---|---|
| `decide_user_flag` | `p_flag_id, p_confirm, p_reason, p_block_days?` | none. Only a confirmed flag blocks the user | admin |
| `lift_user_block` | `p_user, p_reason` | none | admin |
| `adjust_credits` | `p_user_id, p_change, p_reason, p_booking_id?` | none | admin |
| `set_resource_status` | `p_resource, p_status` (`active` / `inactive` / `maintenance`), `p_reason` | none. Only `active` resources can be checked in to; existing bookings are not cancelled automatically | manager, owner, admin |

### Notifications

| Function | Arguments | Who |
|---|---|---|
| `mark_notification_read` | `p_notification_id` | the owner of the notification |

### Server only (service-role key)

The browser can't call these; B's `/api/jobs` and D's AI code use them.

| Function | Used by |
|---|---|
| `condition_photos_due_for_purge`, `mark_condition_photos_purged` | photo clean-up in `/api/jobs` (photos older than 30 days) |
| `save_incident_ai`, `save_certificate_ai`, `log_ai_suggestion`, `record_ai_pattern_flag` | D's AI features; flags still need an admin decision |
| `run_scheduled_jobs`, `grant_weekly_credits` and the `mark_…` / `expire_…` / `queue_…` jobs | the database timers |

---

## Notifications

Rows are written by the database, never by the app. `type` is one of:

| Type | Sent to | When |
|---|---|---|
| `booking_request` | manager | a student requests a booking |
| `booking_status` | student (and supervisor) | any booking status change; `payload.status` gives the new status |
| `booking_returned`, `booking_overdue`, `booking_no_show` | manager | the booking reached that state |
| `waitlist_offer` | student | a slot was freed; 30 minutes to accept |
| `reminder` | student | 1 hour before the start |
| `supervision_assigned`, `supervision_cancelled` | peer supervisor | picked for, or dropped from, a booking |
| `certificate_review` | manager | a certificate was submitted |
| `certificate_approved`, `certificate_rejected` | student | the manager decided |
| `supervisor_application` | manager | a student applied |
| `supervisor_approved`, `supervisor_rejected`, `supervisor_suspended` | student | the manager decided |
| `graduated` | student | Tier 3 → Tier 2 |
| `incident_opened` | student and manager | an incident was reported |
| `incident_decision` | student | the manager decided |
| `incident_dispute_resolved` | student and manager | the admin decided |
| `account_restricted`, `account_unrestricted` | student | a flag was confirmed, or the block was lifted |

`payload` carries the ids and names a link needs (`booking_id`, `resource`, `start`, `reason`, …). Which types are emailed, and the page each one links to, is in B's API.md ("Notification links").

---

## Storage

All three buckets accept files up to 10 MB. The **first folder** in each path is checked by the database, so files must be stored at these paths:

| Bucket | Public? | Path | Types | Who can upload | Who can read |
|---|---|---|---|---|---|
| `resource-photos` | yes | `<resource_id>/<file>` | jpg, png, webp | that resource's managers and owners | everyone |
| `condition-photos` | no | `<booking_id>/<file>` | jpg, jpeg, png, webp (checked by extension too) | the booking's student, manager and supervisor | the same people, via signed URLs |
| `certificates` | no | `<user_id>/<file>` | jpg, png, webp, pdf | the student, into their own folder | the student, and the managers who review it, via signed URLs |

Save the **path** in the database (e.g. in `p_photo_paths`), never a URL. Condition photos are deleted 30 days after the booking ends.

---

## Rules (`labpass_config()`)

| Key | Value | Meaning |
|---|---|---|
| `max_active_bookings` | 2 | open bookings per student |
| `default_weekly_hours_per_resource` | 6 | weekly cap per resource (`resources.weekly_cap_hours`) |
| `credits_per_hour` / `credits_per_hour_specialised` | 1 / 2 | cost of a booking |
| `weekly_credit_budget` | 10 | weekly top-up level |
| `free_cancel_hours` | 2 | refunded if cancelled earlier than this |
| `checkin_grace_minutes` | 15 | check-in window either side of the start; after it, `no_show` |
| `waitlist_offer_minutes` | 30 | time to accept an offer |
| `reminder_minutes` | 60 | reminder before the start |
| `no_show_flag_count` / `no_show_window_days` / `no_show_block_days` | 3 / 30 / 7 | 3 no-shows in 30 days propose a 7-day block (an admin must confirm) |
| `priority_base`, `priority_deadline_bonus`, `priority_fresh_bonus`, `priority_fresh_days`, `priority_per_week_hour`, `priority_per_no_show` | 50, +15, +20, 14, −5, −25 | priority score parts |
| `graduation_sessions` | 3 | supervised sessions for Tier 3 → Tier 2 |
| `supervisor_reward_per_hour` | 1 | peer supervisor credits |
| `photo_retention_days` | 30 | condition-photo clean-up |
| `timezone` | Asia/Kolkata | |

Read these with `getRules()` in the app; never type the numbers into a screen.

---

## Timers (pg_cron)

| Job | Schedule | Does |
|---|---|---|
| `labpass-jobs` | every minute | marks overdue and no-show bookings (then offers freed slots and flags 3 no-shows in 30 days), expires offers, closes stale requests, queues 1-hour reminders |
| `labpass-weekly-credits` | Monday 00:01 IST | tops every student up to 10 credits |
| `labpass-server-jobs` | every 5 minutes | `POST https://lab-pass-rho.vercel.app/api/jobs` with header `x-cron-secret`: sends queued emails, deletes expired photos |

The app URL and secret are in Supabase Vault (`labpass_app_url`, `labpass_cron_secret`); `labpass_cron_secret` must equal Vercel's `CRON_SECRET`.

Check the server timer:

```sql
select status_code, created, left(content, 200) from net._http_response order by created desc limit 5;
```

200 with `"ok":true` and no `error` inside `results` means it works.

---

## Demo accounts

Password for all: `LabPassDemo2026`. All six emails land in the kulezteam@gmail.com inbox.

| Email | Name | Role |
|---|---|---|
| `kulezteam+priya@gmail.com` | Priya Sharma | student (CSE) |
| `kulezteam+arjun@gmail.com` | Arjun Mehta | student (CSE), second student for the waitlist |
| `kulezteam+supervisor@gmail.com` | Kavya Iyer | student (ECE), approved peer supervisor for the Laser cutter |
| `kulezteam+rao@gmail.com` | Mr Rao | manager of all six resources |
| `kulezteam+owner@gmail.com` | Dr Menon | manager, ECE department owner |
| `kulezteam+admin@gmail.com` | LabPass Admin | admin |

| Resource | Tier | Needs |
|---|---|---|
| Seminar room | 0 | nothing |
| Robotics lab, Oscilloscope, DSLR | 1 | the safety quiz (5 questions, pass mark 80) |
| 3D printer | 2 | a safety certificate approved by the manager |
| Laser cutter | 3 | a certificate, plus a supervisor (Kavya 10:00–17:00 or Mr Rao 09:00–13:00 IST) |

All six are open Monday to Saturday, 08:00–20:00 IST. Supervisor hours run for 14 days from 29 Oct; re-run `seed-demo-setup.sql` before the demo if that window has passed.

---

## Migrations

In `supabase/migrations/` (currently under `labpass-A-database/` in the repo):

| File | Adds |
|---|---|
| `20261028134224_labpass_01_tables` | tables, enums, indexes |
| `20261028134346_labpass_02_logic` | rules, priority, triggers, notifications, audit |
| `20261028135331_labpass_03_rpcs` | all the functions above |
| `20261028135500_labpass_04_security` | row-level security, grants, storage buckets and policies, Realtime |
| `20261028135920_labpass_05_condition_photo_extensions` | condition photos: images only |
| `20261028155729_labpass_06_performance` | indexes and policy speed-ups |
| `20261028155735_labpass_07_signup_credits` | 10 credits on sign-up |
| `20261028155741_labpass_08_scheduled_jobs` | the database timers |
| `20261029042650_labpass_09_app_jobs_trigger` | `pg_net` call to `/api/jobs` |
| `20261029120103_labpass_10_server_jobs_header` | sends the secret as `x-cron-secret` |
| `20261029120444_labpass_11_server_jobs_name` | names it `labpass-server-jobs`, every 5 minutes |

**Changing the database:** add a new migration file (never edit an old one), apply it to Supabase, then run `npm run gen:types` and commit the updated `lib/supabase/types.ts`. Tell B if a function's arguments or return value changed.
