"use server";

// Peer supervisors — Member B. Repo path: lib/actions/supervisors.ts
// FR-16, FR-17. Co-signing reports is signConditionReport in lib/actions/bookings.ts.

import { getDb } from "@/lib/actions/db";
import { rpc, badId, isoTime, needsReason, text, fail, ok } from "@/lib/actions/db";
import { type Result, failFrom } from "@/lib/actions/errors";
import { parseRange, toRange } from "@/lib/ranges";
import type { TimeSlot } from "@/lib/types/booking";

// A Tier 2 student applies to supervise one resource. The manager is notified.
export async function applyAsSupervisor(resourceId: string): Promise<Result<{ approvalId: string }>> {
  if (badId(resourceId)) return fail("Unknown resource.");
  const res = await rpc<string>("apply_as_supervisor", { p_resource: resourceId });
  return res.ok ? ok({ approvalId: res.data }) : res;
}

// Manager: approve (from pending or suspended), reject (from pending) or suspend (from approved).
// Reason required to reject or suspend.
export async function decideSupervisor(
  approvalId: string,
  decision: "approved" | "rejected" | "suspended",
  reason?: string,
): Promise<Result<null>> {
  if (badId(approvalId)) return fail("Unknown application.");
  if (!["approved", "rejected", "suspended"].includes(decision)) return fail("Unknown decision.");
  if (decision !== "approved") {
    const missing = needsReason(reason, decision === "rejected" ? "reject this application" : "suspend this supervisor");
    if (missing) return missing;
  }
  return rpc("decide_supervisor", { p_approval_id: approvalId, p_decision: decision, p_reason: text(reason) || null });
}

// An approved supervisor publishes hours they can supervise. A's rules allow this only for
// approved supervisors of that resource, and hours can't overlap the supervisor's other hours.
export async function publishSupervisorHours(resourceId: string, start: string, end: string): Promise<Result<{ slotId: string }>> {
  if (badId(resourceId)) return fail("Unknown resource.");
  const s = isoTime(start), e = isoTime(end);
  if (!s || !e) return fail("Please choose a start and end time.");
  if (e <= s) return fail("The end time must be after the start time.");
  if (new Date(s).getTime() < Date.now()) return fail("Please choose hours in the future.");

  const supabase = await getDb();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail("Please log in first.");
  const { data, error } = await supabase
    .from("supervisor_slots")
    .insert({ supervisor_id: auth.user.id, resource_id: resourceId, time_range: toRange(s, e) })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23P01") return fail("These hours overlap hours you've already published.");
    if (error.code === "42501") return fail("Only approved supervisors for this resource can publish hours.");
    return failFrom(error);
  }
  return ok({ slotId: (data as { id: string }).id });
}

// Remove published hours. A's database refuses if an approved supervised session falls inside them.
export async function removeSupervisorHours(slotId: string): Promise<Result<null>> {
  if (badId(slotId)) return fail("Unknown hours.");
  const supabase = await getDb();
  const { data, error } = await supabase.from("supervisor_slots").delete().eq("id", slotId).select("id");
  if (error) return failFrom(error);
  if (!data || data.length === 0) return fail("Those hours weren't found, or you can't remove them.");
  return ok(null);
}

export type MySupervisorHours = TimeSlot & { slotId: string; resourceId: string };

// The logged-in supervisor's own published hours (upcoming first).
export async function listMySupervisorHours(): Promise<Result<MySupervisorHours[]>> {
  const supabase = await getDb();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail("Please log in first.");
  const { data, error } = await supabase
    .from("supervisor_slots")
    .select("id, resource_id, time_range")
    .eq("supervisor_id", auth.user.id);
  if (error) return failFrom(error);
  const rows = (data ?? []) as { id: string; resource_id: string; time_range: string }[];
  return ok(
    rows
      .flatMap((r) => {
        const range = parseRange(r.time_range);
        return range ? [{ slotId: r.id, resourceId: r.resource_id, start: range.start.toISOString(), end: range.end.toISOString() }] : [];
      })
      .sort((a, b) => a.start.localeCompare(b.start)),
  );
}
