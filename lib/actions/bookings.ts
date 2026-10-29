"use server";

// Bookings, waitlist and handover — Member B. Repo path: lib/actions/bookings.ts
// Each action calls one of A's database functions (labpass_schema.sql). A's functions run every
// rule, write the audit log and create the notifications; these actions check inputs and
// return plain-language results.
//
// Booking journey (PRD):
//   evaluateBooking → requestBooking → decideBooking (manager)
//   → saveConditionReport("check_in") [→ signConditionReport by the supervisor] → checkIn (lib/actions/checkin.ts)
//   → saveConditionReport("return")   [→ signConditionReport by the supervisor] → returnBooking → confirmReturn (manager)

import { rpc, badId, isoTime, needsReason, text, fail, ok } from "@/lib/actions/db";
import type { Result } from "@/lib/actions/errors";
import { isBookingPhoto } from "@/lib/storage";
import type {
  BookingDecision,
  BookingEvaluation,
  ChecklistAnswer,
  Priority,
  PriorityBreakdown,
  ReportStage,
  WaitlistRank,
} from "@/lib/types/booking";

type Times = { ok: true; s: string; e: string } | { ok: false; error: string };

function times(start: string, end: string): Times {
  const s = isoTime(start), e = isoTime(end);
  if (!s || !e) return { ok: false, error: "Please choose a start and end time." };
  if (e <= s) return { ok: false, error: "The end time must be after the start time." };
  return { ok: true, s, e };
}

// ---------------------------------------------------------------------------
// Request and decide
// ---------------------------------------------------------------------------

// FR-10: run every check and show the price and priority score before the student submits.
export async function evaluateBooking(
  resourceId: string,
  start: string,
  end: string,
  supervisorId?: string | null,
): Promise<Result<BookingEvaluation>> {
  if (badId(resourceId)) return fail("Unknown resource.");
  if (supervisorId && badId(supervisorId)) return fail("Unknown supervisor.");
  const t = times(start, end);
  if (!t.ok) return fail(t.error);
  return rpc<BookingEvaluation>("evaluate_booking", {
    p_resource_id: resourceId,
    p_start: t.s,
    p_end: t.e,
    p_supervisor_id: supervisorId ?? null,
  });
}

// FR-09: student requests a slot. If a check blocks it, `error` explains and `reasons` lists each one.
export async function requestBooking(
  resourceId: string,
  start: string,
  end: string,
  purpose: string,
  supervisorId?: string | null,
): Promise<Result<{ bookingId: string }>> {
  if (badId(resourceId)) return fail("Unknown resource.");
  if (supervisorId && badId(supervisorId)) return fail("Unknown supervisor.");
  const t = times(start, end);
  if (!t.ok) return fail(t.error);
  const p = text(purpose);
  if (p.length === 0) return fail("Please describe what you need it for.");
  if (p.length > 2000) return fail("Please keep the purpose under 2,000 characters.");
  const res = await rpc<string>("request_booking", {
    p_resource_id: resourceId,
    p_start: t.s,
    p_end: t.e,
    p_purpose: p,
    p_supervisor_id: supervisorId ?? null,
  });
  return res.ok ? ok({ bookingId: res.data }) : res;
}

// FR-11: manager approves, rejects or waitlists a request. Reason required to reject or waitlist.
// Approving charges the student's credits and moves overlapping requests to the waitlist.
export async function decideBooking(bookingId: string, decision: BookingDecision, reason?: string): Promise<Result<null>> {
  if (badId(bookingId)) return fail("Unknown booking.");
  if (!["approved", "rejected", "waitlisted"].includes(decision)) return fail("Unknown decision.");
  if (decision !== "approved") {
    const missing = needsReason(reason, decision === "rejected" ? "reject this request" : "waitlist this request");
    if (missing) return missing;
  }
  return rpc("manager_decide_booking", { p_booking_id: bookingId, p_decision: decision, p_reason: text(reason) || null });
}

// Manager marks a faculty-verified deadline (+15 priority) on a pending or waitlisted request.
export async function setDeadlineVerified(bookingId: string, verified: boolean, reason: string): Promise<Result<Priority>> {
  if (badId(bookingId)) return fail("Unknown booking.");
  const missing = needsReason(reason, "change the deadline verification");
  if (missing) return missing;
  return rpc<Priority>("set_deadline_verified", { p_booking_id: bookingId, p_verified: verified === true, p_reason: text(reason) });
}

// Student cancels (free more than 2 hours before the start), or manager cancels (reason required, always refunded).
export async function cancelBooking(bookingId: string, reason?: string): Promise<Result<{ refundedCredits: number }>> {
  if (badId(bookingId)) return fail("Unknown booking.");
  const res = await rpc<{ refunded_credits: number }>("cancel_booking", { p_booking_id: bookingId, p_reason: text(reason) || null });
  return res.ok ? ok({ refundedCredits: Number(res.data?.refunded_credits ?? 0) }) : res;
}

// ---------------------------------------------------------------------------
// Waitlist (FR-13)
// ---------------------------------------------------------------------------

export async function getMyWaitlistRank(bookingId: string): Promise<Result<WaitlistRank>> {
  if (badId(bookingId)) return fail("Unknown booking.");
  const res = await rpc<{
    rank: number;
    of: number;
    score: number;
    breakdown: PriorityBreakdown;
    live_offer: { id: string; expires_at: string } | null;
  }>("my_waitlist_rank", { p_booking_id: bookingId });
  if (!res.ok) return res;
  const d = res.data!;
  return ok({
    rank: Number(d.rank),
    of: Number(d.of),
    score: Number(d.score),
    breakdown: d.breakdown,
    liveOffer: d.live_offer ? { id: d.live_offer.id, expiresAt: d.live_offer.expires_at } : null,
  });
}

// Accepting approves the booking and charges credits; it fails with `reasons` if a check no longer passes.
export async function acceptWaitlistOffer(offerId: string): Promise<Result<null>> {
  if (badId(offerId)) return fail("Unknown offer.");
  return rpc("accept_waitlist_offer", { p_offer_id: offerId });
}

// Declining cancels the request and offers the slot to the next person.
export async function declineWaitlistOffer(offerId: string): Promise<Result<null>> {
  if (badId(offerId)) return fail("Unknown offer.");
  return rpc("decline_waitlist_offer", { p_offer_id: offerId });
}

// ---------------------------------------------------------------------------
// Handover: condition reports, return, confirm (FR-14, FR-15, FR-17)
// ---------------------------------------------------------------------------

// Saves the check-in or return report: one checklist answer per item, at least one photo.
// Photos come from uploadEvidencePhoto(bookingId, ...). Saving again replaces the report and
// clears earlier signatures, so a supervisor's co-sign always covers the final version.
export async function saveConditionReport(
  bookingId: string,
  stage: ReportStage,
  checklist: ChecklistAnswer[],
  photoPaths: string[],
  notes?: string,
): Promise<Result<{ reportId: string }>> {
  if (badId(bookingId)) return fail("Unknown booking.");
  if (stage !== "check_in" && stage !== "return") return fail("Unknown report stage.");
  if (!Array.isArray(checklist) || checklist.some((c) => !c || typeof c.item !== "string" || typeof c.ok !== "boolean")) {
    return fail("Please answer every checklist item.");
  }
  if (!Array.isArray(photoPaths) || photoPaths.length === 0) return fail("Please add at least one photo.");
  if (photoPaths.some((p) => !isBookingPhoto(p, bookingId))) {
    return fail("Please upload the photos for this booking again.");
  }
  const n = text(notes);
  if (n.length > 2000) return fail("Please keep the notes under 2,000 characters.");

  const res = await rpc<string>("save_condition_report", {
    p_booking_id: bookingId,
    p_stage: stage,
    p_checklist: checklist.map((c) => ({ item: c.item, ok: c.ok, ...(c.note ? { note: text(c.note) } : {}) })),
    p_photo_paths: photoPaths,
    p_notes: n || null,
  });
  return res.ok ? ok({ reportId: res.data }) : res;
}

// The booking's assigned supervisor co-signs a check-in or return report (only they can).
// For a supervised booking: student saves the report → supervisor signs → student checks in / returns.
export async function signConditionReport(reportId: string): Promise<Result<null>> {
  if (badId(reportId)) return fail("Unknown report.");
  return rpc("sign_condition_report", { p_report_id: reportId });
}

// Student returns. The return report (with photo, and co-sign if supervised) must be saved first.
export async function returnBooking(bookingId: string): Promise<Result<null>> {
  if (badId(bookingId)) return fail("Unknown booking.");
  return rpc("return_booking", { p_booking_id: bookingId });
}

// Manager confirms the return. A peer supervisor who co-signed both reports earns credits.
export async function confirmReturn(bookingId: string, reason?: string): Promise<Result<{ supervisorReward: number }>> {
  if (badId(bookingId)) return fail("Unknown booking.");
  const res = await rpc<{ supervisor_reward: number }>("confirm_return", { p_booking_id: bookingId, p_reason: text(reason) || null });
  return res.ok ? ok({ supervisorReward: Number(res.data?.supervisor_reward ?? 0) }) : res;
}
