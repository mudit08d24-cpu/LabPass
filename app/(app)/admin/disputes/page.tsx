"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { RequireHat } from "@/components/layout/app-shell";
import { DECISION_LABEL } from "@/components/shared/incident-view";
import { Ago, EmptyState, ErrorBlock, IncidentBadge, LoadingBlock, PageHeader, SlotText, buttonVariants } from "@/components/shared";
import { api } from "@/lib/screens";
import { useQuery } from "@/lib/screens/use-query";

export default function DisputesPage() {
  const { data, error, loading, reload } = useQuery(async () => (await api.listIncidents("attention")).filter((i) => i.status === "disputed"), []);
  return (
    <RequireHat hats={["admin"]}>
      <PageHeader eyebrow="second opinion" title="Disputes" description="Students who disagree with an incident decision. Read both sides, then uphold or overturn with a reason." />
      {error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingBlock />
      ) : !data?.length ? (
        <EmptyState title="No open disputes" art="plant" />
      ) : (
        <ul className="grid gap-4">
          {data.map((i) => (
            <li key={i.id} className="paper p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-display text-xl font-bold">
                  {i.booking.userName ?? "Student"} · {i.booking.resource.name}
                </p>
                <IncidentBadge status={i.status} />
              </div>
              <p className="text-sm text-mute">
                <SlotText start={i.booking.start} end={i.booking.end} /> · reported <Ago iso={i.createdAt} />
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className="paper-inset p-3">
                  <p className="text-[12px] font-bold uppercase tracking-[0.08em]">Report</p>
                  <p className="mt-1 line-clamp-4 text-sm">{i.description}</p>
                </div>
                <div className="paper-inset p-3">
                  <p className="text-[12px] font-bold uppercase tracking-[0.08em]">Manager: {i.decision ? DECISION_LABEL[i.decision] : "–"}</p>
                  {i.reason && <p className="mt-1 line-clamp-4 text-sm">“{i.reason}”</p>}
                </div>
                <div className="paper-inset bg-sky p-3">
                  <p className="text-[12px] font-bold uppercase tracking-[0.08em]">Student says</p>
                  <p className="mt-1 line-clamp-4 text-sm">“{i.userResponse}”</p>
                </div>
              </div>
              <Link href={`/admin/incidents/${i.id}`} className={buttonVariants({ className: "mt-4" })}>
                Review and resolve <ArrowRightIcon />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </RequireHat>
  );
}
