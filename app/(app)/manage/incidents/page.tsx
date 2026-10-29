"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRightIcon } from "lucide-react";
import { RequireHat } from "@/components/layout/app-shell";
import { Ago, EmptyState, ErrorBlock, IncidentBadge, LoadingBlock, PageHeader, ResourceThumb, buttonVariants } from "@/components/shared";
import { Tabs } from "@/components/ui/misc";
import { api } from "@/lib/screens";
import { useQuery } from "@/lib/screens/use-query";

export default function IncidentsPage() {
  const [tab, setTab] = useState<"attention" | "all">("attention");
  const { data, error, loading, reload } = useQuery(() => api.listIncidents(tab), [tab]);
  const { data: attention } = useQuery(() => api.listIncidents("attention"), []);
  return (
    <RequireHat hats={["manager", "owner", "admin"]}>
      <PageHeader eyebrow="damage, delays, disputes" title="Incidents" description="Every decision needs a reason. Students can respond or dispute; an admin resolves disputes." />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "attention", label: "Needs attention", count: attention?.length },
          { value: "all", label: "All" },
        ]}
      />
      <div className="mt-5">
        {error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingBlock />
        ) : !data?.length ? (
          <EmptyState title="No incidents" body="Good news." art="cat" />
        ) : (
          <ul className="grid gap-3">
            {data.map((i) => (
              <li key={i.id} className="paper flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <ResourceThumb resource={i.booking.resource} className="w-full sm:w-28" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <IncidentBadge status={i.status} />
                    <span className="text-[12px] font-bold uppercase tracking-[0.08em]">{i.type.replace("_", " ")}</span>
                  </div>
                  <p className="mt-1 font-semibold">
                    {i.booking.resource.name}
                    {i.booking.userName && <> · {i.booking.userName}</>}
                  </p>
                  <p className="line-clamp-1 text-sm text-ink/75">{i.description}</p>
                  <p className="text-[12px] text-mute">
                    Reported by {i.openedByName ?? "Lab staff"} · <Ago iso={i.createdAt} />
                  </p>
                </div>
                <Link href={`/incidents/${i.id}`} className={buttonVariants({ size: "sm" })}>
                  {i.status === "open" || i.status === "under_review" ? "Review" : "View"} <ArrowRightIcon />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </RequireHat>
  );
}
