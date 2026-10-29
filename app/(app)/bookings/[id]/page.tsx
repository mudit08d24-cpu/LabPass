"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { BellRingIcon, FlagIcon, QrCodeIcon, Undo2Icon } from "lucide-react";
import { CancelDialog } from "@/components/shared/cancel-dialog";
import { latestReports, ReportCard } from "@/components/shared/report-card";
import { Countdown, ErrorBlock, IncidentBadge, LoadingBlock, Notice, PageHeader, ScoreBreakdown, Section, SlotText, StatusBadge, Timeline, buttonVariants } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, type Booking } from "@/lib/screens";
import { checkInOpen } from "@/lib/screens/format";
import { hatsOf, useMe } from "@/lib/screens/session";
import { useQuery, useRules } from "@/lib/screens/use-query";

function WaitlistPanel({ b }: { b: Booking }) {
  const toast = useToast();
  const rules = useRules();
  const { data, reload } = useQuery(() => api.getMyWaitlistRank(b.id), [b.id, b.status]);
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<string[] | null>(null);
  if (!data) return null;
  if (!data.ok) return <Notice tone="warn">{data.error}</Notice>;
  const w = data.data;
  const offer = w.liveOffer ?? b.liveOffer;

  const act = async (k: "accept" | "decline") => {
    if (!offer) return;
    setBusy(k);
    setReasons(null);
    const r = k === "accept" ? await api.acceptWaitlistOffer(offer.id) : await api.declineWaitlistOffer(offer.id);
    setBusy(null);
    if (!r.ok) {
      setReasons(r.reasons ?? null);
      return toast.error("That didn't work", r.error);
    }
    toast.success(k === "accept" ? "The slot is yours" : "Offer declined", k === "accept" ? `Check in within ${rules?.checkin_grace_minutes ?? "–"} minutes of the start.` : "It goes to the next person in line.");
  };

  return (
    <div className="grid gap-6">
      {offer && (
        <div className="paper bg-sun p-6 shadow-pop-lg sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.1em]">
                <BellRingIcon className="size-4 animate-sway" /> A slot opened up for you
              </p>
              <h2 className="mt-1 text-3xl font-extrabold">Accept before the timer ends</h2>
              <p className="mt-1 text-sm">If you don&apos;t, it goes to the next person in line. Accepting takes the credits now.</p>
            </div>
            <div className="rounded-2xl border-2 border-ink bg-paper px-6 py-3 text-center">
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-mute">Time left</p>
              <Countdown to={offer.expiresAt} className="text-4xl" onExpire={reload} />
            </div>
          </div>
          {reasons && reasons.length > 0 && (
            <ul role="alert" className="mt-4 grid list-disc gap-1 rounded-xl border-2 border-ink bg-coral/70 py-2.5 pl-8 pr-3 text-sm">
              {reasons.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button size="lg" onClick={() => act("accept")} loading={busy === "accept"}>
              Accept slot
            </Button>
            <Button size="lg" variant="outline" onClick={() => act("decline")} loading={busy === "decline"}>
              Decline
            </Button>
          </div>
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
        <div className="paper flex flex-col items-center justify-center p-6 text-center">
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-mute">Your place</p>
          <p className="font-display text-8xl font-extrabold leading-none">#{w.rank}</p>
          <p className="mt-2 text-sm text-ink/75">of {w.of} waiting for this slot</p>
        </div>
        <Section title="Why you're here">
          {w.breakdown ? <ScoreBreakdown breakdown={w.breakdown} rules={rules} total={w.score} /> : <p className="text-sm text-mute">No score recorded.</p>}
          {b.reason && <p className="mt-3 rounded-lg bg-paper-2 px-3 py-2 text-[13px]">Manager: “{b.reason}”</p>}
          <p className="mt-3 text-[12px] text-mute">Higher score goes first. If the slot frees up, the top student gets a {rules?.waitlist_offer_minutes ?? "–"}-minute offer.</p>
        </Section>
      </div>
    </div>
  );
}

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const rules = useRules();
  const [cancel, setCancel] = useState(false);
  const { data, error, loading, reload } = useQuery(() => api.getBooking(id), [id]);
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingBlock rows={3} />;
  const { booking: b, reports, incidents, timeline } = data;
  const mine = b.userId === me.id;
  const hats = hatsOf(me);
  const staff = hats.includes("manager") || hats.includes("admin");
  const names: Record<string, string> = { [b.userId]: b.userName ?? "Student", ...(b.supervisorId ? { [b.supervisorId]: b.supervisorName ?? "Supervisor" } : {}) };
  const { checkIn, ret } = latestReports(reports);
  const canCheckIn = mine && checkInOpen(b, rules);

  return (
    <div>
      <PageHeader
        back={mine ? { href: "/bookings", label: "My bookings" } : staff ? { href: "/manage/requests", label: "Requests" } : { href: "/supervising", label: "Supervising" }}
        eyebrow="booking"
        title={b.resource.name}
        description={
          <span className="flex flex-wrap items-center gap-3">
            <StatusBadge status={b.status} />
            <SlotText start={b.start} end={b.end} />
          </span>
        }
        actions={
          <>
            {canCheckIn && (
              <Link href={`/check-in/${b.id}`} className={buttonVariants()}>
                <QrCodeIcon /> Check in
              </Link>
            )}
            {mine && (b.status === "checked_in" || b.status === "overdue") && (
              <Link href={`/return/${b.id}`} className={buttonVariants()}>
                <Undo2Icon /> Return
              </Link>
            )}
            {staff && !mine && (
              <Link href={`/manage/requests/${b.id}`} className={buttonVariants()}>
                Manage booking
              </Link>
            )}
            {["checked_in", "overdue", "returned", "completed"].includes(b.status) && (mine || staff) && (
              <Link href={`/incidents/new/${b.id}`} className={buttonVariants({ variant: "outline" })}>
                <FlagIcon /> Report an issue
              </Link>
            )}
            {mine && ["requested", "approved", "waitlisted"].includes(b.status) && (
              <Button variant="ghost" onClick={() => setCancel(true)}>
                Cancel
              </Button>
            )}
          </>
        }
      />
      {mine && b.status === "approved" && !canCheckIn && rules && (
        <div className="mb-6">
          <Notice>
            Check-in opens {rules.checkin_grace_minutes} minutes before the start and closes {rules.checkin_grace_minutes} minutes after. Miss it and the booking counts as a no-show.
          </Notice>
        </div>
      )}
      {mine && b.status === "waitlisted" && (
        <div className="mb-6">
          <WaitlistPanel b={b} />
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-6">
          <Section title="Condition record">
            <div className="grid gap-3 sm:grid-cols-2">
              <ReportCard title="At check-in" rep={checkIn} names={names} />
              <ReportCard title="At return" rep={ret} names={names} />
            </div>
          </Section>
          <Section title="History" aside={<span className="text-[12px] text-mute">From the audit log · can&apos;t be edited</span>}>
            <Timeline items={timeline} />
          </Section>
        </div>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-6">
          <Section title="Details">
            <dl className="grid gap-3 text-sm">
              <div className="flex items-center gap-3">
                <Avatar name={b.userName ?? "Student"} />
                <div>
                  <dt className="sr-only">Student</dt>
                  <dd className="font-semibold">{mine ? "You" : b.userName ?? "Student"}</dd>
                  {b.userRollNo && <dd className="text-[12px] text-mute">{b.userRollNo}</dd>}
                </div>
              </div>
              {b.supervisorId && (
                <div className="flex items-center gap-3">
                  <Avatar name={b.supervisorName ?? "Supervisor"} className="bg-lilac" />
                  <div>
                    <dt className="text-[12px] text-mute">{b.supervisorKind === "peer" ? "Peer supervisor" : "Supervisor"}</dt>
                    <dd className="font-semibold">{b.supervisorName ?? "Lab staff"}</dd>
                  </div>
                </div>
              )}
              <div>
                <dt className="text-[12px] font-bold uppercase tracking-[0.08em] text-mute">Purpose</dt>
                <dd className="mt-0.5">{b.purpose}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-mute">Credits charged</dt>
                <dd className="font-semibold">{b.creditsCharged}</dd>
              </div>
              {b.deadlineVerified && (
                <div className="flex justify-between">
                  <dt className="text-mute">Deadline</dt>
                  <dd className="font-semibold">Faculty-verified</dd>
                </div>
              )}
              {b.reason && (
                <div>
                  <dt className="text-[12px] font-bold uppercase tracking-[0.08em] text-mute">Manager&apos;s reason</dt>
                  <dd className="mt-0.5 rounded-lg bg-paper-2 px-2 py-1">“{b.reason}”</dd>
                </div>
              )}
            </dl>
          </Section>
          {b.breakdown && b.status !== "waitlisted" && (
            <Section title="Priority score">
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
        </div>
      </div>
      {cancel && <CancelDialog booking={b} onClose={() => setCancel(false)} />}
    </div>
  );
}
