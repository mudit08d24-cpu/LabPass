"use server";

// Resources and discovery — Member B. Repo path: lib/actions/resources.ts
// Each action calls one of A's database functions (labpass_schema.sql).

import { rpc, badId, isoTime, needsReason, text, fail, ok } from "@/lib/actions/db";
import type { Result } from "@/lib/actions/errors";
import { parseRange } from "@/lib/ranges";
import type { Eligibility, TimeSlot } from "@/lib/types/booking";

function slot(range: unknown): TimeSlot | null {
  const r = parseRange(typeof range === "string" ? range : null);
  return r ? { start: r.start.toISOString(), end: r.end.toISOString() } : null;
}

// FR-05: the badge on each listing (eligible / needs quiz / needs certificate / needs supervisor / blocked).
export async function getMyEligibility(resourceId: string): Promise<Result<Eligibility>> {
  if (badId(resourceId)) return fail("Unknown resource.");
  const res = await rpc<Record<string, unknown>>("my_eligibility", { p_resource: resourceId });
  if (!res.ok) return res;
  const d = res.data ?? {};
  if (d.status === "blocked") {
    return ok({ status: "blocked", until: (d.until as string | null) ?? null, reason: (d.reason as string | null) ?? null });
  }
  return ok({
    status: d.status as "eligible" | "needs_quiz" | "needs_certificate" | "needs_supervisor",
    resourceTier: Number(d.resource_tier),
    yourTier: Number(d.your_tier),
  });
}

// The same for many listings in ONE server round trip (Browse). The browser runs server actions one
// at a time, so calling getMyEligibility per card made the list slow; here they run in parallel.
export async function getMyEligibilities(resourceIds: string[]): Promise<Result<Record<string, Eligibility | null>>> {
  const ids = Array.from(new Set(resourceIds)).filter((id) => !badId(id)).slice(0, 100);
  const results = await Promise.all(ids.map((id) => getMyEligibility(id)));
  return ok(Object.fromEntries(ids.map((id, i) => [id, results[i].ok ? results[i].data : null])));
}

// Busy times for the availability calendar, without saying who booked them.
export async function getBusyTimes(resourceId: string, from: string, to: string): Promise<Result<TimeSlot[]>> {
  const f = isoTime(from), t = isoTime(to);
  if (badId(resourceId)) return fail("Unknown resource.");
  if (!f || !t || t <= f) return fail("Please choose a valid date range.");
  const res = await rpc<{ time_range: string }[]>("resource_busy_times", { p_resource: resourceId, p_from: f, p_to: t });
  if (!res.ok) return res;
  return ok((res.data ?? []).map((r) => slot(r.time_range)).filter((s): s is TimeSlot => s !== null));
}

export type SupervisorOption = TimeSlot & { slotId: string; supervisorId: string; supervisorName: string; kind: "staff" | "peer" };

// Busy times for many resources in ONE server round trip (Browse → "Free right now").
export async function getBusyTimesMany(resourceIds: string[], from: string, to: string): Promise<Result<Record<string, TimeSlot[] | null>>> {
  const ids = Array.from(new Set(resourceIds)).filter((id) => !badId(id)).slice(0, 100);
  const results = await Promise.all(ids.map((id) => getBusyTimes(id, from, to)));
  return ok(Object.fromEntries(ids.map((id, i) => [id, results[i].ok ? results[i].data : null])));
}

// FR-09: supervisors a student can pick for a Tier 3 booking.
export async function listSupervisorAvailability(resourceId: string, from: string, to: string): Promise<Result<SupervisorOption[]>> {
  const f = isoTime(from), t = isoTime(to);
  if (badId(resourceId)) return fail("Unknown resource.");
  if (!f || !t || t <= f) return fail("Please choose a valid date range.");
  const res = await rpc<{ slot_id: string; supervisor_id: string; supervisor_name: string; kind: "staff" | "peer"; time_range: string }[]>(
    "list_supervisor_availability",
    { p_resource: resourceId, p_from: f, p_to: t },
  );
  if (!res.ok) return res;
  return ok(
    (res.data ?? []).flatMap((r) => {
      const s = slot(r.time_range);
      return s ? [{ ...s, slotId: r.slot_id, supervisorId: r.supervisor_id, supervisorName: r.supervisor_name, kind: r.kind }] : [];
    }),
  );
}

// Manager, owner or admin: open, take out of service, or mark under maintenance (hidden from booking).
export async function setResourceStatus(
  resourceId: string,
  status: "active" | "inactive" | "maintenance",
  reason: string,
): Promise<Result<null>> {
  if (badId(resourceId)) return fail("Unknown resource.");
  if (!["active", "inactive", "maintenance"].includes(status)) return fail("Unknown status.");
  const missing = needsReason(reason, "change the resource's status");
  if (missing) return missing;
  return rpc("set_resource_status", { p_resource: resourceId, p_status: status, p_reason: text(reason) });
}

// Owner: managers who can be assigned to a resource.
export async function listAssignableManagers(): Promise<Result<{ id: string; name: string }[]>> {
  const res = await rpc<{ id: string; name: string }[]>("list_assignable_managers");
  if (!res.ok) return res;
  return ok(res.data ?? []);
}
