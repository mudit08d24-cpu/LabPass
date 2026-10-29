"use client";

// Check-in, in API.md's order: upload photos → saveConditionReport("check_in") →
// (supervised: the supervisor co-signs) → checkIn(code, bookingId).

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CircleCheckIcon, HandshakeIcon, RefreshCwIcon } from "lucide-react";
import { HandoverReportForm } from "@/components/shared/handover-form";
import { latestReports, ReportCard } from "@/components/shared/report-card";
import { ErrorBlock, LoadingBlock, Notice, PageHeader, QrScanner, SlotText, buttonVariants } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, USE_MOCKS } from "@/lib/screens";
import { checkInOpen } from "@/lib/screens/format";
import { mockCheckinCode } from "@/lib/screens/mock";
import { useMe } from "@/lib/screens/session";
import { useQuery, useRules } from "@/lib/screens/use-query";
import { fmtTime } from "@/lib/utils";

export default function CheckInPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const me = useMe();
  const rules = useRules();
  const toast = useToast();
  const { data, error, loading, reload } = useQuery(() => api.getBooking(bookingId), [bookingId]);
  const [redo, setRedo] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingBlock />;
  const b = data.booking;
  const r = b.resource;
  const { checkIn: report } = latestReports(data.reports);
  const signed = !b.supervisorId || (report?.signedBy.includes(b.supervisorId) ?? false);

  if (b.status === "checked_in") {
    return (
      <div className="mx-auto max-w-lg">
        <div className="paper bg-mint p-6 text-center">
          <CircleCheckIcon className="mx-auto size-10" />
          <h1 className="mt-2 text-2xl font-extrabold">You&apos;re checked in</h1>
          <p className="mt-2 text-sm text-ink/80">
            Enjoy the {r.name}. Return by {fmtTime(b.end)} with a checklist and photo.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href={`/bookings/${b.id}`} className={buttonVariants()}>
              View booking
            </Link>
            <Link href={`/return/${b.id}`} className={buttonVariants({ variant: "outline" })}>
              Return early
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const send = async (code: string) => {
    setBusy(true);
    setErr(null);
    const res = await api.checkIn(code, b.id);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    toast.success("Checked in", `Return by ${fmtTime(b.end)}.`);
  };

  const notMine = b.userId !== me.id;
  const hint = USE_MOCKS ? mockCheckinCode(r.id) : null;

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader back={{ href: `/bookings/${b.id}`, label: "Booking" }} eyebrow="check in" title={r.name} description={<SlotText start={b.start} end={b.end} />} />
      {notMine ? (
        <Notice tone="warn">Only the student who booked can check in.</Notice>
      ) : b.status !== "approved" ? (
        <Notice tone="warn">This booking is {b.status.replace("_", " ")}, so there&apos;s nothing to check in to.</Notice>
      ) : (
        <div className="grid gap-5">
          {!checkInOpen(b, rules) && rules && (
            <Notice tone="warn">
              Check-in is open from {rules.checkin_grace_minutes} minutes before the start to {rules.checkin_grace_minutes} minutes after. You can fill in the report now and check in when it opens.
            </Notice>
          )}
          {!report || redo ? (
            <HandoverReportForm
              booking={b}
              stage="check_in"
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
                  <ReportCard title="Your check-in report" rep={report} names={{ [b.userId]: "You", ...(b.supervisorId ? { [b.supervisorId]: b.supervisorName ?? "Supervisor" } : {}) }} />
                </div>
              </div>
              {!signed ? (
                <div className="paper bg-lilac p-5 text-center">
                  <HandshakeIcon className="mx-auto size-8" />
                  <p className="mt-2 font-display text-xl font-bold">Waiting for {b.supervisorName ?? "your supervisor"} to co-sign</p>
                  <p className="mt-1 text-sm text-ink/80">They can see your report on their Supervising page. You can check in once they sign.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
                    <RefreshCwIcon /> Check again
                  </Button>
                </div>
              ) : (
                <div className="paper p-5">
                  <p className="text-[12px] font-bold uppercase tracking-[0.1em]">Step 3 · Scan the QR at the {r.type === "space" ? "door" : "machine"}</p>
                  <div className="mt-3">
                    <QrScanner onCode={send} />
                    {hint && (
                      <p className="mt-2 text-[12px] text-mute">
                        Demo: the code printed under this QR is <span className="font-mono font-bold">{hint}</span>.
                      </p>
                    )}
                  </div>
                  {busy && <p className="mt-3 text-sm font-medium">Checking in…</p>}
                  {err && (
                    <p role="alert" className="mt-3 rounded-xl border-2 border-ink bg-coral px-4 py-2.5 text-sm font-medium">
                      {err}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
