"use server";
// Smart matching (FR-06): student describes a need in free text -> ranked resources with a reason each.
// Screen: student browse page (C). The student chooses; the AI only suggests.
import { z } from "zod";
import { runAi, AI_LABEL } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  items: z
    .array(z.object({ resourceId: z.string(), reason: z.string() }))
    .max(5),
});

export type MatchResult = {
  ok: boolean;
  items: { resourceId: string; name: string; reason: string }[];
  label: string;
};

export async function matchResources(need: string): Promise<MatchResult> {
  const text = need.trim().slice(0, 500);
  if (!text) return { ok: false, items: [], label: AI_LABEL };

  // Signed-in users only (each call uses Gemini quota). Reads run as the user, so RLS applies.
  const db = await createClient();
  const { data: auth } = await db.auth.getUser();
  if (!auth.user) return { ok: false, items: [], label: AI_LABEL };
  const { data, error } = await db
    .from("resources")
    .select("id, name, type, tier, location")
    .eq("status", "active");
  if (error) console.error("[matchResources] could not load resources", error);
  type Res = { id: string; name: string; type: string; tier: number; location: string | null };
  const resources: Res[] = (data ?? []) as Res[];
  if (resources.length === 0) return { ok: false, items: [], label: AI_LABEL };

  const res = await runAi({
    feature: "smart_match",
    schema,
    system:
      "You help university students find lab resources. Pick up to 5 resources from the list that fit the need, best first. " +
      "Give each a one-sentence reason in plain English. Only use ids from the list. If nothing fits, return an empty list.",
    messages: [
      {
        role: "user",
        content: `Need: ${text}\n\nResources:\n${JSON.stringify(resources)}`,
      },
    ],
  });

  const byId = new Map(resources.map((r) => [r.id as string, r]));

  // Fallback: simple keyword match so the screen still shows something if the AI fails
  if (!res.ok) {
    const words = text.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    const items = resources
      .filter((r) =>
        words.some((w) => `${r.name} ${r.type}`.toLowerCase().includes(w))
      )
      .slice(0, 5)
      .map((r) => ({ resourceId: r.id as string, name: r.name as string, reason: "Keyword match" }));
    return { ok: false, items, label: AI_LABEL };
  }

  const items = res.data.items
    .filter((i) => byId.has(i.resourceId)) // drop any made-up ids
    .map((i) => ({
      resourceId: i.resourceId,
      name: byId.get(i.resourceId)!.name as string,
      reason: i.reason,
    }));
  return { ok: true, items, label: AI_LABEL };
}
