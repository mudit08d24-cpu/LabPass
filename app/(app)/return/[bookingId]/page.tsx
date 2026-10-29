"use client";

// Return, in API.md's order: upload photos → saveConditionReport("return") →
// (supervised: the supervisor co-signs) → returnBooking → the manager confirms.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CircleCheckIcon, HandshakeIcon, RefreshCwIcon, Undo2Icon } from "lucide-react";
import { HandoverReportForm } from "@/components/shared/handover-form";
import { latestReports, ReportCard } from "@/components/shared/report-card";
import { ErrorBlock, LoadingBlock, Notice, PageHeader, SlotText, buttonVariants } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/screens";
import { useMe } from "@/lib/screens/session";
import { useQuery } from "@/lib/screens/use-query";

export default function ReturnPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const me = useMe();
  const toast = useToast();
  const { data, error, loading, reload } = useQuery(() => api.getBooking(bookingId), [bookingId]);
  const [redo, setRedo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingBlock />;
  const b = data.booking;
  const r = b.resource;
  const { ret: report } = latestReports(data.reports);
  const signed = !b.supervisorId || (report?.signedBy.includes(b.supervisorId) ?? false);

  if (b.status === "returned" || b.status === "completed") {
    return (
      <div className="mx-auto max-w-lg">
        <div className="paper bg-mint p-6 text-center">
          <CircleCheckIcon className="mx-auto size-10" />
          <h1 className="mt-2 text-2xl font-extrabold">Returned. Thanks!</h1>
          <p className="mt-2 text-sm text-ink/80">{b.status === "completed" ? "The lab manager confirmed the return." : `${r.name} is logged as returned. The lab manager will compare photos and confirm.`}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href={`/bookings/${b.id}`} className={buttonVariants()}>
              View booking
            </Link>
            <Link href={`/incidents/new/${b.id}`} className={buttonVariants({ variant: "outline" })}>
              Report an issue
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const finish = async () => {
    setBusy(true);
    setErr(null);
    const res = await api.returnBooking(b.id);
    setBusy(false);
    if (!res.ok) return setErr(res.error);
    toast.success("Returned", "The lab manager has been asked to confirm.");
  };

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader back={{ href: `/bookings/${b.id}`, label: "Booking" }} eyebrow="hand it back" title={`Return the ${r.name}`} description={<SlotText start={b.start} end={b.end} />} />
      {b.userId !== me.id ? (
        <Notice tone="warn">Only the student who booked can return it.</Notice>
      ) : !["checked_in", "overdue"].includes(b.status) ? (
        <Notice tone="warn">This booking is {b.status.replace("_", " ")}; only checked-in bookings can be returned.</Notice>
      ) : (
        <div className="grid gap-5">
          {b.status === "overdue" && <Notice tone="warn">You&apos;re past the end time. Return now; the manager sees the delay in the history.</Notice>}
          {!report || redo ? (
            <HandoverReportForm
              booking={b}
              stage="return"
              onSaved={() => {
                setRedo(false);
                reload();
              }}
            />
          ) : (
            <>
              <div className="paper p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12px] font-bold uppercase tracking-[0.1em]">Steps 1–2 · Report saved</p>
                  <button type="button" className="text-[13px] font-semibold underline" onClick={() => setRedo(true)}>
                    Redo report
                  </button>
                </div>
                <div className="mt-3">
                  <ReportCard title="Your return report" rep={report} names={{ [b.userId]: "You", ...(b.supervisorId ? { [b.supervisorId]: b.supervisorName ?? "Supervisor" } : {}) }} />
                </div>
              </div>
              {!signed ? (
                <div className="paper bg-lilac p-5 text-center">
                  <HandshakeIcon className="mx-auto size-8" />
                  <p className="mt-2 font-display text-xl font-bold">Waiting for {b.supervisorName ?? "your supervisor"} to co-sign</p>
                  <p className="mt-1 text-sm text-ink/80">Once they sign, you can finish the return.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
                    <RefreshCwIcon /> Check again
                  </Button>
                </div>
              ) : (
                <div className="paper p-5">
                  <p className="text-[12px] font-bold uppercase tracking-[0.1em]">Step 3 · Hand it back</p>
                  {err && (
                    <p role="alert" className="mt-3 rounded-xl border-2 border-ink bg-coral px-4 py-2.5 text-sm font-medium">
                      {err}
                    </p>
                  )}
                  <Button size="lg" className="mt-3 w-full" loading={busy} onClick={finish}>
                    <Undo2Icon /> Finish return
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
