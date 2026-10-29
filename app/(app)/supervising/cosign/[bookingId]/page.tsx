"use client";

// The supervisor co-signs the student's latest check-in or return report (signConditionReport).

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { CircleCheckIcon } from "lucide-react";
import { latestReports, ReportCard } from "@/components/shared/report-card";
import { ErrorBlock, LoadingBlock, Notice, PageHeader, Section, SlotText, buttonVariants } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/screens";
import { useMe } from "@/lib/screens/session";
import { useQuery } from "@/lib/screens/use-query";

export default function CoSignPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const me = useMe();
  const toast = useToast();
  const { data, error, loading, reload } = useQuery(() => api.getBooking(bookingId), [bookingId]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingBlock />;
  const b = data.booking;
  const { checkIn, ret } = latestReports(data.reports);
  const rep = ["checked_in", "overdue", "returned"].includes(b.status) ? ret : checkIn;
  const stage = rep?.stage;
  const pending = rep && !rep.signedBy.includes(me.id);
  const student = b.userName ?? "The student";

  if (b.supervisorId !== me.id) {
    return (
      <div className="mx-auto max-w-lg">
        <Notice tone="warn">Only the supervisor assigned to this booking can co-sign it.</Notice>
      </div>
    );
  }

  if (!pending) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="paper bg-mint p-6 text-center">
          <CircleCheckIcon className="mx-auto size-10" />
          <h1 className="mt-2 text-2xl font-extrabold">{rep ? "Co-signed" : "Nothing to co-sign yet"}</h1>
          <p className="mt-2 text-sm">{!rep ? `${student} hasn't saved a report yet.` : stage === "check_in" ? `${student} can check in now.` : "You earn your credits when the manager confirms the return."}</p>
          <Link href="/supervising" className={buttonVariants({ className: "mt-5" })}>
            Back to Supervising
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: "/supervising", label: "Supervising" }} eyebrow={stage === "check_in" ? "co-sign check-in" : "co-sign return"} title={`${student} · ${b.resource.name}`} description={<SlotText start={b.start} end={b.end} />} />
      <div className="grid gap-6">
        <Notice>Only co-sign if you&apos;re with the student and agree with the checklist and photos below.</Notice>
        <Section title={`${student}'s ${stage === "check_in" ? "check-in" : "return"} report`}>
          <ReportCard title={stage === "check_in" ? "Check-in" : "Return"} rep={rep} names={{ [b.userId]: student, [me.id]: "You" }} />
        </Section>
        <div className="paper grid gap-3 p-5">
          {err && (
            <p role="alert" className="rounded-xl border-2 border-ink bg-coral px-3 py-2 text-sm font-medium">
              {err}
            </p>
          )}
          <Button
            size="lg"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              const r = await api.signConditionReport(rep!.id);
              setBusy(false);
              if (!r.ok) setErr(r.error);
              else toast.success("Co-signed");
            }}
          >
            Co-sign {stage === "check_in" ? "check-in" : "return"}
          </Button>
          {["checked_in", "overdue", "returned"].includes(b.status) && (
            <Link href={`/incidents/new/${b.id}`} className="text-center text-[13px] font-semibold underline">
              Something&apos;s wrong? Report an issue instead
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
