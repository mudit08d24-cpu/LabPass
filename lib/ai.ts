import "server-only";
import { generateText, Output, type ModelMessage } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

// Every AI feature goes through runAi(), so timeout, fallback and label live in one place.
// Rules (PRD): every output is labelled, stored for audit, and never changes a booking by itself.

export const AI_LABEL = "AI suggestion — needs review";

// Gemini model (reads text, images and PDFs). Check aistudio.google.com for the newest "Flash" name.
const MODEL_NAME = process.env.GEMINI_MODEL || "gemini-3.7-flash"; // change model in .env.local / Vercel, not here
const MODEL = google(MODEL_NAME);
// Images and PDFs plus structured output can take 20–40 s; 20 s was too short (every call timed out).
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS) || 50_000; // set AI_TIMEOUT_MS to override

// Less "thinking" = much faster answers; these are short extraction/summary tasks.
// Gemini 2.5 takes a token budget (0 = off); Gemini 3 and later take a level.
const FAST_THINKING = /gemini-2\./.test(MODEL_NAME)
  ? { google: { thinkingConfig: { thinkingBudget: 0 } } }
  : { google: { thinkingConfig: { thinkingLevel: "low" as const } } };

function isTimeout(err: unknown) {
  return err instanceof Error && /timeout|abort/i.test(`${err.name} ${err.message}`);
}
export type AiResult<T> =
  | { ok: true; data: T; label: string }
  | { ok: false; data: null; label: string; error: string };

export async function runAi<T>(opts: {
  feature: string; // e.g. "smart_match", "certificate", "photo_diff", "incident_summary"
  refId?: string; // booking / incident / user id this output relates to
  schema: z.ZodType<T>; // the exact shape the answer must have
  system: string; // instructions for the model
  messages: ModelMessage[]; // the data (text and/or images)
  timeoutMs?: number; // per-feature override
}): Promise<AiResult<T>> {
  const deadline = Date.now() + (opts.timeoutMs ?? TIMEOUT_MS);
  const call = (fast: boolean) =>
    generateText({
      model: MODEL,
      system: opts.system,
      messages: opts.messages,
      output: Output.object({ schema: opts.schema }),
      abortSignal: AbortSignal.timeout(Math.max(1_000, deadline - Date.now())),
      maxRetries: 0,
      ...(fast ? { providerOptions: FAST_THINKING } : {}),
    });
  try {
    let result;
    try {
      result = await call(true);
    } catch (err) {
      // A model that rejects the thinking setting answers fine without it; a timeout won't improve.
      if (isTimeout(err)) throw err;
      console.warn(`[ai:${opts.feature}] retrying without thinking settings`, err instanceof Error ? err.message : err);
      result = await call(false);
    }
    const { output } = result;
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
