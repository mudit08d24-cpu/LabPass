"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRightIcon, BadgeCheckIcon } from "lucide-react";
import { RequireHat } from "@/components/layout/app-shell";
import { Ago, EmptyState, ErrorBlock, LoadingBlock, PageHeader, ResourceThumb, SlotText, StatTile, StatusBadge, TierBadge, buttonVariants } from "@/components/shared";
import { Avatar, Tabs } from "@/components/ui/misc";
import { api } from "@/lib/screens";
import { useQuery } from "@/lib/screens/use-query";

export default function RequestsQueuePage() {
  const [tab, setTab] = useState<"requested" | "all">("requested");
  const { data, error, loading, reload } = useQuery(() => api.listRequests(tab), [tab]);
  const pending = useQuery(() => api.listRequests("requested"), []);
  const returns = useQuery(() => api.listPendingReturns(), []);
  const conflicts = useQuery(() => api.listConflicts(), []);
  const incidents = useQuery(() => api.listIncidents("attention"), []);

  return (
    <RequireHat hats={["manager", "owner", "admin"]}>
      <PageHeader eyebrow="lab manager" title="Requests" description="Approve, reject or waitlist. A person decides every request, and rejections and waitlists need a reason. This list updates live." />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Waiting for you" value={pending.data?.length ?? "–"} tone="sun" />
        <Link href="/manage/conflicts" className="block transition-transform hover:-translate-y-0.5">
          <StatTile label="Contested slots" value={conflicts.data?.length ?? "–"} hint="Compare scores →" />
        </Link>
        <Link href="/manage/returns" className="block transition-transform hover:-translate-y-0.5">
          <StatTile label="Returns to confirm" value={returns.data?.length ?? "–"} hint="Check photos →" />
        </Link>
        <Link href="/manage/incidents" className="block transition-transform hover:-translate-y-0.5">
          <StatTile label="Incidents" value={incidents.data?.length ?? "–"} tone={incidents.data?.length ? "ink" : "paper"} hint="Review →" />
        </Link>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "requested", label: "Pending", count: pending.data?.length },
          { value: "all", label: "All bookings" },
        ]}
      />
      <div className="mt-5">
        {error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingBlock />
        ) : !data?.length ? (
          <EmptyState title="Inbox zero" body="No requests waiting. New ones appear here as students send them." art="cat" />
        ) : (
          <ul className="grid gap-3">
            {data.map((b) => {
              const competing = (conflicts.data ?? []).find((g) => g.requests.some((x) => x.id === b.id));
              return (
                <li key={b.id} className="paper flex flex-col gap-4 p-4 md:flex-row md:items-center">
                  <ResourceThumb resource={b.resource} className="hidden w-24 shrink-0 md:block" />
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <Avatar name={b.userName ?? "Student"} />
                    <div className="min-w-0">
                      <p className="font-semibold">
                        {b.userName ?? "Student"} <span className="font-normal text-mute">wants</span> {b.resource.name}
                      </p>
                      <p className="text-[14px] text-ink/75">
                        <SlotText start={b.start} end={b.end} />
                      </p>
                      <p className="mt-1 line-clamp-1 text-[13px] text-mute">“{b.purpose}”</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <TierBadge tier={b.resource.tier} />
                    <StatusBadge status={b.status} />
                    {competing && competing.requests.length > 1 && <span className="rounded-full border-[1.5px] border-ink bg-coral px-2 text-[11px] font-semibold leading-5">{competing.requests.length - 1} competing</span>}
                    {b.deadlineVerified && (
                      <span className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-ink bg-mint px-2 text-[11px] font-semibold leading-5">
                        <BadgeCheckIcon className="size-3" /> deadline
                      </span>
                    )}
                    <span className="rounded-full border-[1.5px] border-ink bg-paper px-2 font-display text-[12px] font-bold leading-5">score {Math.round(b.priorityScore)}</span>
                    <span className="text-[12px] text-mute">
                      <Ago iso={b.createdAt} />
                    </span>
                    <Link href={`/manage/requests/${b.id}`} className={buttonVariants({ size: "sm" })}>
                      {b.status === "requested" ? "Decide" : "Open"} <ArrowRightIcon />
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </RequireHat>
  );
}
