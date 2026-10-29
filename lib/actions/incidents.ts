"use server";

// Incidents — Member B. Repo path: lib/actions/incidents.ts
// FR-19 to FR-21. Flow: open → under_review → decided → (disputed → closed by admin) or closed by manager.
// No penalty is ever automatic: the manager picks one, with a written reason.

import { rpc, badId, needsReason, text, fail, ok } from "@/lib/actions/db";
import type { Result } from "@/lib/actions/errors";
import { isBookingPhoto } from "@/lib/storage";

export type IncidentType = "damage" | "delay" | "missing_item" | "other";
export type IncidentDecision = "no_action" | "warning" | "credit_penalty" | "temporary_block";

// Student or manager reports a problem on a checked-in, overdue, returned or completed booking.
// Photos come from uploadEvidencePhoto(bookingId, ...).
export async function openIncident(
  bookingId: string,
  type: IncidentType,
  description: string,
  photoPaths: string[] = [],
): Promise<Result<{ incidentId: string }>> {
  if (badId(bookingId)) return fail("Unknown booking.");
  if (!["damage", "delay", "missing_item", "other"].includes(type)) return fail("Please choose what kind of problem it is.");
  const d = text(description);
  if (d.length === 0) return fail("Please describe what happened.");
  if (d.length > 4000) return fail("Please keep the description under 4,000 characters.");
  if (!Array.isArray(photoPaths) || photoPaths.some((p) => !isBookingPhoto(p, bookingId))) {
    return fail("Please upload the photos for this booking again.");
  }
  const res = await rpc<string>("open_incident", { p_booking_id: bookingId, p_type: type, p_description: d, p_photo_paths: photoPaths });
  return res.ok ? ok({ incidentId: res.data }) : res;
}

// Manager moves an open incident to review.
export async function startIncidentReview(incidentId: string): Promise<Result<null>> {
  if (badId(incidentId)) return fail("Unknown incident.");
  return rpc("start_incident_review", { p_incident_id: incidentId });
}

// Manager decides, with a reason. credit_penalty needs penaltyCredits (> 0); temporary_block needs blockDays (1–30).
export async function decideIncident(
  incidentId: string,
  decision: IncidentDecision,
  reason: string,
  options: { penaltyCredits?: number; blockDays?: number } = {},
): Promise<Result<{ penaltyCredits: number | null; blockUntil: string | null }>> {
  if (badId(incidentId)) return fail("Unknown incident.");
  if (!["no_action", "warning", "credit_penalty", "temporary_block"].includes(decision)) return fail("Unknown decision.");
  const missing = needsReason(reason, "decide this incident");
  if (missing) return missing;
  const credits = options.penaltyCredits;
  const days = options.blockDays;
  if (decision === "credit_penalty" && !(Number.isInteger(credits) && (credits as number) > 0)) {
    return fail("Please enter how many credits to deduct.");
  }
  if (decision === "temporary_block" && !(Number.isInteger(days) && (days as number) >= 1 && (days as number) <= 30)) {
    return fail("Please choose a block length of 1 to 30 days.");
  }
  const res = await rpc<{ penalty_credits: number | null; block_until: string | null }>("decide_incident", {
    p_incident_id: incidentId,
    p_decision: decision,
    p_reason: text(reason),
    p_penalty_credits: decision === "credit_penalty" ? credits : null,
    p_block_days: decision === "temporary_block" ? days : null,
  });
  if (!res.ok) return res;
  return ok({
    penaltyCredits: res.data?.penalty_credits == null ? null : Number(res.data.penalty_credits),
    blockUntil: res.data?.block_until ?? null,
  });
}

// Student responds; dispute = true (only after a decision) sends it to an admin.
export async function respondToIncident(incidentId: string, response: string, dispute = false): Promise<Result<null>> {
  if (badId(incidentId)) return fail("Unknown incident.");
  const r = text(response);
  if (r.length === 0) return fail("Please write your response.");
  if (r.length > 4000) return fail("Please keep your response under 4,000 characters.");
  return rpc("respond_to_incident", { p_incident_id: incidentId, p_response: r, p_dispute: dispute === true });
}

// Manager closes a decided, undisputed incident.
export async function closeIncident(incidentId: string, reason?: string): Promise<Result<null>> {
  if (badId(incidentId)) return fail("Unknown incident.");
  return rpc("close_incident", { p_incident_id: incidentId, p_reason: text(reason) || null });
}

// Admin resolves a dispute. Overturning refunds the credit penalty and lifts the block it caused.
export async function resolveIncidentDispute(
  incidentId: string,
  outcome: "upheld" | "overturned",
  reason: string,
): Promise<Result<null>> {
  if (badId(incidentId)) return fail("Unknown incident.");
  if (outcome !== "upheld" && outcome !== "overturned") return fail("Unknown outcome.");
  const missing = needsReason(reason, "resolve this dispute");
  if (missing) return missing;
  return rpc("resolve_incident_dispute", { p_incident_id: incidentId, p_outcome: outcome, p_reason: text(reason) });
}
