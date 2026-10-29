"use client";

// Tier 1 quiz (API.md "Quiz, certificates and graduation"): answers are sent as
// { questionId: chosen option TEXT }; score and passMark are percentages.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, buttonVariants } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, type QuizResult } from "@/lib/screens";
import { useQuery } from "@/lib/screens/use-query";
import { cn } from "@/lib/utils";

export default function QuizPage() {
  const { resourceId } = useParams<{ resourceId: string }>();
  const toast = useToast();
  const quiz = useQuery(() => api.getQuiz(resourceId), [resourceId]);
  const res = useQuery(() => api.getResource(resourceId), [resourceId]);
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (quiz.error || res.error) return <ErrorBlock message={quiz.error ?? res.error ?? ""} onRetry={quiz.reload} />;
  if (quiz.loading || res.loading || !res.data) return <LoadingBlock />;
  const r = res.data;
  const q = quiz.data;
  if (!q || !q.questions.length) {
    return (
      <EmptyState
        title="No quiz for this resource"
        body={`${r.name} doesn't use a quiz. Check the resource page for what you need.`}
        action={
          <Link href={`/resources/${r.id}`} className={buttonVariants({ variant: "outline" })}>
            Back to {r.name}
          </Link>
        }
      />
    );
  }
  const cur = q.questions[step];
  const answered = q.questions.filter((x) => answers[x.id] !== undefined).length;
  const needed = Math.ceil((q.passMark / 100) * q.questions.length);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    const out = await api.submitQuiz(resourceId, answers);
    setBusy(false);
    if (!out.ok) return setErr(out.error);
    setResult(out.data);
    if (out.data.passed) toast.success("Tier 1 badge earned", `${r.name} safety quiz: ${out.data.correct}/${out.data.total}`);
  };

  if (result) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className={cn("paper p-6 text-center sm:p-8", result.passed ? "bg-mint" : "bg-peach")}>
          <p className="font-hand text-lg">{result.passed ? "nice work" : "almost there"}</p>
          <p className="font-display text-6xl font-extrabold">
            {result.correct}/{result.total}
          </p>
          <p className="mt-1 text-sm font-semibold">{Math.round(result.score)}%</p>
          <h1 className="mt-2 text-2xl font-extrabold">{result.passed ? `You earned the ${r.name} Tier 1 badge` : `You need ${q.passMark}% (${needed} of ${q.questions.length}) to pass`}</h1>
          <p className="mt-2 text-sm text-ink/75">{result.passed ? "It's on your skills passport now." : "Read the questions again and retry. There's no limit on attempts."}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {result.passed ? (
              <>
                <Link href={`/book/${r.id}`} className={buttonVariants({ size: "lg" })}>
                  Request a slot
                </Link>
                <Link href="/passport" className={buttonVariants({ size: "lg", variant: "outline" })}>
                  View passport
                </Link>
              </>
            ) : (
              <Button
                size="lg"
                onClick={() => {
                  setResult(null);
                  setAnswers({});
                  setStep(0);
                }}
              >
                Try again
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: `/resources/${r.id}`, label: r.name }} eyebrow="Tier 1 safety quiz" title={r.name} description={`${q.questions.length} questions. Pass with ${q.passMark}% (${needed} correct).`} />
      <div className="paper p-5 sm:p-7">
        <div className="flex items-center justify-between text-[13px] font-semibold">
          <span>
            Question {step + 1} of {q.questions.length}
          </span>
          <span className="text-mute">{answered} answered</span>
        </div>
        <Progress value={(step + 1) / q.questions.length} className="mt-2" label="Quiz progress" />
        <fieldset className="mt-6">
          <legend className="font-display text-xl font-bold leading-snug">{cur.text}</legend>
          <div className="mt-4 grid gap-2.5" role="radiogroup">
            {cur.options.map((o, i) => {
              const sel = answers[cur.id] === o;
              return (
                <button
                  key={o}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  onClick={() => setAnswers({ ...answers, [cur.id]: o })}
                  className={cn("flex items-center gap-3 rounded-xl border-2 border-ink px-4 py-3 text-left text-[15px] transition-colors", sel ? "bg-ink text-paper" : "bg-white hover:bg-sun-soft")}
                >
                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border-2 font-display text-[12px] font-bold", sel ? "border-sun bg-sun text-ink" : "border-ink")}>{String.fromCharCode(65 + i)}</span>
                  {o}
                </button>
              );
            })}
          </div>
        </fieldset>
        {err && (
          <p role="alert" className="mt-4 rounded-xl border-2 border-ink bg-coral px-4 py-2.5 text-sm font-medium">
            {err}
          </p>
        )}
        <div className="mt-6 flex justify-between gap-2">
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
            ← Back
          </Button>
          {step < q.questions.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={answers[cur.id] === undefined}>
              Next →
            </Button>
          ) : (
            <Button onClick={submit} loading={busy} disabled={answered < q.questions.length}>
              Submit answers
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
