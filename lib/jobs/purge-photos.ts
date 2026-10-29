import "server-only";

// Photo deletion job — Member B. Repo path: lib/jobs/purge-photos.ts
// Photos live in A's private condition-photos bucket at <booking_id>/<file>.
// Called by app/api/jobs/route.ts, which pg_cron calls every 5 minutes.
//
// PRD privacy rule: condition photos are deleted 30 days after the booking closes, unless an
// incident is still open. A's database decides which bookings are due
// (condition_photos_due_for_purge: closed bookings, older than photo_retention_days, no open
// incident). Supabase doesn't allow deleting storage files from SQL, so this job deletes the
// files through the Storage API and then tells the database (mark_condition_photos_purged).
// Incident photos are kept: they're evidence for the incident record.

import { createAdminClient } from "@/lib/supabase/admin";
import { UPLOADS } from "@/lib/config";

const BATCH = 20; // bookings per run

export type PurgeJobReport = { bookings: number; files: number; failed: number; errors: string[] };

export async function purgeOldPhotos(): Promise<PurgeJobReport> {
  const db = createAdminClient();
  const report: PurgeJobReport = { bookings: 0, files: 0, failed: 0, errors: [] };

  const { data, error } = await db.rpc("condition_photos_due_for_purge");
  if (error) throw new Error(`Could not list photos to delete: ${error.message}`);
  const due = ((data ?? []) as { booking_id: string; photo_paths: string[] | null }[]).slice(0, BATCH);

  for (const row of due) {
    // Only ever delete files inside this booking's own folder.
    const prefix = `${row.booking_id}/`;
    const paths = (row.photo_paths ?? []).filter((p) => typeof p === "string" && p.startsWith(prefix) && !p.includes(".."));

    if (paths.length > 0) {
      const { error: removeError } = await db.storage.from(UPLOADS.conditionPhoto.bucket).remove(paths);
      if (removeError) {
        report.failed++;
        report.errors.push(removeError.message);
        continue; // leave it for the next run; the database still lists it
      }
    }

    const { error: markError } = await db.rpc("mark_condition_photos_purged", { p_booking_id: row.booking_id });
    if (markError) {
      report.failed++;
      report.errors.push(markError.message);
      continue;
    }
    report.bookings++;
    report.files += paths.length;
  }

  report.errors = [...new Set(report.errors)].slice(0, 5);
  return report;
}
