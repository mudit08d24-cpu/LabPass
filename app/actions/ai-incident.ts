"use server";
// Incident summary + photo comparison (PRD AI features). Screen: the staff incident page (IncidentView).
// The AI reads the report and compares check-in photos with return photos. It only suggests:
// the manager still decides with B's decideIncident. Saved with A's save_incident_ai (labelled, audited).
import { z } from "zod";
import { runAi, AI_LABEL } from "@/lib/ai";
import { requireRole } from "@/lib/auth";
import { UPLOADS } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  summary: z.string().describe("Neutral 2-4 sentence summary of what was reported and what the evidence shows. No blame, no penalty advice."),
  differences: z.array(z.string()).max(8).describe("Visible differences between check-in and return photos, one short line each. Empty if none or no photos."),
});

export type IncidentAiResult = { ok: boolean; note: string; label: string };

const MAX_PHOTOS_PER_SET = 2; // keeps the request small and fast
const MEDIA: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

export async function summarizeIncident(incidentId: string): Promise<IncidentAiResult> {
  const fail = (note: string): IncidentAiResult => ({ ok: false, note, label: AI_LABEL });
  try {
    await requireRole(["manager", "admin"]);
  } catch {
    return fail("Only lab staff can run the AI summary.");
  }

  // Read as the signed-in user first: row-level security only returns incidents this person may see.
  const userDb = await createClient();
  const { data: inc } = await userDb
    .from("incidents")
    .select("id, booking_id, type, description, photo_urls")
    .eq("id", incidentId)
    .maybeSingle();
  if (!inc) return fail("Incident not found, or you don't have access to it.");

  const db = createAdminClient(); // private photo bucket + A's service-role-only save_incident_ai
  const { data: reports } = await db.from("condition_reports").select("stage, photo_urls, notes, checklist").eq("booking_id", inc.booking_id);
  const { data: booking } = await db.from("bookings").select("resources(name)").eq("id", inc.booking_id).maybeSingle();
  const resourceName = (booking as { resources?: { name?: string } } | null)?.resources?.name ?? "the resource";

  type Rep = { stage: string; photo_urls: string[] | null; notes: string | null; checklist: unknown };
  const reps = (reports ?? []) as Rep[];
  const photosOf = (stage: string) => reps.filter((r) => r.stage === stage).flatMap((r) => r.photo_urls ?? []).slice(0, MAX_PHOTOS_PER_SET);
  const sets: { label: string; paths: string[] }[] = [
    { label: "CHECK-IN photo", paths: photosOf("check_in") },
    { label: "RETURN photo", paths: photosOf("return") },
    { label: "INCIDENT photo", paths: ((inc.photo_urls ?? []) as string[]).slice(0, MAX_PHOTOS_PER_SET) },
  ];

  const content: ({ type: "text"; text: string } | { type: "image"; image: Uint8Array; mediaType: string })[] = [
    {
      type: "text",
      text:
        `Resource: ${resourceName}\nIncident type: ${inc.type}\nReport: ${inc.description}\n` +
        `Condition notes: ${JSON.stringify(reps.map((r) => ({ stage: r.stage, notes: r.notes, checklist: r.checklist })))}`,
    },
  ];
  let photoCount = 0;
  for (const set of sets) {
    for (const path of set.paths) {
      const mediaType = MEDIA[path.split(".").pop()?.toLowerCase() ?? ""];
      if (!mediaType) continue;
      const { data: file } = await db.storage.from(UPLOADS.conditionPhoto.bucket).download(path);
      if (!file) continue;
      content.push({ type: "text", text: `${set.label}:` });
      content.push({ type: "image", image: new Uint8Array(await (file as Blob).arrayBuffer()), mediaType });
      photoCount++;
    }
  }

  const res = await runAi({
    feature: "incident_summary",
    refId: incidentId,
    schema,
    system:
      "You help a university lab manager review an equipment incident. Write a neutral summary of the report and evidence. " +
      "Compare CHECK-IN photos with RETURN photos and list only differences you can actually see. " +
      "Never decide who is at fault and never suggest a penalty. If there are no photos to compare, return an empty differences list.",
    messages: [{ role: "user", content }],
  });
  if (!res.ok) return fail("AI unavailable. Review the evidence yourself.");

  const { error } = await db.rpc("save_incident_ai", {
    p_incident_id: incidentId,
    p_summary: res.data.summary,
    p_photo_diff: { differences: res.data.differences, photos_compared: photoCount, label: AI_LABEL },
  });
  if (error) {
    console.error("[ai:incident_summary] could not save", error);
    return fail("The AI summary could not be saved. Try again.");
  }
  return { ok: true, note: "Summary added.", label: AI_LABEL };
}
