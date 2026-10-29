// Background jobs endpoint — Member B. Repo path: app/api/jobs/route.ts
//
// pg_cron (agreed at the hour-4 sync) calls this every 5 minutes through pg_net:
//   POST <APP_URL>/api/jobs   header  x-cron-secret: <CRON_SECRET>
// The database jobs (overdue, no-shows, reminders, offers) run inside the database on their own
// pg_cron schedule; this route does the jobs that need server code.
//
// Jobs:
//   - send notification emails (lib/jobs/send-emails.ts)
//   - delete condition photos 30 days after the booking closes (lib/jobs/purge-photos.ts)
// Each job runs even if the other fails; the reply reports both.
//
// Test email (to check the Resend domain works):
//   curl -X POST "<APP_URL>/api/jobs?test=you@example.com" -H "x-cron-secret: <CRON_SECRET>"
//
// Env: CRON_SECRET (long random string, same value stored in Supabase Vault for pg_cron)

import { timingSafeEqual } from "node:crypto";
import { sendPendingEmails } from "@/lib/jobs/send-emails";
import { purgeOldPhotos } from "@/lib/jobs/purge-photos";
import { renderEmail, sendEmail } from "@/lib/email";

// No `dynamic` or `runtime` exports: the repo turns on cacheComponents (next.config.ts), which
// doesn't allow `dynamic`; a POST route handler is never cached, and Node.js is the default runtime.
export const maxDuration = 60;

function authorised(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  const given = request.headers.get("x-cron-secret");
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!authorised(request)) return Response.json({ error: "Unauthorised" }, { status: 401 });

  const testTo = new URL(request.url).searchParams.get("test");
  if (testTo) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo)) return Response.json({ error: "Invalid test address" }, { status: 400 });
    const content = renderEmail("", {
      title: "Test email",
      body: "If you can read this, LabPass email is set up correctly.",
      href: "/",
    });
    const result = await sendEmail(testTo, content, `test-${Date.now()}`);
    return Response.json({ ok: result.ok, from: process.env.EMAIL_FROM ?? null, to: testTo, ...(result.ok ? {} : { error: result.error }) });
  }

  const results: Record<string, unknown> = {};
  try {
    results.emails = await sendPendingEmails();
  } catch (e) {
    results.emails = { error: e instanceof Error ? e.message : "failed" };
  }
  try {
    results.photos = await purgeOldPhotos();
  } catch (e) {
    results.photos = { error: e instanceof Error ? e.message : "failed" };
  }
  return Response.json({ ok: true, ranAt: new Date().toISOString(), results });
}
