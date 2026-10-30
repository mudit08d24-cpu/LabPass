"use server";
// Certificate review (FR-08): read an uploaded certificate, extract details, flag mismatches.
// Screen: /manage/certificates/<user_badge_id> (C). The MANAGER approves or rejects with B's
// decideCertificate; the AI only suggests. The result is also saved to user_badges.ai_extraction.
import { z } from "zod";
import { runAi, AI_LABEL } from "@/lib/ai";
import { requireRole } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  name: z.string().nullable().describe("Person's name exactly as printed, or null"),
  course: z.string().nullable().describe("Course or training title, or null"),
  issuer: z.string().nullable().describe("Organisation that issued it, or null"),
  date: z.string().nullable().describe("Issue date as YYYY-MM-DD if readable, else null"),
  relevantToResource: z.boolean().describe("Does this training plausibly cover safe use of the resource?"),
});

export type CertificateReview = {
  ok: boolean;
  extracted: z.infer<typeof schema> | null;
  mismatches: string[];
  note: string;
  label: string;
};

const MEDIA_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

/** @param userBadgeId user_badges.id — the certificate submission (from B's submitCertificate). */
export async function reviewCertificate(userBadgeId: string): Promise<CertificateReview> {
  await requireRole(["manager", "admin"]);
  const fail = (note: string): CertificateReview => ({ ok: false, extracted: null, mismatches: [], note, label: AI_LABEL });

  // Service-role client: certificates are private. Access is limited by requireRole above.
  const db = createAdminClient();
  const { data: ub } = await db
    .from("user_badges")
    .select("id, user_id, evidence_url, badge_id")
    .eq("id", userBadgeId)
    .single();
  if (!ub?.evidence_url) return fail("No certificate file found for this request — review manually.");

  const { data: badge } = await db.from("badges").select("name, resource_id").eq("id", ub.badge_id).single();
  const [{ data: resource }, { data: profile }] = await Promise.all([
    badge?.resource_id
      ? db.from("resources").select("name").eq("id", badge.resource_id).single()
      : Promise.resolve({ data: null }),
    db.from("profiles").select("name").eq("id", ub.user_id).single(),
  ]);
  const resourceName: string = resource?.name ?? badge?.name ?? "this resource";

  const filePath: string = ub.evidence_url;
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const mediaType = MEDIA_TYPES[ext];
  if (!mediaType) return fail("Unsupported file type — review manually (PDF, PNG, JPG or WEBP).");

  const { data: file, error } = await db.storage.from("certificates").download(filePath);
  if (error || !file) return fail("Could not open the certificate file — review manually.");
  const bytes = new Uint8Array(await (file as Blob).arrayBuffer());

  const res = await runAi({
    feature: "certificate",
    refId: userBadgeId,
    schema,
    system:
      "You read training certificates for a university lab. Extract only what is printed. " +
      "Use null for anything you cannot read clearly. Never guess names or dates.",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `Extract the details. Is this training relevant to safely using: ${resourceName}?` },
          { type: "file", data: bytes, mediaType }, // PDFs and images both go as file parts
        ],
      },
    ],
  });
  if (!res.ok) return fail("AI unavailable — review the certificate manually.");

  // Mismatch checks are plain code, not AI, so they are predictable.
  const x = res.data;
  const mismatches: string[] = [];
  const profileName = (profile?.name as string | undefined)?.trim();
  if (profileName && x.name) {
    const first = profileName.toLowerCase().split(/\s+/)[0];
    if (!x.name.toLowerCase().includes(first))
      mismatches.push(`Name on certificate ("${x.name}") may not match profile ("${profileName}")`);
  }
  if (x.date) {
    const d = new Date(x.date);
    if (!isNaN(d.getTime()) && d > new Date()) mismatches.push("Certificate date is in the future");
  }
  if (!x.relevantToResource) mismatches.push(`Course may not cover ${resourceName}`);
  if (!x.name || !x.date) mismatches.push("Some details could not be read");

  const note = mismatches.length ? `Check: ${mismatches.join("; ")}.` : "No mismatches found.";
  const review: CertificateReview = { ok: true, extracted: x, mismatches, note, label: AI_LABEL };

  // Keep the suggestion with the request so the review page can show it again. Never changes status.
  await db.from("user_badges").update({ ai_extraction: { ...x, mismatches, note, label: AI_LABEL } }).eq("id", userBadgeId);
  return review;
}
