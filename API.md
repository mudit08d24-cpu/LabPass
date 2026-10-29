# LabPass — API

Every server function C's screens call, with its exact response shape. One entry per function, one-line usage note.
Rule: A, B and D never build screens; C never writes to the database directly.

All AI results include `label: "AI suggestion — needs review"` — show it under every AI output.
If `ok` is `false`, the AI failed: show the fallback text, never block the flow.

---

## A — Core backend (bookings, history)

<!-- A: add request_booking, approve, reject, waitlist, cancel, check_in, return, confirm_return, getBookingHistory -->

## B — Workflow backend (credits, supervisors, waitlist, incidents, notifications)

<!-- B: add priority_score, waitlist offers, supervisor functions, incident functions, notify, QR, uploads, quiz grading -->

## C — Frontend data needs

<!-- C: list any screen whose data shape is not covered above -->

---

## D — AI and Idle Radar

Files: `app/actions/ai-*.ts`, `app/actions/idle-radar.ts` · Model: Google Gemini via Vercel AI SDK · Status: planned

### matchResources(need: string)
Student types a need in free text → ranked resources. Screen: student browse page (FR-06). Any logged-in user.
```ts
{ ok: boolean, items: { resourceId: string, name: string, reason: string }[], label: string }
```
If `ok` is false, `items` holds simple keyword matches (reason = "Keyword match").

### reviewCertificate(userId: string, filePath: string, resourceName: string)
Reads an uploaded certificate (JPG/PNG in the private `certificates` bucket) → details + manager note. Screen: manager certificate review (FR-08). Manager/admin only.
```ts
{
  ok: boolean,
  extracted: { name: string | null, course: string | null, issuer: string | null, date: string | null, relevantToResource: boolean } | null,
  mismatches: string[],
  note: string,          // e.g. "Check: Name may not match profile; ..." or "No mismatches found."
  label: string
}
```

### compareConditionPhotos(bookingId: string)
Compares first check-in photo with first return photo. Screen: manager confirm-return / incident review (FR-20). Manager/admin only.
```ts
{
  ok: boolean,
  differences: { area: string, description: string, severity: "minor" | "possible_damage" }[],
  overall: string,
  label: string
}
```

### summariseIncident(incidentId: string)
Neutral draft from the booking timeline, condition reports and user notes. Also saved to `incidents.ai_summary`. Screen: manager incident review (FR-20). Manager/admin only.
```ts
{ ok: boolean, summary: string, openQuestions: string[], label: string }
```

### getIdleRadar(from: string, to: string)   // dates "YYYY-MM-DD"
Not AI — counts from bookings and A's `resource_utilisation_daily` view. Screen: admin/owner Idle Radar page (FR-25).
```ts
{
  from: string, to: string,
  hoursUnlocked: number,                 // hours of completed bookings co-signed by peer supervisors
  resources: {
    resourceId: string, name: string,
    utilisationPct: number,              // 0–100
    bookedHours: number, availableHours: number,
    peakHours: number[],                 // up to 3 hours of day, e.g. [14, 16]
    deadHours: number[],                 // 9–17 with zero bookings
    noShowRatePct: number,
    waitlistLength: number,
    bottleneck: boolean,                 // utilisation >= 80% and waitlist >= 2
    daily: { day: string, utilisationPct: number }[]   // for the chart
  }[]
}
```

### getSuspiciousPatterns()   (P2 — first to cut)
Rule-based: 3+ peak-hour bookings and 2+ no-shows in 30 days. Screen: admin pattern list (FR-26). Admin only.
```ts
{ flagId: string, userId: string, name: string, evidence: string[], status: "open" | "confirmed" | "dismissed" }[]
```

### decideFlag(flagId: string, decision: "confirmed" | "dismissed", reason: string)
```ts
{ ok: boolean }
```
