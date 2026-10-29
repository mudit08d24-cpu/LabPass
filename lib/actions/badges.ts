"use server";

// Quiz, certificates and graduation — Member B. Repo path: lib/actions/badges.ts
// Each action calls one of A's database functions (labpass_schema.sql).
// Certificate upload + submit is submitCertificate in lib/actions/uploads.ts.

import { rpc, badId, needsReason, text, fail, ok } from "@/lib/actions/db";
import type { Result } from "@/lib/actions/errors";

export type QuizForStudent = {
  quizId: string;
  passMark: number; // percentage, 80 = 4 of 5
  questions: { id: string; text: string; options: string[] }[]; // no answers
};

// FR-07: the quiz for a Tier 1 resource, without the answers. null if the resource has no quiz.
export async function getQuiz(resourceId: string): Promise<Result<QuizForStudent | null>> {
  if (badId(resourceId)) return fail("Unknown resource.");
  const res = await rpc<{ quiz_id: string; pass_mark: number; questions: { id: string; text: string; options: string[] }[] } | null>(
    "get_quiz",
    { p_resource: resourceId },
  );
  if (!res.ok) return res;
  if (!res.data) return ok(null);
  return ok({ quizId: res.data.quiz_id, passMark: Number(res.data.pass_mark), questions: res.data.questions ?? [] });
}

export type QuizResult = { correct: number; total: number; score: number; passed: boolean };

// Graded inside the database. answers = { "<question id>": "<chosen option's text>" }.
// Passing awards the Tier 1 badge for this resource.
export async function submitQuiz(resourceId: string, answers: Record<string, string>): Promise<Result<QuizResult>> {
  if (badId(resourceId)) return fail("Unknown resource.");
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return fail("Please answer the questions.");
  const clean: Record<string, string> = {};
  for (const [id, value] of Object.entries(answers)) if (typeof value === "string") clean[id] = value;
  if (Object.keys(clean).length === 0) return fail("Please answer the questions.");
  const res = await rpc<QuizResult>("submit_quiz", { p_resource: resourceId, p_answers: clean });
  if (!res.ok) return res;
  const d = res.data!;
  return ok({ correct: Number(d.correct), total: Number(d.total), score: Number(d.score), passed: d.passed === true });
}

// FR-08: manager approves or rejects a submitted certificate (reason required to reject).
export async function decideCertificate(
  userBadgeId: string,
  decision: "approved" | "rejected",
  reason?: string,
): Promise<Result<null>> {
  if (badId(userBadgeId)) return fail("Unknown certificate.");
  if (decision !== "approved" && decision !== "rejected") return fail("Unknown decision.");
  if (decision === "rejected") {
    const missing = needsReason(reason, "reject this certificate");
    if (missing) return missing;
  }
  return rpc("decide_certificate", { p_user_badge_id: userBadgeId, p_decision: decision, p_reason: text(reason) || null });
}

export type GraduationProgress = { cleanSessions: number; required: number; graduated: boolean; readyForSignoff: boolean };

// FR-18 / FR-27: clean supervised sessions so far. userId only for managers looking at a student.
export async function getGraduationProgress(resourceId: string, userId?: string): Promise<Result<GraduationProgress>> {
  if (badId(resourceId)) return fail("Unknown resource.");
  if (userId && badId(userId)) return fail("Unknown student.");
  const res = await rpc<{ clean_supervised_sessions: number; required: number; graduated: boolean; ready_for_signoff: boolean }>(
    "graduation_progress",
    { p_resource: resourceId, p_user: userId ?? null },
  );
  if (!res.ok) return res;
  const d = res.data!;
  return ok({
    cleanSessions: Number(d.clean_supervised_sessions),
    required: Number(d.required),
    graduated: d.graduated === true,
    readyForSignoff: d.ready_for_signoff === true,
  });
}

// Manager signs off a student from Tier 3 (supervised) to Tier 2 (independent) on one resource.
export async function graduateStudent(userId: string, resourceId: string, reason: string): Promise<Result<null>> {
  if (badId(userId)) return fail("Unknown student.");
  if (badId(resourceId)) return fail("Unknown resource.");
  const missing = needsReason(reason, "graduate this student");
  if (missing) return missing;
  return rpc("graduate_student", { p_user: userId, p_resource: resourceId, p_reason: text(reason) });
}
