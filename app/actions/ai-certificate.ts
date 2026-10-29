"use server";
// Certificate review (FR-08): read an uploaded certificate, extract details, flag mismatches.
// Screen: manager certificate review (C). The MANAGER approves or rejects the badge; the AI only suggests.
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

/**
 * @param userId       the student who uploaded the certificate (profiles.id)
 * @param filePath     path inside the private "certificates" bucket, e.g. "<userId>/first-aid.pdf"
 * @param resourceName the resource the badge is for, e.g. "3D printer"
 */
export async function reviewCertificate(
  userId: string,
  filePath: string,
  resourceName: string
): Promise<CertificateReview> {
  await requireRole(["manager", "admin"]);
  const fail = (note: string): CertificateReview => ({ ok: false, extracted: null, mismatches: [], note, label: AI_LABEL });

  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const mediaType = MEDIA_TYPES[ext];
  if (!mediaType) return fail("Unsupported file type — review manually (use PDF, PNG or JPG).");

  const db = createAdminClient();
  const [{ data: profile }, { data: file, error }] = await Promise.all([
    db.from("profiles").select("name").eq("id", userId).single(),
    db.storage.from("certificates").download(filePath),
  ]);
  if (error || !file) return fail("Could not open the certificate file — review manually.");

  const bytes = new Uint8Array(await file.arrayBuffer());
  const res = await runAi({
    feature: "certificate",
    refId: userId,
    schema,
    system:
      "You read training certificates for a university lab. Extract only what is printed. " +
      "Use null for anything you cannot read clearly. Never guess names or dates.",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `Extract the details. Is this training relevant to safely using: ${resourceName}?` },
          mediaType === "application/pdf"
            ? { type: "file", data: bytes, mediaType }
            : { type: "image", image: bytes, mediaType },
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
  return { ok: true, extracted: x, mismatches, note, label: AI_LABEL };
}
