import "server-only";

// Suspicious usage patterns (FR-26, P2) — Member B. Repo path: lib/jobs/pattern-flags.ts
// Called by app/api/jobs/route.ts (pg_cron, every 5 minutes) and by the admin's "Scan now" button
// (scanUsagePatterns in lib/actions/admin.ts).
//
// Rule-based, as D's roadmap says: plain counting over the last WINDOW_DAYS of bookings, no model call,
// so it's predictable and explainable. Each flag goes through A's record_ai_pattern_flag, which labels it
// "AI suggestion — needs review", audits it and notifies admins. Nothing is blocked automatically:
// the admin confirms or dismisses on /admin/flags (decideUserFlag).
//
// These thresholds only decide when to ASK an admin; they never restrict anyone, so they live here
// rather than in labpass_config() (which holds the rules that block bookings).

import { createAdminClient } from "@/lib/supabase/admin";
import { parseRange } from "@/lib/ranges";

const WINDOW_DAYS = 30;
const LATE_CANCEL_HOURS = 2; //      a cancellation less than this before the start counts as late
const LATE_CANCEL_COUNT = 3; //      flag at this many late cancellations
const OVERDUE_COUNT = 2; //          flag at this many overdue returns
const HOG_SHARE = 0.5; //            flag if one student holds at least this share of a resource's booked hours…
const HOG_MIN_HOURS = 6; //          …and at least this many hours…
const HOG_MIN_OTHER_USERS = 2; //    …while at least this many other students also wanted it
const RECHECK_DAYS = 14; //          don't re-flag someone an admin already decided on within this many days

type Row = { id: string; user_id: string; resource_id: string; status: string; time_range: string; updated_at: string };
type Signals = { lateCancels: number; overdue: number; hogged: { resource: string; hours: number; share: number }[] };

export type PatternJobReport = { scanned: number; flagged: number; skipped: number; errors: string[] };

export async function flagUsagePatterns(): Promise<PatternJobReport> {
  const db = createAdminClient();
  const report: PatternJobReport = { scanned: 0, flagged: 0, skipped: 0, errors: [] };
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);

  // Bookings created in the window (time_range is a range type, so filter on created_at and check starts below).
  const { data: rows, error } = await db
    .from("bookings")
    .select("id, user_id, resource_id, status, time_range, updated_at")
    .gte("created_at", new Date(since.getTime() - 30 * 86_400_000).toISOString())
    .limit(5000);
  if (error) throw new Error(`Could not read bookings: ${error.message}`);

  const bookings = ((rows ?? []) as Row[])
    .map((b) => ({ ...b, range: parseRange(b.time_range) }))
    .filter((b) => b.range && b.range.start >= since);
  report.scanned = bookings.length;

  const signals = new Map<string, Signals>();
  const sig = (u: string) => {
    let s = signals.get(u);
    if (!s) signals.set(u, (s = { lateCancels: 0, overdue: 0, hogged: [] }));
    return s;
  };

  // 1. Late cancellations: cancelled less than LATE_CANCEL_HOURS before the start.
  for (const b of bookings) {
    if (b.status !== "cancelled") continue;
    const hoursBefore = (b.range!.start.getTime() - new Date(b.updated_at).getTime()) / 3_600_000;
    if (hoursBefore < LATE_CANCEL_HOURS) sig(b.user_id).lateCancels++;
  }

  // 2. Overdue returns: any booking that was ever marked overdue (the audit log keeps the history,
  //    because an overdue booking later becomes returned/completed).
  const ids = bookings.map((b) => b.id);
  const owner = new Map(bookings.map((b) => [b.id, b.user_id]));
  const overdueIds = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data: log, error: logErr } = await db
      .from("activity_log")
      .select("entity_id")
      .eq("entity", "bookings")
      .eq("after->>status", "overdue")
      .in("entity_id", ids.slice(i, i + 200));
    if (logErr) report.errors.push(`overdue history: ${logErr.message}`);
    for (const l of (log ?? []) as { entity_id: string }[]) overdueIds.add(l.entity_id);
  }
  for (const id of overdueIds) {
    const u = owner.get(id);
    if (u) sig(u).overdue++;
  }

  // 3. Hogging: one student holds most of a contested resource's booked hours.
  const USED = new Set(["approved", "checked_in", "overdue", "returned", "completed", "no_show"]);
  const WANTED = new Set([...USED, "requested", "waitlisted", "rejected"]);
  const byResource = new Map<string, { hours: Map<string, number>; wanted: Set<string>; total: number }>();
  for (const b of bookings) {
    if (!WANTED.has(b.status)) continue;
    let r = byResource.get(b.resource_id);
    if (!r) byResource.set(b.resource_id, (r = { hours: new Map(), wanted: new Set(), total: 0 }));
    r.wanted.add(b.user_id);
    if (USED.has(b.status)) {
      const h = (b.range!.end.getTime() - b.range!.start.getTime()) / 3_600_000;
      r.total += h;
      r.hours.set(b.user_id, (r.hours.get(b.user_id) ?? 0) + h);
    }
  }
  const resourceIds = Array.from(byResource.keys());
  const { data: res } = resourceIds.length ? await db.from("resources").select("id, name").in("id", resourceIds) : { data: [] };
  const resName = new Map(((res ?? []) as { id: string; name: string }[]).map((r) => [r.id, r.name]));
  for (const [rid, r] of byResource) {
    for (const [u, h] of r.hours) {
      const share = r.total ? h / r.total : 0;
      if (share >= HOG_SHARE && h >= HOG_MIN_HOURS && r.wanted.size - 1 >= HOG_MIN_OTHER_USERS) {
        sig(u).hogged.push({ resource: resName.get(rid) ?? "a resource", hours: Math.round(h * 10) / 10, share: Math.round(share * 100) });
      }
    }
  }

  // Raise one flag per student with at least one signal, unless one is pending or was decided recently.
  const recheckSince = new Date(Date.now() - RECHECK_DAYS * 86_400_000).toISOString();
  for (const [userId, s] of signals) {
    const lines: string[] = [];
    if (s.lateCancels >= LATE_CANCEL_COUNT) lines.push(`${s.lateCancels} cancellations less than ${LATE_CANCEL_HOURS} h before the start`);
    if (s.overdue >= OVERDUE_COUNT) lines.push(`${s.overdue} returns marked overdue`);
    for (const h of s.hogged) lines.push(`${h.share}% of booked hours on ${h.resource} (${h.hours} h) while others also asked for it`);
    if (!lines.length) continue;

    const { data: existing, error: exErr } = await db
      .from("user_flags")
      .select("id, status, decided_at")
      .eq("user_id", userId)
      .eq("source", "ai_pattern")
      .or(`status.eq.pending,decided_at.gte.${recheckSince}`)
      .limit(1);
    if (exErr) {
      report.errors.push(`existing flags: ${exErr.message}`);
      continue;
    }
    if ((existing ?? []).length) {
      report.skipped++;
      continue;
    }

    const { error: flagErr } = await db.rpc("record_ai_pattern_flag", {
      p_user: userId,
      p_evidence: { signals: lines, window_days: WINDOW_DAYS, method: "rule-based counts" },
      p_proposed_block_days: null, // the admin picks the length if they confirm
    });
    if (flagErr) report.errors.push(`flag: ${flagErr.message}`);
    else report.flagged++;
  }
  return report;
}
