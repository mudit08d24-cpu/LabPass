"use server";

// Credits — Member B. Repo path: lib/actions/credits.ts
// Charges and refunds happen inside A's booking functions; these are the read and admin actions.

import { getDb } from "@/lib/actions/db";
import { rpc, badId, needsReason, text, fail, ok } from "@/lib/actions/db";
import { type Result, failFrom } from "@/lib/actions/errors";

export type CreditEntry = { change: number; reason: string; bookingId: string | null; createdAt: string };

// FR-27: the logged-in user's balance and recent history (newest first).
export async function getCreditBalance(limit = 30): Promise<Result<{ balance: number; history: CreditEntry[] }>> {
  const supabase = await getDb();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail("Please log in first.");

  const [profile, ledger] = await Promise.all([
    supabase.from("profiles").select("credits_balance").eq("id", auth.user.id).maybeSingle(),
    supabase
      .from("credits_ledger")
      .select("change, reason, booking_id, created_at")
      .eq("user_id", auth.user.id)
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 100)),
  ]);
  if (profile.error) return failFrom(profile.error);
  if (ledger.error) return failFrom(ledger.error);

  const rows = (ledger.data ?? []) as { change: number; reason: string; booking_id: string | null; created_at: string }[];
  return ok({
    balance: Number((profile.data as { credits_balance: number } | null)?.credits_balance ?? 0),
    history: rows.map((r) => ({ change: Number(r.change), reason: r.reason, bookingId: r.booking_id, createdAt: r.created_at })),
  });
}

// Admin only: add (positive) or remove (negative) credits, with a reason.
export async function adjustCredits(userId: string, change: number, reason: string, bookingId?: string): Promise<Result<null>> {
  if (badId(userId)) return fail("Unknown user.");
  if (bookingId && badId(bookingId)) return fail("Unknown booking.");
  if (!Number.isInteger(change) || change === 0) return fail("Please enter a whole number of credits, not zero.");
  const missing = needsReason(reason, "adjust credits");
  if (missing) return missing;
  return rpc("adjust_credits", { p_user_id: userId, p_change: change, p_reason: text(reason), p_booking_id: bookingId ?? null });
}
