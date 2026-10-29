// LabPass app-side settings — Member B. Repo path: lib/config.ts
//
// Agreed at the hour-4 sync: business rules (booking limits, credits, timings, graduation,
// no-show limits, priority weights) live ONLY in the database, in A's labpass_config().
// Read them in code with getRules() from lib/rules.ts. Never copy those numbers here.
//
// Status and enum types (booking_status, incident_decision, ...) come from A's generated
// lib/supabase/types.ts. Don't redefine them here.
//
// This file keeps only settings the database doesn't hold: upload limits and bucket names.

// Matches A's storage buckets (supabase/migrations/..._04_security.sql and ..._05_...).
// The buckets are the hard limit; these values let us give a clear message first.
// Paths are stored WITHOUT the bucket name:
//   resource-photos  (public):  <resource_id>/<file>
//   condition-photos (private): <booking_id>/<file>   check-in, return and incident photos (images only)
//   certificates     (private): <user_id>/<file>
export const UPLOADS = {
  resourcePhoto: {
    bucket: "resource-photos",
    maxMB: 10,
    types: ["image/jpeg", "image/png", "image/webp"],
  },
  conditionPhoto: {
    bucket: "condition-photos",
    maxMB: 10,
    types: ["image/jpeg", "image/png", "image/webp"],
  },
  certificate: {
    bucket: "certificates",
    maxMB: 10,
    types: ["application/pdf", "image/jpeg", "image/png", "image/webp"],
  },
} as const;
