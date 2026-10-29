// Shapes returned by A's booking functions — Member B. Repo path: lib/types/booking.ts
// Plain types, safe to import in client components. Field names match A's labpass_schema.sql.

// One check in the booking checklist (A's _chk).
export type Check = { ok: boolean; blocking: boolean; message: string };

export type CheckName =
  | "account"
  | "resource"
  | "time"
  | "availability"
  | "eligibility"
  | "supervisor"
  | "conflict"
  | "weekly_cap"
  | "active_limit"
  | "credits"
  | "open_incidents";

// A's _priority breakdown.
export type PriorityBreakdown = {
  base: number;
  fresh_resource: number;
  verified_deadline: number;
  hours_this_week: number;
  hours_penalty: number;
  no_shows_30d: number;
  no_show_penalty: number;
  total: number;
};

export type Priority = { score: number; breakdown: PriorityBreakdown };

// evaluate_booking result.
// ok = no blocking check failed. A failed check with blocking: false is a warning
// (e.g. the slot is taken: the student can still request it and be waitlisted).
export type BookingEvaluation = {
  ok: boolean;
  cost: number;
  needs_supervisor: boolean;
  supervisor_kind: "staff" | "peer" | null;
  checks: Partial<Record<CheckName, Check>>;
  priority: Priority;
};

export type BookingDecision = "approved" | "rejected" | "waitlisted";

export type ReportStage = "check_in" | "return";

// One ticked item in a check-in or return report. Send one per item in the resource's checklist,
// in the same order. A's database requires at least as many entries as the resource's checklist.
export type ChecklistAnswer = { item: string; ok: boolean; note?: string };

export type TimeSlot = { start: string; end: string }; // ISO times

export type Eligibility =
  | { status: "eligible" | "needs_quiz" | "needs_certificate" | "needs_supervisor"; resourceTier: number; yourTier: number }
  | { status: "blocked"; until: string | null; reason: string | null };

export type WaitlistRank = {
  rank: number;
  of: number;
  score: number;
  breakdown: PriorityBreakdown;
  liveOffer: { id: string; expiresAt: string } | null;
};
