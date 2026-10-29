// Storage path helpers shared by server and client code — Member B. Repo path: lib/storage.ts
// Not "use server": plain functions, safe to import in client components.
//
// A's database stores file PATHS without the bucket name, not links:
//   resources.photos[]             -> "<resource_id>/<file>"   bucket resource-photos (public)
//   condition_reports.photo_urls[] -> "<booking_id>/<file>"    bucket condition-photos (private)
//   incidents.photo_urls[]         -> "<booking_id>/<file>"    bucket condition-photos (private)
//   user_badges.evidence_url       -> "<user_id>/<file>"       bucket certificates (private)
// Show a resource photo with resourcePhotoUrl(path).
// Show private files with getConditionPhotoUrl(s) or getCertificateUrl (lib/actions/uploads.ts).

import { UPLOADS } from "@/lib/config";

// Public link for a resource photo. Works in client components (uses the public Supabase URL).
export function resourcePhotoUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${base}/storage/v1/object/public/${UPLOADS.resourcePhoto.bucket}/${encoded}`;
}

const UUID_PART = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

// Paths our upload helpers create: <uuid folder>/<uuid>.<ext>
export const CONDITION_PHOTO_PATH = new RegExp(`^${UUID_PART}/${UUID_PART}\\.(jpg|jpeg|png|webp)$`, "i");
export const CERTIFICATE_PATH = new RegExp(`^${UUID_PART}/${UUID_PART}\\.(pdf|jpg|jpeg|png|webp)$`, "i");

// True if `path` is a condition photo inside this booking's own folder.
export function isBookingPhoto(path: unknown, bookingId: string): boolean {
  return typeof path === "string" && CONDITION_PHOTO_PATH.test(path) && path.startsWith(`${bookingId}/`);
}
