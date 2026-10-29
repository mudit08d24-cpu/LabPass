"use server";

// Admin and Idle Radar — Member B. Repo path: lib/actions/admin.ts
// Restrictions are never automatic: A's database proposes (user_flags), an admin decides.

import { getDb, currentUserId } from "@/lib/actions/db";
import { rpc, badId, isoDate, needsReason, text, fail, ok } from "@/lib/actions/db";
import { flagUsagePatterns, type PatternJobReport } from "@/lib/jobs/pattern-flags";
import { type Result, failFrom } from "@/lib/actions/errors";

export type UserFlag = {
  id: string;
  userId: string;
  userName: string;
  source: "no_show_rule" | "ai_pattern";
  evidence: Record<string, unknown>; // ai_pattern evidence is an "AI suggestion — needs review"
  proposedBlockDays: number | null;
  createdAt: string;
};

// FR-26 + restriction rule: pending flags for the admin to confirm or dismiss.
export async function listPendingFlags(): Promise<Result<UserFlag[]>> {
  const supabase = await getDb();
  const { data, error } = await supabase
    .from("user_flags")
    .select("id, user_id, source, evidence, proposed_block_days, created_at, profiles!user_flags_user_id_fkey(name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) return failFrom(error);
  const rows = (data ?? []) as {
    id: string;
    user_id: string;
    source: "no_show_rule" | "ai_pattern";
    evidence: Record<string, unknown> | null;
    proposed_block_days: number | null;
    created_at: string;
    profiles: { name: string } | { name: string }[] | null;
  }[];
  return ok(
    rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      userName: (Array.isArray(r.profiles) ? r.profiles[0]?.name : r.profiles?.name) ?? "",
      source: r.source,
      evidence: r.evidence ?? {},
      proposedBlockDays: r.proposed_block_days,
      createdAt: r.created_at,
    })),
  );
}

// Admin confirms (blocks booking for blockDays, default the proposed length) or dismisses a flag.
export async function decideUserFlag(flagId: string, confirm: boolean, reason: string, blockDays?: number): Promise<Result<null>> {
  if (badId(flagId)) return fail("Unknown flag.");
  const missing = needsReason(reason, confirm ? "confirm this restriction" : "dismiss this flag");
  if (missing) return missing;
  if (blockDays !== undefined && !(Number.isInteger(blockDays) && blockDays >= 1 && blockDays <= 30)) {
    return fail("Please choose a block length of 1 to 30 days.");
  }
  return rpc("decide_user_flag", { p_flag_id: flagId, p_confirm: confirm === true, p_reason: text(reason), p_block_days: blockDays ?? null });
}

// FR-26: admin runs the usage-pattern scan now (it also runs every 5 minutes from /api/jobs).
// Rule-based counts; new flags appear in listPendingFlags with source "ai_pattern".
export async function scanUsagePatterns(): Promise<Result<PatternJobReport>> {
  const db = await getDb();
  const uid = await currentUserId(db);
  if (!uid) return fail("Please sign in again.");
  const { data: me } = await db.from("profiles").select("roles").eq("id", uid).maybeSingle();
  if (!((me?.roles as string[] | undefined) ?? []).includes("admin")) return fail("Only an admin can run this scan.");
  try {
    return ok(await flagUsagePatterns());
  } catch {
    return fail("The scan couldn't run. Please try again.");
  }
}

// Admin lifts a booking block early.
export async function liftUserBlock(userId: string, reason: string): Promise<Result<null>> {
  if (badId(userId)) return fail("Unknown user.");
  const missing = needsReason(reason, "lift this block");
  if (missing) return missing;
  return rpc("lift_user_block", { p_user: userId, p_reason: text(reason) });
}

export type IdleRadarRow = {
  resourceId: string;
  resourceName: string;
  departmentId: string;
  availableHours: number;
  bookedHours: number;
  usedHours: number;
  utilisation: number | null; // 0–1, null when no hours were offered
  noShowRate: number | null; // 0–1
  waitlistLength: number;
  hoursUnlocked: number; // hours used under peer supervision
  bottleneck: boolean; // 3+ waiting, or 80%+ booked
};

// FR-25: utilisation per resource. Admins see every resource; owners see their departments.
// from / to are dates like "2026-10-15" (inclusive).
export async function getIdleRadar(from: string, to: string): Promise<Result<IdleRadarRow[]>> {
  const f = isoDate(from), t = isoDate(to);
  if (!f || !t || t < f) return fail("Please choose a valid date range.");
  const res = await rpc<Record<string, unknown>[]>("idle_radar", { p_from: f, p_to: t });
  if (!res.ok) return res;
  const num = (v: unknown) => (v == null ? null : Number(v));
  return ok(
    (res.data ?? []).map((r) => ({
      resourceId: r.resource_id as string,
      resourceName: r.resource_name as string,
      departmentId: r.department_id as string,
      availableHours: Number(r.available_hours ?? 0),
      bookedHours: Number(r.booked_hours ?? 0),
      usedHours: Number(r.used_hours ?? 0),
      utilisation: num(r.utilisation),
      noShowRate: num(r.no_show_rate),
      waitlistLength: Number(r.waitlist_length ?? 0),
      hoursUnlocked: Number(r.hours_unlocked ?? 0),
      bottleneck: r.bottleneck === true,
    })),
  );
}

// Peak and dead hours for one resource: booked hours by weekday (Mon = 0) and hour (0–23).
export async function getIdleRadarHourly(
  resourceId: string,
  from: string,
  to: string,
): Promise<Result<{ weekday: number; hour: number; bookedHours: number }[]>> {
  if (badId(resourceId)) return fail("Unknown resource.");
  const f = isoDate(from), t = isoDate(to);
  if (!f || !t || t < f) return fail("Please choose a valid date range.");
  const res = await rpc<{ weekday: number; hour: number; booked_hours: number }[]>("idle_radar_hourly", {
    p_resource: resourceId,
    p_from: f,
    p_to: t,
  });
  if (!res.ok) return res;
  return ok((res.data ?? []).map((r) => ({ weekday: Number(r.weekday), hour: Number(r.hour), bookedHours: Number(r.booked_hours) })));
}
