# LabPass — Project Document

> LabPass lets departments of one university share idle labs, rooms and equipment with students from any department, using a skills passport, peer supervisors, an explainable fairness score, photo-backed handovers and an Idle Radar dashboard.

**Team:** kulez team · **Live link:** _TODO_ · **Repository:** https://github.com/mudit08d24-cpu/LabPass · **Demo video:** _TODO_

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

| AI feature | Output | Who decides |
| --- | --- | --- |
| Smart matching | Ranked resources with reasons | Student chooses |
| Certificate review | Extracted details + mismatch note | Manager approves the badge |
| Photo comparison | List of possible differences | Manager confirms damage |
| Incident summary | Neutral draft | Manager decides the outcome |
| Pattern flags | Flagged users with evidence | Admin confirms or dismisses |

## 9. Privacy, security and fairness
<!-- Owner: A (security, RLS) + B (fairness formula, allocation). Data collected, private buckets, photo retention, RLS, append-only audit log, priority score and its breakdown. -->

## 10. Testing instructions and demo credentials
<!-- Owner: D. Live link, 6 demo accounts + shared password, the 5-minute judge click path. -->

| Account | Role | Used for |
| --- | --- | --- |
|  |  |  |

## 11. Limitations
<!-- Owner: D. Honest list: e.g. AI photo comparison can miss small damage; identity trusted from email; credits and deposits simulated. -->

## 12. Future work
<!-- Owner: D. Multi-institution sharing, university SSO, smart locks, real payments/deposits, native apps, more languages. -->

## 13. Team, roles and contributions
<!-- Owner: D (check GitHub history to be accurate). -->

| Member | Name | Role | Contribution |
| --- | --- | --- | --- |
| A |  | Core backend |  |
| B |  | Workflow backend |  |
| C |  | Entire frontend |  |
| D |  | AI, DevOps and submission |  |

## 14. Disclosure: templates, libraries, AI tools, pre-existing code
<!-- Owner: D. Every library and template used; shadcn blocks used (from C); AI model name; AI coding assistants used; pre-existing code (none, if true). -->

- **Libraries:** Next.js, TypeScript, Tailwind CSS, shadcn/ui, react-hook-form, zod, Recharts, react-day-picker, Supabase (Postgres, Auth, Storage, Realtime), Resend, qrcode, html5-qrcode, Vercel AI SDK
- **Templates / UI blocks:** _TODO (C)_
- **AI model used in the product:** _TODO_
- **AI tools used to build it:** _TODO_
- **Pre-existing code:** _TODO_
