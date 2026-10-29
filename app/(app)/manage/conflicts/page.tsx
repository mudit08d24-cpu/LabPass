"use client";

// Contested slots: overlapping requests for the same resource, ranked by A's priority score.

import Link from "next/link";
import { useState } from "react";
import { ArrowRightIcon, BadgeCheckIcon, CheckIcon } from "lucide-react";
import { RequireHat } from "@/components/layout/app-shell";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, ResourceThumb, ScoreBreakdown, SlotText, StatusBadge, buttonVariants } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/screens";
import { useQuery, useRules } from "@/lib/screens/use-query";
import { cn } from "@/lib/utils";

export default function ConflictsPage() {
  const toast = useToast();
  const rules = useRules();
  const { data, error, loading, reload } = useQuery(() => api.listConflicts(), []);
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <RequireHat hats={["manager", "owner", "admin"]}>
      <PageHeader eyebrow="fair queue" title="Contested slots" description="More than one student wants the same time. Scores are computed by the database from the same rules for everyone; you still decide." />
      {error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingBlock />
      ) : !data?.length ? (
        <EmptyState title="No contested slots" body="When two requests overlap, they're grouped here." />
      ) : (
        <ul className="grid gap-5">
          {data.map((g) => {
            const ranked = [...g.requests].sort((a, b) => b.priorityScore - a.priorityScore);
            const holder = ranked.find((r) => r.status === "approved");
            return (
              <li key={g.key} className="paper p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-4">
                  <ResourceThumb resource={g.resource} className="w-24" />
                  <div>
                    <p className="font-display text-xl font-bold">{g.resource.name}</p>
                    <p className="text-sm text-ink/75">
                      <SlotText start={g.start} end={g.end} />
                    </p>
                    {holder && <p className="mt-1 text-[13px] font-semibold">{holder.userName ?? "A student"} holds this slot. Others can only be waitlisted.</p>}
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {ranked.map((r, i) => (
                    <div key={r.id} className={cn("rounded-2xl border-2 border-ink p-4", i === 0 && !holder ? "bg-sun-soft" : "bg-paper")}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-mute">#{i + 1}</p>
                          <p className="font-semibold">{r.userName ?? "Student"}</p>
                          <p className="mt-0.5 line-clamp-2 text-[13px] text-ink/75">“{r.purpose}”</p>
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                      {r.deadlineVerified && (
                        <p className="mt-2 inline-flex items-center gap-1 rounded-full border-[1.5px] border-ink bg-mint px-2 text-[11px] font-semibold leading-5">
                          <BadgeCheckIcon className="size-3" /> Verified deadline
                        </p>
                      )}
                      <div className="mt-3">{r.breakdown ? <ScoreBreakdown breakdown={r.breakdown} rules={rules} total={r.priorityScore} /> : <p className="font-display text-2xl font-bold">{Math.round(r.priorityScore)}</p>}</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {r.status === "requested" && !holder && (
                          <Button
                            size="sm"
                            loading={busy === r.id}
                            onClick={async () => {
                              setBusy(r.id);
                              const out = await api.decideBooking(r.id, "approved");
                              setBusy(null);
                              if (!out.ok) toast.error("Can't approve", [out.error, ...(out.reasons ?? [])].join(" "));
                              else toast.success("Approved", "Overlapping requests were waitlisted automatically.");
                            }}
                          >
                            <CheckIcon /> Approve
                          </Button>
                        )}
                        <Link href={`/manage/requests/${r.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                          Open <ArrowRightIcon />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </RequireHat>
  );
}
