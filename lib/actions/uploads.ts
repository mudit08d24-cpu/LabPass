"use server";

// LabPass upload actions — Member B. Repo path: lib/actions/uploads.ts
//
// Every upload in the app goes through these functions, never straight to Supabase,
// so file type, size, bucket and path are checked in one place.
// Buckets and permissions come from A's migrations (..._04_security.sql, ..._05_...):
//   resource-photos  (public):  <resource_id>/<file>   owner or admin of the resource
//   condition-photos (private): <booking_id>/<file>    borrower, supervisor or manager; booking approved,
//                                                       checked in, overdue, returned or completed; images only
//   certificates     (private): <user_id>/<file>       the student themself
// Paths are stored without the bucket name. Condition photos and certificates are insert-only
// for users: once uploaded they can't be replaced or deleted.
//
// Files are sent as FormData with the field name "file".
// Needs next.config: experimental.serverActions.bodySizeLimit = "11mb" (default is 1 MB).

import { getDb, currentUserId, badId } from "@/lib/actions/db";
import { UPLOADS } from "@/lib/config";
import { CERTIFICATE_PATH, CONDITION_PHOTO_PATH, resourcePhotoUrl } from "@/lib/storage";
import { type Result, ok, fail, failFrom } from "@/lib/actions/errors";

type UploadKind = keyof typeof UPLOADS;

// The extension comes from the checked file type, never from the user's file name,
// so it always matches what the storage rules expect (A's rule checks the extension).
const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function getFile(formData: FormData): File | null {
  const file = formData.get("file");
  return file instanceof File && file.size > 0 ? file : null;
}

// Returns a plain-language error, or null if the file is allowed for this kind.
function checkFile(kind: UploadKind, file: File): string | null {
  const rule = UPLOADS[kind];
  const allowed = rule.types as readonly string[];
  if (!allowed.includes(file.type)) {
    const names = allowed.map((t) => EXTENSION[t]?.toUpperCase()).join(", ");
    return `This file type isn't allowed here. Please upload ${names}.`;
  }
  if (file.size > rule.maxMB * 1024 * 1024) {
    return `This file is too large. The limit is ${rule.maxMB} MB.`;
  }
  return null;
}

function fileName(file: File): string {
  return `${crypto.randomUUID()}.${EXTENSION[file.type]}`;
}

function storageError(message: string, kind: UploadKind): string {
  const m = String(message ?? "").toLowerCase();
  if (m.includes("row-level security") || m.includes("unauthorized") || m.includes("not allowed") || m.includes("403")) {
    if (kind === "resourcePhoto") return "Only the resource's owner or an admin can add photos.";
    if (kind === "conditionPhoto") return "You can add photos only to an approved or active booking you're part of.";
    return "You can upload certificates only for your own account.";
  }
  if (m.includes("exceeded") || m.includes("too large") || m.includes("payload")) return "This file is too large.";
  if (m.includes("mime") || m.includes("invalid_mime_type")) return "This file type isn't allowed here.";
  return "Upload failed. Please try again.";
}

async function put(kind: UploadKind, path: string, file: File): Promise<Result<{ path: string }>> {
  const db = await getDb();
  const { error } = await db.storage.from(UPLOADS[kind].bucket).upload(path, file, { contentType: file.type, upsert: false });
  if (error) return fail(storageError(error.message, kind));
  return ok({ path });
}

// Owner or admin adds a photo to a resource listing.
// Save `path` in resources.photos (A's table stores paths). `url` is for showing it right away.
export async function uploadResourcePhoto(
  resourceId: string,
  formData: FormData,
): Promise<Result<{ path: string; url: string }>> {
  if (badId(resourceId)) return fail("Unknown resource.");
  const file = getFile(formData);
  if (!file) return fail("Please choose a file.");
  const problem = checkFile("resourcePhoto", file);
  if (problem) return fail(problem);

  const result = await put("resourcePhoto", `${resourceId}/${fileName(file)}`, file);
  if (!result.ok) return result;
  return ok({ path: result.data.path, url: resourcePhotoUrl(result.data.path) });
}

// Check-in, return and incident photos (images only), into condition-photos/<bookingId>/.
// Pass the returned paths to saveConditionReport(...) or openIncident(...);
// A's functions refuse paths outside <bookingId>/.
export async function uploadEvidencePhoto(
  bookingId: string,
  formData: FormData,
): Promise<Result<{ path: string }>> {
  if (badId(bookingId)) return fail("Unknown booking.");
  const file = getFile(formData);
  if (!file) return fail("Please choose a photo.");
  const problem = checkFile("conditionPhoto", file);
  if (problem) return fail(problem);

  return put("conditionPhoto", `${bookingId}/${fileName(file)}`, file);
}

// Student uploads a certificate and submits it for the Tier 2 badge in one step:
// upload to certificates/<own user id>/, then A's submit_certificate records it and
// notifies the resource's manager. Returns the user_badges id for the review screen.
export async function submitCertificate(
  badgeId: string,
  formData: FormData,
): Promise<Result<{ userBadgeId: string; path: string }>> {
  if (badId(badgeId)) return fail("Unknown badge.");
  const db = await getDb();
  const userId = await currentUserId(db);
  if (!userId) return fail("Please log in first.");

  const file = getFile(formData);
  if (!file) return fail("Please choose a file.");
  const problem = checkFile("certificate", file);
  if (problem) return fail(problem);

  const uploaded = await put("certificate", `${userId}/${fileName(file)}`, file);
  if (!uploaded.ok) return uploaded;

  const { data, error } = await db.rpc("submit_certificate", { p_badge_id: badgeId, p_file_path: uploaded.data.path });
  if (error) return failFrom(error);
  return ok({ userBadgeId: data as string, path: uploaded.data.path });
}

// ---- Showing private files (links last 1 hour) ----
// A's storage rules decide who may open them: borrower, supervisor and manager for condition
// photos; the student and the reviewing manager for certificates.

async function signed(bucket: string, path: string, error: string): Promise<Result<{ url: string }>> {
  const db = await getDb();
  const { data, error: e } = await db.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (e || !data?.signedUrl) return fail(error);
  return ok({ url: data.signedUrl as string });
}

// One check-in, return or incident photo.
export async function getConditionPhotoUrl(path: string): Promise<Result<{ url: string }>> {
  if (!CONDITION_PHOTO_PATH.test(path)) return fail("Unknown photo.");
  return signed(UPLOADS.conditionPhoto.bucket, path, "You don't have permission to view this photo.");
}

// Several photos at once (e.g. check-in and return photos side by side).
export async function getConditionPhotoUrls(paths: string[]): Promise<Result<{ path: string; url: string | null }[]>> {
  const valid = (Array.isArray(paths) ? paths : []).filter((p) => CONDITION_PHOTO_PATH.test(p));
  if (valid.length === 0) return ok([]);
  const db = await getDb();
  const { data, error } = await db.storage.from(UPLOADS.conditionPhoto.bucket).createSignedUrls(valid, 60 * 60);
  if (error || !data) return fail("You don't have permission to view these photos.");
  return ok(
    (data as { path: string | null; signedUrl: string; error: string | null }[]).map((d) => ({
      path: d.path ?? "",
      url: d.error ? null : d.signedUrl,
    })),
  );
}

// A submitted certificate (the student's own, or for the reviewing manager).
export async function getCertificateUrl(path: string): Promise<Result<{ url: string }>> {
  if (!CERTIFICATE_PATH.test(path)) return fail("Unknown file.");
  return signed(UPLOADS.certificate.bucket, path, "You don't have permission to view this certificate.");
}
