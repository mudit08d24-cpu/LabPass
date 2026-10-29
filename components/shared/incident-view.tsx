"use client";

// One incident, shown three ways (API.md "Incidents"):
//  - student (the booking's owner): respond, or dispute a decision
//  - staff (manager/owner of the resource): start review → decide with a reason (+ penalty/block),
//    optionally put the resource under maintenance, close once decided
//  - admin: resolve a dispute (upheld / overturned) with a reason

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { latestReports, PhotoStrip, ReportCard } from "@/components/shared/report-card";
import { AiSuggestion, ErrorBlock, IncidentBadge, LoadingBlock, Notice, PageHeader, Section, SlotText } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, type DisputeOutcome, type Incident, type IncidentDecision } from "@/lib/screens";
import { useQuery } from "@/lib/screens/use-query";
import { cn, fmtDateTime } from "@/lib/utils";

export type IncidentMode = "student" | "staff" | "admin" | "viewer";

export const DECISION_LABEL: Record<IncidentDecision, string> = {
  no_action: "No action",
  warning: "Warning",
  credit_penalty: "Credit penalty",
  temporary_block: "Temporary block",
};

const OPTIONS: { v: IncidentDecision; d: string }[] = [
  { v: "no_action", d: "Wear and tear, or not the student's doing" },
  { v: "warning", d: "Recorded on their history, no penalty" },
  { v: "credit_penalty", d: "Take credits from the student" },
  { v: "temporary_block", d: "Pause their booking for 1–30 days" },
];

function Err({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <p role="alert" className="rounded-xl border-2 border-ink bg-coral px-3 py-2 text-sm font-medium">
      {msg}
    </p>
  );
}

function DecisionSummary({ i }: { i: Incident }) {
  if (!i.decision) return <p className="text-sm text-mute">{i.status === "under_review" ? "The lab manager is reviewing it now." : "Not decided yet. A notification with the reason follows."}</p>;
  return (
    <div className="grid gap-2">
      <p className="font-display text-2xl font-bold">{DECISION_LABEL[i.decision]}</p>
      {i.penaltyCredits ? <p className="text-sm">−{i.penaltyCredits} credits</p> : null}
      {i.blockUntil && <p className="text-sm">Booking paused until {fmtDateTime(i.blockUntil)}</p>}
      {i.reason && <p className="rounded-lg bg-paper-2 px-3 py-2 text-[15px]">“{i.reason}”</p>}
      {i.disputeOutcome && (
        <Notice tone={i.disputeOutcome === "overturned" ? "ok" : "info"}>
          <b>Admin {i.disputeOutcome === "overturned" ? "overturned" : "upheld"} the decision.</b> {i.resolutionReason}
          {i.disputeOutcome === "overturned" && " Any penalty was refunded and any block lifted."}
        </Notice>
      )}
    </div>
  );
}

function StaffPanel({ i }: { i: Incident }) {
  const toast = useToast();
  const ids = { r: useId(), p: useId(), d: useId(), m: useId() };
  const [decision, setDecision] = useState<IncidentDecision>("no_action");
  const [reason, setReason] = useState("");
  const [penalty, setPenalty] = useState(2);
  const [days, setDays] = useState(7);
  const [maint, setMaint] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const r = i.booking.resource;

  if (i.status === "open") {
    return (
      <div className="paper grid gap-3 p-5">
        <p className="font-display text-xl font-bold">New report</p>
        <p className="text-sm text-ink/80">Start the review to lock it in, then record a decision with a reason the student will see.</p>
        <Err msg={err} />
        <Button
          size="lg"
          loading={busy === "start"}
          onClick={async () => {
            setBusy("start");
            const out = await api.startIncidentReview(i.id);
            setBusy(null);
            if (!out.ok) setErr(out.error);
          }}
        >
          Start review
        </Button>
      </div>
    );
  }

  if (i.status === "under_review") {
    return (
      <form
        className="paper grid gap-4 p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (reason.trim().length < 5) return setErr("Every decision needs a reason the student will see.");
          setErr(null);
          setBusy("decide");
          const out = await api.decideIncident(i.id, decision, reason.trim(), {
            penaltyCredits: decision === "credit_penalty" ? penalty : undefined,
            blockDays: decision === "temporary_block" ? days : undefined,
          });
          if (out.ok && maint && r.status !== "maintenance") {
            const m = await api.setResourceStatus(r.id, "maintenance", `Incident: ${reason.trim()}`);
            if (!m.ok) toast.error("Decision saved, maintenance not set", m.error);
          }
          setBusy(null);
          if (!out.ok) return setErr(out.error);
          toast.success("Decision recorded", "The student can respond or dispute it.");
        }}
      >
        <p className="font-display text-xl font-bold">Your decision</p>
        <fieldset>
          <legend className="sr-only">Outcome</legend>
          <div className="grid gap-2" role="radiogroup">
            {OPTIONS.map((o) => (
              <button key={o.v} type="button" role="radio" aria-checked={decision === o.v} onClick={() => setDecision(o.v)} className={cn("rounded-xl border-2 border-ink px-3 py-2 text-left", decision === o.v ? "bg-ink text-paper" : "bg-white hover:bg-sun-soft")}>
                <span className="block text-sm font-semibold">{DECISION_LABEL[o.v]}</span>
                <span className={cn("block text-[12px]", decision === o.v ? "text-paper/70" : "text-mute")}>{o.d}</span>
              </button>
            ))}
          </div>
        </fieldset>
        {decision === "credit_penalty" && (
          <Field id={ids.p} label="Credits to take">
            <Input id={ids.p} type="number" min={1} value={penalty} onChange={(e) => setPenalty(Math.max(1, Math.round(+e.target.value)))} />
          </Field>
        )}
        {decision === "temporary_block" && (
          <Field id={ids.d} label="Days to pause booking" hint="1 to 30 days">
            <Input id={ids.d} type="number" min={1} max={30} value={days} onChange={(e) => setDays(Math.min(30, Math.max(1, Math.round(+e.target.value))))} />
          </Field>
        )}
        <Field id={ids.r} label="Reason">
          <Textarea id={ids.r} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What you found and why this outcome" />
        </Field>
        {r.status !== "maintenance" && (
          <label className="flex items-start gap-2.5 text-sm" htmlFor={ids.m}>
            <input id={ids.m} type="checkbox" checked={maint} onChange={(e) => setMaint(e.target.checked)} className="mt-0.5 size-4 accent-[#151515]" />
            <span>
              Also put <b>{r.name}</b> under maintenance (paused for booking)
            </span>
          </label>
        )}
        <Notice tone="warn">AI suggestions don&apos;t change anything on their own. The outcome is yours.</Notice>
        <Err msg={err} />
        <Button type="submit" size="lg" loading={busy === "decide"}>
          Record decision
        </Button>
      </form>
    );
  }

  return (
    <div className="grid gap-4">
      <Section title="Decision">
        <DecisionSummary i={i} />
        {i.status === "disputed" && (
          <div className="mt-3">
            <Notice tone="warn">Disputed by the student. An admin resolves it.</Notice>
          </div>
        )}
        {i.status === "decided" && (
          <div className="mt-4 grid gap-2">
            <Err msg={err} />
            <Button
              variant="outline"
              loading={busy === "close"}
              onClick={async () => {
                setBusy("close");
                const out = await api.closeIncident(i.id);
                setBusy(null);
                if (!out.ok) setErr(out.error);
                else toast.success("Incident closed");
              }}
            >
              Close incident
            </Button>
          </div>
        )}
      </Section>
      {r.status === "maintenance" && (
        <Section title="Resource">
          <p className="text-sm">{r.name} is under maintenance.</p>
          <Button
            className="mt-3"
            variant="outline"
            loading={busy === "reopen"}
            onClick={async () => {
              setBusy("reopen");
              const out = await api.setResourceStatus(r.id, "active", "Repaired after incident review");
              setBusy(null);
              if (!out.ok) toast.error("Not reopened", out.error);
              else toast.success(`${r.name} is bookable again`);
            }}
          >
            Reopen for booking
          </Button>
        </Section>
      )}
    </div>
  );
}

function StudentPanel({ i }: { i: Incident }) {
  const toast = useToast();
  const rid = useId();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<"respond" | "dispute" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const open = ["open", "under_review", "decided"].includes(i.status);

  const send = async (dispute: boolean) => {
    setBusy(dispute ? "dispute" : "respond");
    setErr(null);
    const r = await api.respondToIncident(i.id, text.trim(), dispute);
    setBusy(null);
    if (!r.ok) return setErr(r.error);
    toast.success(dispute ? "Dispute sent to the admin" : "Response added");
    setText("");
  };

  return (
    <div className="grid gap-4">
      <Section title="Decision">
        <DecisionSummary i={i} />
      </Section>
      <Section title="Your side">
        {i.userResponse && <p className="mb-4 rounded-lg bg-sky px-3 py-2 text-[15px]">You said: “{i.userResponse}”</p>}
        {!open ? (
          <p className="text-sm text-mute">{i.status === "disputed" ? "Your dispute is with an admin. You'll be notified of the result." : "This incident is closed."}</p>
        ) : (
          <div className="grid gap-3">
            <Field id={rid} label={i.userResponse ? "Update your response" : "Add your response"} hint={i.status === "decided" ? "Disagree with the decision? Dispute it and an admin reviews everything." : "Explain what happened from your side."}>
              <Textarea id={rid} value={text} onChange={(e) => setText(e.target.value)} />
            </Field>
            <Err msg={err} />
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => send(false)} loading={busy === "respond"} disabled={!text.trim()}>
                Send response
              </Button>
              {i.status === "decided" && (
                <Button variant="danger" onClick={() => send(true)} loading={busy === "dispute"} disabled={!text.trim()}>
                  Dispute decision
                </Button>
              )}
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

function AdminPanel({ i }: { i: Incident }) {
  const toast = useToast();
  const rid = useId();
  const [outcome, setOutcome] = useState<DisputeOutcome>("upheld");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (i.status !== "disputed") {
    return (
      <Section title="Decision">
        <DecisionSummary i={i} />
      </Section>
    );
  }
  return (
    <form
      className="paper grid gap-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (reason.trim().length < 5) return setErr("Write a reason both sides will see.");
        setErr(null);
        setBusy(true);
        const r = await api.resolveIncidentDispute(i.id, outcome, reason.trim());
        setBusy(false);
        if (!r.ok) return setErr(r.error);
        toast.success(outcome === "overturned" ? "Overturned" : "Upheld", outcome === "overturned" ? "The penalty is refunded and any block lifted." : "The decision stands.");
      }}
    >
      <p className="font-display text-xl font-bold">Resolve the dispute</p>
      <div className="rounded-xl border-2 border-ink bg-paper px-3 py-2 text-sm">
        Manager decided <b>{i.decision ? DECISION_LABEL[i.decision] : "–"}</b>
        {i.reason && <>: “{i.reason}”</>}
      </div>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Outcome">
        {(["upheld", "overturned"] as const).map((o) => (
          <button key={o} type="button" role="radio" aria-checked={outcome === o} onClick={() => setOutcome(o)} className={cn("rounded-xl border-2 border-ink px-3 py-2 text-left", outcome === o ? "bg-ink text-paper" : "bg-white hover:bg-sun-soft")}>
            <span className="block text-sm font-semibold">{o === "upheld" ? "Uphold" : "Overturn"}</span>
            <span className={cn("block text-[12px]", outcome === o ? "text-paper/70" : "text-mute")}>{o === "upheld" ? "The decision stands" : "Refund penalty, lift block"}</span>
          </button>
        ))}
      </div>
      <Field id={rid} label="Reason">
        <Textarea id={rid} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What you weighed and why" />
      </Field>
      <Err msg={err} />
      <Button type="submit" size="lg" loading={busy}>
        Resolve dispute
      </Button>
    </form>
  );
}

export function IncidentView({ id, mode, back }: { id: string; mode: IncidentMode; back: { href: string; label: string } }) {
  const { data, error, loading, reload } = useQuery(() => api.getIncident(id), [id]);
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingBlock rows={3} />;
  const i = data.incident;
  const b = i.booking;
  const { checkIn, ret } = latestReports(data.reports);
  const names: Record<string, string> = { [b.userId]: b.userName ?? "Student", ...(b.supervisorId ? { [b.supervisorId]: b.supervisorName ?? "Supervisor" } : {}) };
  const ai = i.aiSummary || (i.aiPhotoDiff && i.aiPhotoDiff.length);

  let panel: ReactNode = (
    <Section title="Decision">
      <DecisionSummary i={i} />
    </Section>
  );
  if (mode === "staff") panel = <StaffPanel i={i} />;
  if (mode === "student") panel = <StudentPanel i={i} />;
  if (mode === "admin") panel = <AdminPanel i={i} />;

  return (
    <div>
      <PageHeader
        back={back}
        eyebrow={`incident · ${i.type.replace("_", " ")}`}
        title={b.resource.name}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <IncidentBadge status={i.status} />
            {mode !== "student" && b.userName && <span>{b.userName}</span>}
            <SlotText start={b.start} end={b.end} />
          </span>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-6">
          <Section title="What was reported" aside={<Link href={mode === "student" ? `/bookings/${b.id}` : `/manage/requests/${b.id}`} className="text-[13px] font-semibold underline">Booking history</Link>}>
            <div className="flex items-center gap-3">
              <Avatar name={i.openedByName ?? "Lab staff"} />
              <p className="text-sm">
                <b>{i.openedBy === b.userId && mode === "student" ? "You" : i.openedByName ?? "Lab staff"}</b> · {fmtDateTime(i.createdAt)}
              </p>
            </div>
            <p className="mt-3 text-[15px]">{i.description}</p>
            {i.photoPaths.length > 0 && (
              <div className="mt-3">
                <PhotoStrip paths={i.photoPaths} alt="Reported photo" />
              </div>
            )}
          </Section>
          <Section title="Check-in vs return">
            <div className="grid gap-3 sm:grid-cols-2">
              <ReportCard title="Check-in" rep={checkIn} names={names} />
              <ReportCard title="Return" rep={ret} names={names} />
            </div>
          </Section>
          {ai ? (
            <AiSuggestion loading={false} title="Summary and photo comparison">
              {i.aiSummary && <p className="text-[15px] leading-relaxed">{i.aiSummary}</p>}
              {i.aiPhotoDiff && i.aiPhotoDiff.length > 0 && (
                <>
                  <p className="mt-3 text-[12px] font-bold uppercase tracking-[0.08em]">Possible differences</p>
                  <ul className="mt-1 list-disc pl-5 text-sm">
                    {i.aiPhotoDiff.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </>
              )}
            </AiSuggestion>
          ) : null}
          {mode !== "student" && i.userResponse && (
            <Section title="Student's response">
              <p className="rounded-lg bg-sky px-3 py-2 text-[15px]">“{i.userResponse}”</p>
            </Section>
          )}
        </div>
        <div className="lg:sticky lg:top-24 lg:self-start">{panel}</div>
      </div>
    </div>
  );
}
