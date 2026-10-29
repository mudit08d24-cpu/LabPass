"use client";

import { useState } from "react";
import { SearchIcon, ZapIcon } from "lucide-react";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/shared";
import { ResourceCardView } from "@/components/shared/resource-card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { api, type ResourceFilters, type ResourceWithEligibility } from "@/lib/screens";
import { useQuery } from "@/lib/screens/use-query";
import { cn, istParts } from "@/lib/utils";

const TYPES = [
  { v: "", l: "All types" },
  { v: "space", l: "Spaces" },
  { v: "equipment", l: "Equipment" },
  { v: "specialised", l: "Specialised" },
];

/** Walk-ins (P2): open now, active, and nobody has booked the next hour. */
async function freeNow(list: ResourceWithEligibility[]) {
  const now = new Date();
  const until = new Date(now.getTime() + 3_600_000);
  const p = istParts(now);
  const q = istParts(until);
  const hhmm = (x: { hour: number; minute: number }) => `${String(x.hour).padStart(2, "0")}:${String(x.minute).padStart(2, "0")}`;
  const open = list.filter((r) => r.status === "active" && r.slots.some((s) => s.weekday === p.weekday && s.start <= hhmm(p) && (q.weekday !== p.weekday ? s.end >= "23:59" : s.end >= hhmm(q))));
  const busy = await Promise.all(open.map((r) => api.getBusyTimes(r.id, now.toISOString(), until.toISOString()).catch(() => [{ start: "", end: "" }])));
  return open.filter((_, i) => busy[i].length === 0).map((r) => r.id);
}

export default function BrowsePage() {
  const [f, setF] = useState<ResourceFilters>({});
  const { data, error, loading, reload } = useQuery(() => api.listResources(f), [JSON.stringify(f)]);
  const { data: depts } = useQuery(() => api.listDepartments(), []);
  const [walkIn, setWalkIn] = useState(false);
  const free = useQuery(() => (walkIn && data ? freeNow(data) : Promise.resolve(null)), [walkIn, data]);
  const shown = walkIn ? (free.data ? (data ?? []).filter((r) => free.data!.includes(r.id)) : null) : data;
  const set = (k: keyof ResourceFilters) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value || undefined });
  const active = Object.values(f).some(Boolean) || walkIn;

  return (
    <div>
      <PageHeader eyebrow="every department, one list" title="What do you need today?" description="Each listing shows whether you can book it now or what you need first." />

      <div className="paper flex flex-wrap items-end gap-2 p-3 sm:p-4" role="search">
        <div className="relative min-w-[220px] flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2" />
          <Input placeholder="Search by name or place" value={f.q ?? ""} onChange={set("q")} className="pl-10" aria-label="Search resources" />
        </div>
        <div className="w-[150px]">
          <Select value={f.type ?? ""} onChange={set("type")} aria-label="Type">
            {TYPES.map((t) => (
              <option key={t.v} value={t.v}>
                {t.l}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-[180px]">
          <Select value={f.department ?? ""} onChange={set("department")} aria-label="Department">
            <option value="">All departments</option>
            {depts?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-[130px]">
          <Select value={f.tier ?? ""} onChange={set("tier")} aria-label="Tier">
            <option value="">Any tier</option>
            {[0, 1, 2, 3].map((t) => (
              <option key={t} value={t}>
                Tier {t}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-[160px]">
          <Input type="date" value={f.date ?? ""} onChange={set("date")} aria-label="Open on date" />
        </div>
        <Button type="button" variant={walkIn ? "default" : "outline"} aria-pressed={walkIn} onClick={() => setWalkIn((w) => !w)}>
          <ZapIcon /> Free right now
        </Button>
        {active && (
          <Button
            variant="ghost"
            onClick={() => {
              setF({});
              setWalkIn(false);
            }}
          >
            Clear
          </Button>
        )}
      </div>

      <div className="mt-6">
        {error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : (loading && !data) || (walkIn && !shown) ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <LoadingBlock rows={1} />
            <LoadingBlock rows={1} />
            <LoadingBlock rows={1} />
          </div>
        ) : shown && shown.length === 0 ? (
          <EmptyState
            title={walkIn ? "Nothing is free right now" : "Nothing matches those filters"}
            body={walkIn ? "Everything open is booked for the next hour. Book a later slot instead." : "Try another day or clear a filter."}
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setF({});
                  setWalkIn(false);
                }}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <>
            <p className="mb-3 text-sm text-ink/70" aria-live="polite">
              {shown?.length} resource{shown?.length === 1 ? "" : "s"}
              {walkIn && " free for the next hour"}
            </p>
            <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", loading && "opacity-60")}>
              {shown?.map((r) => (
                <ResourceCardView key={r.id} r={r} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
