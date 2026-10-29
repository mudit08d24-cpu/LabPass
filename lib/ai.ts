import "server-only";
import { generateText, Output, type ModelMessage } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

// Every AI feature goes through runAi(), so timeout, fallback and label live in one place.
// Rules (PRD): every output is labelled, stored for audit, and never changes a booking by itself.

export const AI_LABEL = "AI suggestion — needs review";

// Gemini model (reads text, images and PDFs). Check aistudio.google.com for the newest "Flash" name.
const MODEL = google(process.env.GEMINI_MODEL || "gemini-3.7-flash"); // change model in .env.local, not here
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 20_000; // set AI_TIMEOUT_MS in .env.local
export type AiResult<T> =
  | { ok: true; data: T; label: string }
  | { ok: false; data: null; label: string; error: string };

export async function runAi<T>(opts: {
  feature: string; // e.g. "smart_match", "certificate", "photo_diff", "incident_summary"
  refId?: string; // booking / incident / user id this output relates to
  schema: z.ZodType<T>; // the exact shape the answer must have
  system: string; // instructions for the model
  messages: ModelMessage[]; // the data (text and/or images)
}): Promise<AiResult<T>> {
  try {
    const { output } = await generateText({
      model: MODEL,
      system: opts.system,
      messages: opts.messages,
      output: Output.object({ schema: opts.schema }),
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      maxRetries: 1,
    });
    if (output == null) throw new Error("Model returned no structured output");
    await saveAiOutput(opts.feature, opts.refId, output);
    return { ok: true, data: output as T, label: AI_LABEL };
  } catch (err) {
    console.error(`[ai:${opts.feature}] failed`, err);
    // On your laptop (npm run dev) show the real reason; on the live site keep it generic.
    const detail =
      process.env.NODE_ENV === "development" && err instanceof Error
        ? `: ${err.message}`
        : "";
    return {
      ok: false,
      data: null,
      label: AI_LABEL,
      error: `AI unavailable${detail}`,
    };
  }
}

async function saveAiOutput(
  feature: string,
  refId: string | undefined,
  output: unknown,
) {
  try {
    await createAdminClient()
      .from("ai_outputs")
      .insert({ feature, ref_id: refId ?? null, output });
  } catch (e) {
    console.error("[ai] could not store output", e); // never break the flow
  }
}
