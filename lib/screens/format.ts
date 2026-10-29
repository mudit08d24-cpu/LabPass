// Converters from A's raw columns to the view types, shared by real.ts and mock.ts.

import type { ArtKind, Breakdown, CheckItem, ChecklistAnswer, ResourceType, Rules } from "./types";

/** tstzrange text → ISO start/end. e.g. ["2026-10-29 04:30:00+00","2026-10-29 05:30:00+00") */
export function parseRange(range: unknown): { start: string; end: string } {
  if (range && typeof range === "object" && "start" in (range as Record<string, unknown>)) {
    const r = range as { start: string; end: string };
    return { start: new Date(r.start).toISOString(), end: new Date(r.end).toISOString() };
  }
  const s = String(range ?? "");
  const inner = s.replace(/^[[(]/, "").replace(/[\])]$/, "");
  const [a, b] = inner.split(",").map((x) => x.trim().replace(/^"|"$/g, ""));
  return { start: pgTs(a), end: pgTs(b) };
}

function pgTs(v: string) {
  if (!v) return "";
  let t = v.replace(" ", "T");
  // "+00" / "+05:30" / "+0530" → "+00:00"
  t = t.replace(/([+-]\d{2})$/, "$1:00").replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? v : d.toISOString();
}

/** Line-art drawing for a resource without an uploaded photo. */
export function artFor(name: string, type: ResourceType): ArtKind {
  const n = name.toLowerCase();
  if (/laser/.test(n)) return "laser";
  if (/3d|print/.test(n)) return "printer";
  if (/scope|oscillo|signal/.test(n)) return "oscilloscope";
  if (/dslr|camera|photo/.test(n)) return "dslr";
  if (/robot/.test(n)) return "robotics";
  if (/seminar|room|hall/.test(n)) return "seminar";
  return type === "space" ? "seminar" : type === "specialised" ? "printer" : "oscilloscope";
}

/** resources.checklist is a JSON array; items may be strings or { item | label | text }. */
export function checklistItems(json: unknown): string[] {
  if (!Array.isArray(json)) return [];
  return json
    .map((x) => {
      if (typeof x === "string") return x;
      if (x && typeof x === "object") {
        const o = x as Record<string, unknown>;
        return String(o.item ?? o.label ?? o.text ?? o.name ?? "");
      }
      return "";
    })
    .filter(Boolean);
}

export function checklistAnswers(json: unknown): ChecklistAnswer[] {
  if (!Array.isArray(json)) return [];
  return json.map((x) => {
    const o = (x ?? {}) as Record<string, unknown>;
    return { item: String(o.item ?? ""), ok: Boolean(o.ok), note: o.note ? String(o.note) : undefined };
  });
}

export const CHECK_LABEL: Record<string, string> = {
  account: "Account",
  resource: "Resource",
  time: "Time",
  availability: "Open hours",
  eligibility: "Eligibility",
  supervisor: "Supervisor",
  conflict: "Slot",
  weekly_cap: "Weekly cap",
  active_limit: "Active bookings",
  credits: "Credits",
  open_incidents: "Open incidents",
};
const CHECK_ORDER = Object.keys(CHECK_LABEL);

/** bookings.checks / evaluate_booking().checks → ordered list. */
export function checksList(json: unknown): CheckItem[] {
  if (!json || typeof json !== "object" || Array.isArray(json)) return [];
  return Object.entries(json as Record<string, { ok?: unknown; blocking?: unknown; message?: unknown }>)
    .map(([key, v]) => ({ key, ok: Boolean(v?.ok), blocking: v?.blocking !== false, message: String(v?.message ?? "") }))
    .sort((a, b) => rank(a.key) - rank(b.key));
}

function rank(k: string) {
  const i = CHECK_ORDER.indexOf(k);
  return i < 0 ? 99 : i;
}

export function breakdownOf(json: unknown): Breakdown | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const o = json as Record<string, unknown>;
  if (!("base" in o)) return null;
  const n = (k: string) => Number(o[k] ?? 0);
  return {
    base: n("base"),
    fresh_resource: n("fresh_resource"),
    verified_deadline: n("verified_deadline"),
    hours_this_week: n("hours_this_week"),
    hours_penalty: n("hours_penalty"),
    no_shows_30d: n("no_shows_30d"),
    no_show_penalty: n("no_show_penalty"),
    total: n("total"),
  };
}

/** Rows for ScoreBreakdown, worded from the rules. */
export function breakdownRows(b: Breakdown, rules?: Pick<Rules, "priority_fresh_days" | "no_show_window_days"> | null) {
  const days = rules?.priority_fresh_days ?? 14;
  const window = rules?.no_show_window_days ?? 30;
  const rows = [{ label: "Base", points: b.base }];
  if (b.fresh_resource) rows.push({ label: `Hasn't used this resource in ${days} days`, points: b.fresh_resource });
  if (b.verified_deadline) rows.push({ label: "Faculty-verified deadline", points: b.verified_deadline });
  if (b.hours_penalty) rows.push({ label: `${trim(b.hours_this_week)} hours booked this week`, points: b.hours_penalty });
  if (b.no_show_penalty) rows.push({ label: `${b.no_shows_30d} no-show${b.no_shows_30d === 1 ? "" : "s"} in ${window} days`, points: b.no_show_penalty });
  return rows;
}

function trim(n: number) {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Activity log → readable timeline (FR-24)
// ---------------------------------------------------------------------------

export interface RawActivity {
  id: number | string;
  actor_id: string | null;
  entity: string;
  action: string;
  reason: string | null;
  before: unknown;
  after: unknown;
  created_at: string;
}

const STATUS_TEXT: Record<string, string> = {
  requested: "Request sent",
  approved: "Approved",
  rejected: "Rejected",
  waitlisted: "Waitlisted",
  cancelled: "Cancelled",
  checked_in: "Checked in",
  no_show: "Marked as a no-show (check-in window passed)",
  overdue: "Marked overdue (end time passed without a return)",
  returned: "Returned",
  completed: "Return confirmed; booking completed",
};

const ACTION_TEXT: Record<string, string> = {
  request: "Requested the booking",
  approve: "Approved the request",
  reject: "Rejected the request",
  waitlist: "Waitlisted the request",
  auto_waitlist: "Moved to the waitlist (an overlapping request was approved)",
  cancel: "Cancelled the booking",
  accept_offer: "Accepted the waitlist offer",
  decline_offer: "Declined the waitlist offer",
  waitlist_offer: "Offered the freed slot",
  deadline_verification: "Updated the faculty-verified deadline",
  save_check_in_report: "Saved the check-in checklist and photo",
  save_return_report: "Saved the return checklist and photo",
  cosign_check_in: "Co-signed the check-in report",
  cosign_return: "Co-signed the return report",
  check_in: "Checked in",
  return: "Returned the resource",
  confirm_return: "Confirmed the return",
  open_incident: "Reported an issue",
  start_review: "Started reviewing the issue",
  decide_incident: "Decided the issue",
  respond: "Responded to the issue",
  dispute: "Disputed the decision",
  close_incident: "Closed the issue",
  "resolve_dispute:upheld": "Admin upheld the decision",
  "resolve_dispute:overturned": "Admin overturned the decision",
};

/** One readable line per meaningful audit row; credit rows become "Credits −4" lines. */
export function describeActivity(rows: RawActivity[], nameOf: (id: string | null) => string) {
  const out: { id: string; at: string; actor: string; text: string; reason: string | null }[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const after = (r.after ?? {}) as Record<string, unknown>;
    const before = (r.before ?? {}) as Record<string, unknown>;
    let text: string | null = null;
    if (r.entity === "credits_ledger") {
      const ch = Number(after.change ?? 0);
      if (ch) text = `Credits ${ch > 0 ? "+" : "−"}${Math.abs(ch)} (${String(after.reason ?? "")})`;
    } else if (ACTION_TEXT[r.action]) {
      // the same action touches several rows in one transaction; show it once
      const k = `${r.action}|${r.created_at.slice(0, 19)}`;
      if (r.entity !== "bookings" && seen.has(k)) continue;
      if (r.entity === "bookings" && r.action === "approve" && after.status === "waitlisted") continue;
      seen.add(k);
      text = ACTION_TEXT[r.action];
      if (r.action === "decide_incident" && after.decision) text = `Decided the issue: ${String(after.decision).replace("_", " ")}`;
      if (r.action === "open_incident" && after.type) text = `Reported an issue: ${String(after.type).replace("_", " ")}`;
    } else if (r.action.startsWith("status:")) {
      text = STATUS_TEXT[r.action.slice(7)] ?? `Status: ${r.action.slice(7)}`;
    } else if (r.entity === "bookings" && r.action === "insert") {
      text = "Requested the booking";
    } else if (r.entity === "waitlist_offers" && r.action === "update" && after.status && after.status !== before.status) {
      text = after.status === "expired" ? "Waitlist offer expired" : null;
    }
    if (!text) continue;
    out.push({ id: String(r.id), at: r.created_at, actor: nameOf(r.actor_id), text, reason: r.reason });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rule wording used on several screens (numbers always come from getRules()).
// ---------------------------------------------------------------------------

/** Credits per hour for a resource type (A: specialised machines cost more). */
export function creditRate(rules: Pick<Rules, "credits_per_hour" | "credits_per_hour_specialised"> | null, type: ResourceType) {
  if (!rules) return null;
  return type === "specialised" ? rules.credits_per_hour_specialised : rules.credits_per_hour;
}

export const TIER_TEXT: Record<number, { name: string; need: string }> = {
  0: { name: "Tier 0", need: "any verified student can book" },
  1: { name: "Tier 1", need: "pass a short safety quiz first" },
  2: { name: "Tier 2", need: "a certificate checked by the lab manager, or graduate from supervised use" },
  3: { name: "Tier 3", need: "supervised use only, with a staff or peer supervisor" },
};

/** Next whole hour from now (ISO), used as the default booking start. */
export function nextHourIso() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

/** API.md: check-in opens checkin_grace_minutes before the start and closes the same after. */
export function checkInOpen(b: { status: string; start: string }, rules: Pick<Rules, "checkin_grace_minutes"> | null) {
  const g = (rules?.checkin_grace_minutes ?? 15) * 60_000;
  const s = new Date(b.start).getTime();
  return b.status === "approved" && Date.now() >= s - g && Date.now() <= s + g;
}

/** Open team question (roadmap): do students see deposit amounts? Staff always do.
 *  Default yes; set NEXT_PUBLIC_SHOW_DEPOSITS=false to hide them from students. Deposits are never charged (PRD: simulated). */
export const SHOW_DEPOSITS_TO_STUDENTS = process.env.NEXT_PUBLIC_SHOW_DEPOSITS !== "false";
