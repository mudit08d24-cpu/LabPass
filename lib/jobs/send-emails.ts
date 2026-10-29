import "server-only";

// Email job — Member B. Repo path: lib/jobs/send-emails.ts
// Called by app/api/jobs/route.ts, which pg_cron calls every 5 minutes.
//
// A's database creates notification rows with emailed_at = null. This job:
//   1. claims a batch by setting emailed_at (so two runs never email the same row),
//   2. sends one Resend email per row,
//   3. puts emailed_at back to null for rows that failed in a way worth retrying.
// Rows older than MAX_AGE_HOURS are marked emailed without sending (a day-old reminder is useless).
// Only the types shouldEmail() picks are sent (PRD FR-22); the rest are in-app only.

import { createAdminClient } from "@/lib/supabase/admin";
import { describeNotification, shouldEmail, type NotificationPayload } from "@/lib/notifications/messages";
import { renderEmail, sendEmail } from "@/lib/email";

const BATCH = 25;
const MAX_AGE_HOURS = 12;
const PAUSE_MS = 600; // stay under Resend's default rate limit

type Claimed = { id: string; user_id: string; type: string; payload: NotificationPayload | null; created_at: string };

export type EmailJobReport = { claimed: number; sent: number; skipped: number; failed: number; retrying: number; errors: string[] };

export async function sendPendingEmails(): Promise<EmailJobReport> {
  const db = createAdminClient();
  const report: EmailJobReport = { claimed: 0, sent: 0, skipped: 0, failed: 0, retrying: 0, errors: [] };

  const { data: pending, error: pendingError } = await db
    .from("notifications")
    .select("id")
    .is("emailed_at", null)
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (pendingError) throw new Error(`Could not read notifications: ${pendingError.message}`);
  const ids = ((pending ?? []) as { id: string }[]).map((r) => r.id);
  if (ids.length === 0) return report;

  // Claim: only rows still unclaimed are returned, so a parallel run can't take the same ones.
  const { data: claimedRows, error: claimError } = await db
    .from("notifications")
    .update({ emailed_at: new Date().toISOString() })
    .in("id", ids)
    .is("emailed_at", null)
    .select("id, user_id, type, payload, created_at");
  if (claimError) throw new Error(`Could not claim notifications: ${claimError.message}`);
  const claimed = (claimedRows ?? []) as Claimed[];
  report.claimed = claimed.length;
  if (claimed.length === 0) return report;

  const userIds = [...new Set(claimed.map((n) => n.user_id))];
  const { data: people, error: peopleError } = await db.from("profiles").select("id, name, email").in("id", userIds);
  if (peopleError) {
    await db.from("notifications").update({ emailed_at: null }).in("id", claimed.map((n) => n.id));
    throw new Error(`Could not read profiles: ${peopleError.message}`);
  }
  type Person = { id: string; name: string | null; email: string | null };
  const byId = new Map(((people ?? []) as Person[]).map((p) => [p.id, p] as const));

  const { data: cfg } = await db.rpc("labpass_config");
  const timeZone = (cfg as { timezone?: string } | null)?.timezone ?? "Asia/Kolkata";

  const retry: string[] = [];
  const cutoff = Date.now() - MAX_AGE_HOURS * 3_600_000;

  for (const n of claimed) {
    const person = byId.get(n.user_id);
    if (!person?.email || new Date(n.created_at).getTime() < cutoff || !shouldEmail(n.type, n.payload ?? {})) {
      report.skipped++;
      continue;
    }
    const msg = describeNotification(n.type, n.payload ?? {}, timeZone);
    const result = await sendEmail(person.email, renderEmail(person.name ?? "", msg), `notification-${n.id}`);
    if (result.ok) {
      report.sent++;
    } else if (result.retry) {
      retry.push(n.id);
      report.retrying++;
      report.errors.push(result.error);
    } else {
      report.failed++;
      report.errors.push(result.error);
    }
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }

  if (retry.length > 0) {
    await db.from("notifications").update({ emailed_at: null }).in("id", retry);
  }
  report.errors = [...new Set(report.errors)].slice(0, 5);
  return report;
}
