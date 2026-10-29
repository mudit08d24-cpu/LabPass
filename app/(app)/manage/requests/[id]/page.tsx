"use client";

// The manager's view of one booking. LINKS.managerRequest points here for new requests,
// returns to confirm, overdue and no-show, so this page handles every status.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BadgeCheckIcon, CheckIcon, FlagIcon, HourglassIcon, XIcon } from "lucide-react";
import { RequireHat } from "@/components/layout/app-shell";
import { latestReports, ReportCard } from "@/components/shared/report-card";
import { ChecksList, ErrorBlock, IncidentBadge, LoadingBlock, Notice, PageHeader, ReasonDialog, ResourceThumb, ScoreBreakdown, Section, SlotText, StatusBadge, Timeline, buttonVariants } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/screens";
import { useQuery, useRules } from "@/lib/screens/use-query";

type Dlg = null | "reject" | "waitlist" | "verify" | "unverify" | "cancel";

export default function ManageBookingPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const rules = useRules();
  const { data, error, loading, reload } = useQuery(() => api.getBooking(id), [id]);
  const [dlg, setDlg] = useState<Dlg>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[] | null>(null);
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingBlock rows={3} />;
  const { booking: b, competing, timeline, reports, incidents } = data;
  const student = b.userName ?? "Student";
  const holder = competing.find((c) => c.status === "approved");
  const { checkIn, ret } = latestReports(reports);
  const names: Record<string, string> = { [b.userId]: student, ...(b.supervisorId ? { [b.supervisorId]: b.supervisorName ?? "Supervisor" } : {}) };
  const decidable = b.status === "requested";
  const rankable = b.status === "requested" || b.status === "waitlisted";

  const approve = async () => {
    setBusy("approve");
    setReasons(null);
    const r = await api.decideBooking(b.id, "approved");
    setBusy(null);
    if (!r.ok) {
      setReasons(r.reasons ?? null);
      return toast.error("Can't approve", r.error);
    }
    toast.success("Approved", `Credits taken from ${student}. Overlapping requests were waitlisted.`);
  };

  const confirm = async () => {
    setBusy("confirm");
    const r = await api.confirmReturn(b.id);
    setBusy(null);
    if (!r.ok) return toast.error("Not confirmed", r.error);
    toast.success("Return confirmed", r.data.supervisorReward ? `${b.supervisorName ?? "The supervisor"} earned ${r.data.supervisorReward} credits.` : "The booking is complete.");
  };

  return (
    <RequireHat hats={["manager", "owner", "admin"]}>
      <PageHeader
        back={{ href: b.status === "returned" ? "/manage/returns" : "/manage/requests", label: b.status === "returned" ? "Returns" : "Requests" }}
        eyebrow={decidable ? "decide a request" : "booking"}
        title={`${student} → ${b.resource.name}`}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <StatusBadge status={b.status} />
            <SlotText start={b.start} end={b.end} />
          </span>
        }
        actions={
          ["checked_in", "overdue", "returned", "completed"].includes(b.status) ? (
            <Link href={`/incidents/new/${b.id}`} className={buttonVariants({ variant: "outline" })}>
              <FlagIcon /> Report an issue
            </Link>
          ) : undefined
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-6">
          <Section title="Request">
            <div className="flex flex-wrap items-start gap-4">
              <ResourceThumb resource={b.resource} className="w-32" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3">
                  <Avatar name={student} />
                  <div>
                    <p className="font-semibold">{student}</p>
                    {b.userRollNo && <p className="text-[12px] text-mute">{b.userRollNo}</p>}
                  </div>
                </div>
                <p className="mt-3 rounded-lg bg-paper-2 px-3 py-2 text-[15px]">“{b.purpose}”</p>
                <p className="mt-2 text-sm">
                  {b.creditsCharged > 0 ? `${b.creditsCharged} credits charged` : "Credits are charged on approval"}
                  {b.supervisorId && ` · ${b.supervisorKind === "peer" ? "Peer supervisor" : "Supervisor"}: ${b.supervisorName ?? "Lab staff"}`}
                </p>
              </div>
            </div>
          </Section>
          {(b.status === "returned" || b.status === "completed" || b.status === "checked_in" || b.status === "overdue") && (
            <Section title="Check-in vs return">
              <div className="grid gap-3 sm:grid-cols-2">
                <ReportCard title="At check-in" rep={checkIn} names={names} />
                <ReportCard title="At return" rep={ret} names={names} />
              </div>
            </Section>
          )}
          {b.checks.length > 0 && (
            <Section title="Checks" aside={<span className="text-[12px] text-mute">From when the student sent it</span>}>
              <ChecksList checks={b.checks} />
            </Section>
          )}
          <Section title="History">
            <Timeline items={timeline} />
          </Section>
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-6">
          {competing.length > 0 && rankable && (
            <div className="paper bg-coral/60 p-5">
              <p className="font-display text-lg font-bold">
                {competing.length} other request{competing.length > 1 ? "s" : ""} for this slot
              </p>
              <p className="mt-1 text-sm">{holder ? `${holder.userName ?? "Another student"} already holds it, so approving would fail. Waitlist instead.` : "Compare priority scores before deciding."}</p>
              <ul className="mt-3 grid gap-1.5">
                {[b, ...competing]
                  .sort((x, y) => y.priorityScore - x.priorityScore)
                  .map((c) => (
                    <li key={c.id}>
                      <Link href={`/manage/requests/${c.id}`} className={`flex items-center justify-between gap-2 rounded-xl border-[1.5px] border-ink px-3 py-1.5 text-sm ${c.id === b.id ? "bg-sun" : "bg-paper hover:bg-white"}`}>
                        <span className="font-semibold">{c.id === b.id ? `${student} (this one)` : c.userName ?? "Student"}</span>
                        <span className="flex items-center gap-2">
                          <StatusBadge status={c.status} />
                          <span className="font-display font-bold tabular-nums">{Math.round(c.priorityScore)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
              <Link href="/manage/conflicts" className={buttonVariants({ variant: "outline", size: "sm", className: "mt-3" })}>
                All contested slots
              </Link>
            </div>
          )}
          {b.breakdown && (
            <Section
              title="Priority score"
              aside={
                rankable ? (
                  <Button size="sm" variant="outline" onClick={() => setDlg(b.deadlineVerified ? "unverify" : "verify")}>
                    <BadgeCheckIcon /> {b.deadlineVerified ? "Remove deadline" : "Verify deadline"}
                  </Button>
                ) : undefined
              }
            >
              <ScoreBreakdown breakdown={b.breakdown} rules={rules} total={b.priorityScore} />
            </Section>
          )}
          {incidents.length > 0 && (
            <Section title="Incidents">
              <ul className="grid gap-2">
                {incidents.map((i) => (
                  <li key={i.id}>
                    <Link href={`/incidents/${i.id}`} className="flex items-center justify-between gap-2 rounded-xl border-2 border-ink bg-white px-3 py-2 hover:bg-sun-soft">
                      <span className="text-sm font-semibold capitalize">{i.type.replace("_", " ")}</span>
                      <IncidentBadge status={i.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <div className="paper p-5 lg:sticky lg:top-24">
            <p className="text-[12px] font-bold uppercase tracking-[0.1em]">Your decision</p>
            {reasons && reasons.length > 0 && (
              <ul role="alert" className="mt-3 grid list-disc gap-1 rounded-xl border-2 border-ink bg-coral/70 py-2.5 pl-8 pr-3 text-sm">
                {reasons.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
            {decidable ? (
              <div className="mt-3 grid gap-2">
                <Button size="lg" loading={busy === "approve"} disabled={!!holder} onClick={approve}>
                  <CheckIcon /> Approve
                </Button>
                <Button size="lg" variant="outline" onClick={() => setDlg("waitlist")}>
                  <HourglassIcon /> Waitlist
                </Button>
                <Button size="lg" variant="danger" onClick={() => setDlg("reject")}>
                  <XIcon /> Reject
                </Button>
              </div>
            ) : b.status === "returned" ? (
              <div className="mt-3 grid gap-2">
                <p className="text-sm">Compare the check-in and return photos. If something&apos;s wrong, report an issue instead of confirming.</p>
                <Button size="lg" loading={busy === "confirm"} onClick={confirm}>
                  <CheckIcon /> Confirm return
                </Button>
              </div>
            ) : (
              <div className="mt-3 grid gap-2">
                <Notice tone={b.status === "no_show" || b.status === "overdue" ? "warn" : "ok"}>
                  {b.status === "overdue" ? "Past the end time and not returned yet. The student has been reminded." : b.status === "no_show" ? "The student didn't check in on time." : `This booking is ${b.status.replace("_", " ")}.`}
                  {b.reason && ` “${b.reason}”`}
                </Notice>
                {["approved", "waitlisted"].includes(b.status) && (
                  <Button variant="danger" onClick={() => setDlg("cancel")}>
                    Cancel booking
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <ReasonDialog
        open={dlg === "reject"}
        onClose={() => setDlg(null)}
        title="Reject this request"
        description="The student sees this reason."
        confirmLabel="Reject request"
        tone="danger"
        placeholder="e.g. The lab is booked for a practical exam that afternoon."
        onConfirm={async (reason) => {
          const r = await api.decideBooking(b.id, "rejected", reason);
          if (!r.ok) {
            toast.error("Not rejected", r.error);
            return false;
          }
          toast.success("Rejected", "The student has been told why.");
        }}
      />
      <ReasonDialog
        open={dlg === "waitlist"}
        onClose={() => setDlg(null)}
        title="Waitlist this request"
        description={`They see their rank and score, and get a ${rules?.waitlist_offer_minutes ?? "–"}-minute offer if the slot frees up.`}
        confirmLabel="Waitlist"
        placeholder="e.g. Slot contested; a verified deadline ranks higher."
        onConfirm={async (reason) => {
          const r = await api.decideBooking(b.id, "waitlisted", reason);
          if (!r.ok) {
            toast.error("Not waitlisted", r.error);
            return false;
          }
          toast.success("Waitlisted");
        }}
      />
      <ReasonDialog
        open={dlg === "verify" || dlg === "unverify"}
        onClose={() => setDlg(null)}
        title={dlg === "verify" ? "Verify the deadline" : "Remove the deadline bonus"}
        description={dlg === "verify" ? `Confirms a faculty deadline: +${rules?.priority_deadline_bonus ?? "–"} priority on this request.` : "The bonus is removed from the score."}
        confirmLabel={dlg === "verify" ? "Verify" : "Remove"}
        placeholder="e.g. Checked with Prof. Kumar: project demo on Friday."
        onConfirm={async (reason) => {
          const r = await api.setDeadlineVerified(b.id, dlg === "verify", reason);
          if (!r.ok) {
            toast.error("Not saved", r.error);
            return false;
          }
          toast.success("Score updated", `New priority score: ${Math.round(r.data.score)}`);
        }}
      />
      <ReasonDialog
        open={dlg === "cancel"}
        onClose={() => setDlg(null)}
        title="Cancel this booking"
        description="Credits are always refunded when a manager cancels. The student sees the reason."
        confirmLabel="Cancel booking"
        tone="danger"
        onConfirm={async (reason) => {
          const r = await api.cancelBooking(b.id, reason);
          if (!r.ok) {
            toast.error("Not cancelled", r.error);
            return false;
          }
          toast.success("Cancelled", r.data.refundedCredits ? `${r.data.refundedCredits} credits refunded.` : undefined);
        }}
      />
    </RequireHat>
  );
}
