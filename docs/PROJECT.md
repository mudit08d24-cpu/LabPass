# LabPass — Project Document

> LabPass lets departments of one university share idle labs, rooms and equipment with students from any department, using a skills passport, peer supervisors, an explainable fairness score, photo-backed handovers and an Idle Radar dashboard.

**Team:** kulez team · **Live link:** https://lab-pass-rho.vercel.app · **Repository:** https://github.com/mudit08d24-cpu/LabPass · **Demo video:** _TODO_

---

## 1. Use case and problem
<!-- Owner: D. Two blockers: no trust layer, supervision bottleneck. Primary persona Priya, owner persona Mr Rao (see PRD). -->

## 2. Users and owners
<!-- Owner: D. The five roles (student, peer supervisor, owner, manager, admin): who they are, can do, cannot do. Table from PRD. -->

## 3. Evidence
<!-- Owner: D. 3–4 real sources: link + one sentence on what each shows. Only numbers you actually read on the page. -->

| Source | What it shows |
| --- | --- |
|  |  |
|  |  |
|  |  |

## 4. Solution overview
<!-- Owner: D. One paragraph + the key ideas: skills passport (tiers 0–3), peer supervisors, fairness score, photo-backed handovers, Idle Radar, audit log. -->

## 5. Workflow (the booking journey)
<!-- Owner: A. List → discover → qualify → request → approve → check in → return → incident → history. Booking states and transitions table; diagram. -->

## 6. Features
<!-- Owner: all. P0 / P1 / P2 features that actually work in the demo. Screenshots from C. -->

## 7. Tech stack and architecture
<!-- Owner: A. Stack table, architecture diagram, data model / schema diagram, data flow. -->

## 8. AI and external services
<!-- Owner: D. For each AI feature: what it does, model used, data sent, who decides. Every output labelled "AI suggestion — needs review", stored in ai_outputs, never changes a booking by itself; flows continue if AI fails. Also: Supabase, Vercel, Resend. -->

**Model:** Google Gemini (Flash family) through the Vercel AI SDK (`ai`, `@ai-sdk/google`). The model name is set by the `GEMINI_MODEL` environment variable, with a default in `lib/ai.ts`. Every call asks for structured output validated by a zod schema, times out after 20 seconds and retries once.

| AI feature | Where | Data sent to the model | Output | Who decides |
| --- | --- | --- | --- | --- |
| Smart matching | Student → Browse → "Suggest" | The student's typed need (max 500 characters) and the list of active resources (name, type, tier, location) | Up to 5 resources, each with a one-sentence reason | The student chooses; if the AI fails, a keyword match is shown instead |
| Certificate review | Manager → Certificates → a submission → "Read certificate with AI" | The uploaded certificate (PDF or image) and the resource name | Name, course, issuer, date, relevance; mismatch checks (name vs profile, future date, unreadable fields) are plain code | The manager approves or rejects the badge |
| Photo comparison | Manager → Incidents → an incident → "Summarise and compare photos with AI" | Up to 2 check-in, 2 return and 2 incident photos | List of visible differences between check-in and return | The manager confirms whether there was damage |
| Incident summary | Same button as photo comparison | The incident report, its type, and the condition-report notes and checklist | A neutral 2–4 sentence summary; told never to assign blame or suggest a penalty | The manager decides the outcome, with a reason |
| Usage-pattern flags | Admin → Flags (every 5 minutes, or "Scan usage patterns now") | No model call: rule-based counts over the last 30 days | Flag with evidence: late cancellations, repeated overdue returns, one student holding most of a contested resource | The admin confirms (with a block length) or dismisses, with a reason |

**Guardrails, the same for every feature**

- Every output is labelled "AI suggestion — needs review" on screen.
- Every output is stored for audit: in `ai_outputs`, and with its record (`user_badges.ai_extraction`, `incidents.ai_summary` / `ai_photo_diff`, `user_flags.evidence`), saved through the database's own functions (`save_incident_ai`, `record_ai_pattern_flag`), which also write the audit log.
- AI never changes a booking, badge, credit balance or penalty by itself.
- If the AI is slow or down, every flow still works; the screen says the suggestion is unavailable.
- Only signed-in users can run smart matching; only managers and admins can run certificate and incident AI; only admins can run the pattern scan.

**Other external services**

| Service | Used for |
| --- | --- |
| Supabase | Postgres database with rules as functions, row-level security and audit triggers; Auth; Storage for photos and certificates; Realtime for live lists and notifications; pg_cron and pg_net for scheduled jobs |
| Vercel | Hosting, auto-deploy from `main`, a preview per pull request |
| Resend | Notification and sign-up emails, from the verified domain `labpass-team.xyz` |
| Google AI Studio | Gemini API key |

## 9. Privacy, security and fairness
<!-- Owner: A (security, RLS) + B (fairness formula, allocation). -->

### Privacy and security

- **Data collected:** name, roll number, department, email and badges. Nothing else about a student is stored.
- **Files:** resource photos are public. Condition photos (check-in, return, incident) and certificates are in private Storage buckets, shown only through short-lived signed links to people involved in that booking or review. Uploads are limited to 10 MB and to image or PDF types.
- **Photo retention:** condition photos are deleted automatically 30 days after a booking closes, unless an incident on it is still open. Incident photos are kept as evidence.
- **Row-level security:** every table has policies, so each query only returns what that person's role may see. Students can't read check-in codes; those live in a table with no read access, so nobody can check in remotely.
- **Rules run in the database:** booking checks, priority score, credits, waitlist offers and penalties are database functions, so no screen or direct request can get around them. The service-role key is used only on the server, for background jobs and saving AI outputs.
- **Append-only audit log:** every state change writes a row (who, what, reason, before and after, when). No role can edit or delete it.

### Fairness and allocation

LabPass gives scarce lab time to students by published rules, not by who asks first or who knows the lab staff. Every rule lives in one place in the database (`labpass_config()`), every decision shows its reasons, and no penalty is ever applied without a named person deciding it.

High-demand equipment such as the laser cutter or the 3D printer has far fewer free hours than students who want them. Opening labs to every department makes this worse: without rules, the fastest or best-connected students take every slot. LabPass answers three questions the same way for everyone:

- **Can I use this?** Eligibility tiers, earned through a safety quiz, a certificate or supervised practice.
- **How much can I take?** Hard limits on active bookings, weekly hours and weekly credits.
- **Who gets a contested slot?** A priority score that favours students who haven't had a turn and have a real deadline, shown to the student and the manager.

#### Who can book what

Access depends on proven skill with that resource, never on department, year or who you know. Each resource has a tier, and each student earns a tier per resource; their badges form their skills passport.

| Tier | How a student gets it | Demo resources |
| --- | --- | --- |
| 0 | Any verified student | Seminar room |
| 1 | Pass the 5-question safety quiz for that resource (4 of 5, graded in the database) | Oscilloscope, DSLR, Robotics lab |
| 2 | Certificate approved by the manager, or graduation from Tier 3 | 3D printer |
| 3 | Supervised use only, with a staff or peer supervisor present | Laser cutter |

Every listing tells the student where they stand (eligible, needs quiz, needs certificate, needs supervisor, or blocked) and names the next step.

#### Limits that stop one person taking everything

The database checks each limit on every request and again at approval.

| Limit | Value | Why |
| --- | --- | --- |
| Active bookings | 2 at a time (requested, approved, checked in or overdue) | No one can hold a queue of future slots |
| Hours per resource per week | 6 (set per resource; Monday to Sunday) | Popular equipment rotates between students |
| Hours per booking | Set per resource by its owner | Long sessions don't block a whole day |
| Weekly credits | 10, sponsored by the institution | A soft budget across all resources |

**Credits:** a booking costs 1 credit per hour, or 2 per hour for specialised equipment, rounded up. Credits are charged when a manager approves, so a rejected or waitlisted request costs nothing. Cancelling more than 2 hours before the start refunds them; a manager's cancellation is always refunded. Every Monday each student is topped up to 10; credits earned above 10 by supervising are kept. Every charge, refund and top-up is a row in the credits ledger.

#### The priority score for contested slots

When several students want the same slot, the highest priority score is offered it first. Ties go to the earlier request.

```
Priority = 50
         + 20  if no booking of this resource in the last 14 days
         + 15  if a manager has confirmed a faculty deadline
         −  5  per hour already booked this week (any resource)
         − 25  per no-show in the last 30 days
```

| Part | Points | Why it's there |
| --- | --- | --- |
| Base | +50 | Everyone starts equal |
| Fresh to this resource | +20 if no booking of it in 14 days | Students who haven't had a turn get the next one |
| Verified deadline | +15 | Real coursework deadlines come before nice-to-have work |
| Hours this week | −5 per hour | Spreads time across students |
| No-shows | −25 per no-show in 30 days | Wasted slots cost the people who would have used them |

**Worked example**, two requests for the same laser-cutter slot:

| | Priya | Arjun |
| --- | --- | --- |
| Base | 50 | 50 |
| Fresh to this resource | +20 (never used it) | 0 (used it last week) |
| Verified deadline | +15 (project due Friday) | 0 |
| Hours this week | −10 (2 hours) | −20 (4 hours) |
| No-shows, 30 days | 0 | −25 (1) |
| **Score** | **75** | **5** |

Priya is offered the slot first; Arjun is waitlisted and sees exactly why. The score is worked out when the request is made and stored with it, so it can't drift while the manager decides. The only later change is a manager confirming or removing a verified deadline, which re-scores the request and is recorded with a reason.

#### The waitlist

A freed slot is offered to one waitlisted student at a time, in score order, so the fastest clicker doesn't win.

- **Joining:** a student can request a taken slot; when a manager approves an overlapping request, the others move to the waitlist with that reason.
- **Offers:** when an approved booking is cancelled or becomes a no-show, the top-ranked waitlisted student gets an offer, a notification and an email. They have 30 minutes to accept, or until the start time if sooner.
- **Accepting** re-runs every check and charges the credits then; if something has changed, they're told why.
- **Declining** cancels their request; **not answering** lets the offer expire. Either way the next student in rank is offered the slot.

#### Peer supervision creates more usable hours

Specialised equipment stays locked whenever staff aren't free to supervise, so trained students can supervise each other:

1. A student with Tier 2 on a resource applies to supervise it; the manager approves, rejects or later suspends them, with a reason.
2. The approved supervisor publishes the hours they're available; a Tier 3 student can only book inside those hours.
3. The database blocks conflicts: a supervisor can't supervise their own booking or two sessions at once.
4. The supervisor co-signs the check-in and return condition reports.
5. When the manager confirms the return and both reports are co-signed, the supervisor earns 1 credit per supervised hour, kept on top of the weekly 10.
6. After 3 clean supervised sessions, the manager can graduate the student to Tier 2 for that resource, with a reason.

Idle Radar reports the result as **hours unlocked**: hours used under peer supervision that would otherwise have stayed locked.

#### No automatic punishment

The system only proposes a penalty; a named manager or admin decides it, with a written reason, and the student can respond.

| Situation | What the system does | Who decides | Limits |
| --- | --- | --- | --- |
| No check-in within 15 minutes of the start | Marks a no-show and offers the slot to the waitlist | Automatic (a fact, not a penalty) | Credits for that slot aren't refunded |
| 3 no-shows in 30 days | Opens a flag for admins with a proposed 7-day block | Admin confirms or dismisses, with a reason | Block of 1 to 30 days |
| Damage, delay or missing item | Opens an incident with photos; AI may draft a summary and compare photos | Manager: no action, warning, credit penalty or temporary block, with a reason | Penalty capped at the student's balance; block of 1 to 30 days |
| Student disagrees with a decision | Sends the dispute to admins | Admin upholds or overturns, with a reason | Overturning refunds the penalty and lifts the block |
| Unusual booking pattern | Opens a usage-pattern flag for admins only | Admin confirms or dismisses | Labelled "AI suggestion — needs review" |

A student with an open incident can't make new requests until it's resolved, and the reason is shown on their booking check.

#### Every decision can be explained

- **Before requesting,** the student sees every check (eligibility, supervisor, conflict, weekly hours, active bookings, credits, open incidents) with a plain sentence for each, plus the price and their priority score.
- **Reasons are required** for every rejection, waitlisting, manager cancellation, supervisor rejection or suspension, incident decision and restriction.
- **On the waitlist,** the student sees their rank, how many are waiting and the score breakdown; the manager sees competing requests side by side with their scores.
- **The booking timeline** (from the audit log) is visible to both the student and the manager.

## 10. Testing instructions and demo credentials

**Live link:** https://lab-pass-rho.vercel.app/login · **Password for every demo account:** `[LabPass@2026]`

| Account | Name | Role | Used for |
| --- | --- | --- | --- |
| `kulezteam+priya@gmail.com` | Priya Sharma | Student (CSE) | Main student: browse, quiz, certificate, booking, check-in and return |
| `kulezteam+arjun@gmail.com` | Arjun Mehta | Student (CSE) | Second student: conflicts, waitlist and offers |
| `kulezteam+supervisor@gmail.com` | Kavya Iyer | Student, approved peer supervisor (Laser cutter) | Publish hours, co-sign Tier 3 sessions |
| `kulezteam+rao@gmail.com` | Mr Rao | Lab manager | Approve requests, conflicts, returns, certificates, incidents |
| `kulezteam+owner@gmail.com` | Dr Menon | Manager, owner of the ECE department | List and edit resources, print QR codes |
| `kulezteam+admin@gmail.com` | LabPass Admin | Admin (owns CSE and Design and Media) | Idle Radar, restriction flags, disputes |

Each account opens on its own home page: students on Browse, the manager on Requests, the owner on Our resources, the admin on Idle Radar.

**5-minute click path for judges**

1. **Priya** → Browse: type "measure a signal" and click **Suggest** (AI smart matching). Open the Oscilloscope; it says a quiz is needed.
2. **Priya** → take the Oscilloscope quiz (4 of 5 to pass) → Passport shows the new badge.
3. **Priya** → 3D printer → upload a certificate. **Mr Rao** → Certificates → the submission → **Read certificate with AI**, then approve. Priya gets a notification and an email.
4. **Priya** and **Arjun** each request the same oscilloscope slot. **Mr Rao** → Conflicts: both requests side by side with their priority breakdown. Approve one; the other is waitlisted with a reason.
5. **Mr Rao** → Returns → Priya's returned Seminar-room booking → **Report an issue** (damage, with a photo) → on the incident, **Summarise and compare photos with AI** → decide with a reason. Priya can dispute; **Admin** → Disputes resolves it.
6. **Admin** → Idle Radar (utilisation, dead hours, bottlenecks) → Flags → **Scan usage patterns now**.
7. **Dr Menon** → Our resources → a resource → **QR** to see the check-in code.

Opening hours for the demo resources are Monday to Saturday, 08:00–20:00 IST. A booking must start in the future, and check-in works from 15 minutes before to 15 minutes after its start.

## 11. Limitations

- **AI can be wrong.** Photo comparison can miss small damage or flag lighting changes; certificate reading can misread names or dates. That's why every AI output is only a suggestion and a person decides.
- **Usage-pattern flags are simple counts** (late cancellations, overdue returns, one student holding most of a contested resource). They can miss other kinds of misuse, and the thresholds haven't been tuned on real usage.
- **Identity is trusted from email.** There's no university single sign-on; anyone with an email address can create a student account.
- **Credits and deposits are simulated.** No real money is charged or held.
- **Deadline verification** is entered by a manager on the student's behalf; there's no direct faculty sign-off.
- **"Hours this week" counts every resource,** so a student who used the seminar room ranks a little lower for the laser cutter. A per-department or per-type count may be fairer after a pilot.
- **The priority score is fixed when a request is made** (apart from deadline changes), so no-shows that happen afterwards don't lower a waiting request.
- **The weights and limits are starting points;** they should be tuned with real usage from Idle Radar.
- **One university only;** departments share within one institution.
- **Check-in relies on a QR code or typed code at the resource;** it can't prove the student is physically there.

## 12. Future work
<!-- Owner: D. Multi-institution sharing, university SSO, smart locks, real payments/deposits, native apps, more languages. -->

## 13. Team, roles and contributions
<!-- Owner: D (check GitHub history to be accurate). -->

| Member | Name | Role | Contribution |
| --- | --- | --- | --- |
| A |  | Core backend |  |
| B | Garv Yadav | Workflow backend | Server actions that connect every screen to the database rules (bookings, waitlist, badges and quizzes, supervisors, incidents, credits, admin and Idle Radar), with plain-language errors; photo and certificate uploads with private signed links; QR check-in codes; in-app notifications and email through Resend, including the sending domain; background jobs (`/api/jobs`: emails, 30-day photo deletion, usage-pattern flags) run by pg_cron; quizzes and handover checklists; the fairness and allocation design; wiring the AI features into the screens and building the incident summary and photo comparison; `API.md` for the team; live deployment setup and end-to-end checks. |
| C |  | Entire frontend |  |
| D |  | AI, DevOps and submission |  |

## 14. Disclosure: templates, libraries, AI tools, pre-existing code
<!-- Owner: D. Every library and template used; shadcn blocks used (from C); AI model name; AI coding assistants used; pre-existing code (none, if true). -->

- **Libraries** (from `package.json`): Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Radix UI, lucide-react, class-variance-authority, clsx, tailwind-merge, tw-animate-css, zod, `@supabase/supabase-js`, `@supabase/ssr`, Vercel AI SDK (`ai`, `@ai-sdk/google`), `qrcode`, `html5-qrcode`, `server-only`
- **Services:** Supabase (Postgres, Auth, Storage, Realtime, pg_cron, pg_net, Vault), Vercel, Resend (HTTP API, no SDK), Google AI Studio (Gemini API)
- **Project starter:** `create-next-app`
- **Templates / UI blocks:** _TODO (C)_
- **AI model used in the product:** Google Gemini, Flash family (set by `GEMINI_MODEL`; see section 8)
- **AI tools used to build it:** Claude (Anthropic), used by Member B for backend code, the AI wiring, documentation and setup; _TODO: others' tools_
- **Pre-existing code:** _TODO_
