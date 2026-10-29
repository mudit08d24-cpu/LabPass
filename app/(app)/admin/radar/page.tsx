"use client";

// Idle Radar (API.md "Admin and Idle Radar"): getIdleRadar(from, to) per resource and
// getIdleRadarHourly for the heatmap. Admins see every resource, owners their departments.

import { useId, useMemo, useState } from "react";
import { FlameIcon, MoonIcon } from "lucide-react";
import { RequireHat } from "@/components/layout/app-shell";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, Section, StatTile } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/misc";
import { api, type RadarHourly, type RadarRow } from "@/lib/screens";
import { useQuery } from "@/lib/screens/use-query";
import { cn, istDateKey, pct, WEEKDAYS } from "@/lib/utils";

const DAYS = WEEKDAYS; // Mon = 0, as A returns them
const IDLE_BELOW = 0.25;

function daysAgo(n: number) {
  return istDateKey(new Date(Date.now() - n * 86_400_000));
}

function UtilBars({ rows }: { rows: RadarRow[] }) {
  const sorted = [...rows].sort((a, b) => (b.utilisation ?? 0) - (a.utilisation ?? 0));
  return (
    <ul className="grid gap-3">
      {sorted.map((r) => (
        <li key={r.resourceId} className="group grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[minmax(0,10rem)_1fr_auto]" title={`${r.resourceName}: ${r.bookedHours} of ${r.availableHours} open hours booked`}>
          <span className="truncate text-sm font-semibold">{r.resourceName}</span>
          <span className="relative order-last col-span-2 h-5 rounded-full border-[1.5px] border-ink bg-paper sm:order-none sm:col-span-1">
            <span className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-700 group-hover:opacity-80", r.bottleneck ? "bg-ink" : (r.utilisation ?? 0) < IDLE_BELOW ? "bg-sun-2" : "bg-ink/55")} style={{ width: `max(${(r.utilisation ?? 0) * 100}%, 10px)` }} />
            <span className="absolute inset-y-0 left-[80%] border-l-2 border-dashed border-ink/60" aria-hidden />
          </span>
          <span className="flex items-center justify-end gap-2 text-sm sm:w-36">
            <b className="font-display">{pct(r.utilisation)}</b>
            {r.bottleneck && (
              <span className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-ink bg-coral px-1.5 text-[11px] font-semibold">
                <FlameIcon className="size-3" /> bottleneck
              </span>
            )}
            {r.utilisation !== null && r.utilisation < IDLE_BELOW && (
              <span className="inline-flex items-center gap-1 rounded-full border-[1.5px] border-ink bg-sun-soft px-1.5 text-[11px] font-semibold">
                <MoonIcon className="size-3" /> idle
              </span>
            )}
          </span>
        </li>
      ))}
      <li className="text-[12px] text-mute">Dashed line = 80%. Above it, demand is outrunning open hours.</li>
    </ul>
  );
}

function Heatmap({ rows }: { rows: RadarHourly[] }) {
  const [hover, setHover] = useState<{ d: number; h: number } | null>(null);
  const { HOURS, data, max } = useMemo(() => {
    const hrs = rows.map((r) => r.hour);
    const lo = Math.min(8, ...hrs);
    const hi = Math.max(19, ...hrs);
    const H = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    const grid = Array.from({ length: 7 }, () => H.map(() => 0));
    for (const r of rows) grid[r.weekday][r.hour - lo] += r.bookedHours;
    return { HOURS: H, data: grid, max: Math.max(0.0001, ...grid.flat()) };
  }, [rows]);
  const fmt = (v: number) => `${Math.round(v * 10) / 10} h booked`;
  return (
    <div>
      <div className="overflow-x-auto scrollbar-none">
        <table className="w-full min-w-[520px] border-separate border-spacing-[3px] text-[11px]">
          <caption className="sr-only">Booked hours by weekday and hour (India time)</caption>
          <thead>
            <tr>
              <th />
              {HOURS.map((h) => (
                <th key={h} scope="col" className="font-mono font-medium text-mute">
                  {h > 12 ? h - 12 : h}
                  {h >= 12 ? "p" : "a"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              <tr key={d}>
                <th scope="row" className="pr-1 text-right font-semibold">
                  {DAYS[d]}
                </th>
                {data[d].map((v, h) => (
                  <td
                    key={h}
                    onMouseEnter={() => setHover({ d, h })}
                    onMouseLeave={() => setHover(null)}
                    className={cn("h-7 rounded-md border-[1.5px]", hover?.d === d && hover.h === h ? "border-ink" : "border-transparent")}
                    style={{ background: `color-mix(in oklab, var(--color-ink) ${Math.round(8 + (v / max) * 85)}%, var(--color-paper))` }}
                    aria-label={`${DAYS[d]} ${HOURS[h]}:00, ${fmt(v)}`}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-[12px]">
        <span className="flex items-center gap-2">
          Less booked
          <span className="h-3 w-28 rounded-full border border-ink" style={{ background: "linear-gradient(90deg, color-mix(in oklab, var(--color-ink) 8%, var(--color-paper)), var(--color-ink))" }} />
          More booked
        </span>
        <span className="min-h-5 font-semibold" aria-live="polite">
          {hover ? `${DAYS[hover.d]} ${HOURS[hover.h] > 12 ? HOURS[hover.h] - 12 : HOURS[hover.h]}${HOURS[hover.h] >= 12 ? " pm" : " am"}: ${fmt(data[hover.d][hover.h])}` : "Hover a cell for its value"}
        </span>
      </div>
    </div>
  );
}

interface Week {
  week: string;
  utilisation: number;
  hours_unlocked: number;
}

function Trend({ weekly }: { weekly: Week[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 520, H = 180, P = { l: 36, r: 12, t: 14, b: 26 };
  const x = (i: number) => P.l + (i * (W - P.l - P.r)) / (weekly.length - 1);
  const top = Math.max(0.6, Math.ceil(Math.max(...weekly.map((w) => w.utilisation)) * 5) / 5);
  const y = (v: number) => P.t + (1 - v / top) * (H - P.t - P.b);
  const path = weekly.map((w, i) => `${i ? "L" : "M"}${x(i)} ${y(w.utilisation)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Average utilisation by week, from ${pct(weekly[0].utilisation)} to ${pct(weekly[weekly.length - 1].utilisation)}`} onMouseLeave={() => setHover(null)}>
      {Array.from({ length: Math.round(top / 0.2) + 1 }, (_, k) => k * 0.2).map((t) => (
        <g key={t}>
          <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} stroke="var(--color-ink)" strokeOpacity={0.12} />
          <text x={P.l - 6} y={y(t) + 4} textAnchor="end" style={{ font: "500 10px var(--font-mono)" }} fill="var(--color-mute)">
            {Math.round(t * 100)}%
          </text>
        </g>
      ))}
      {weekly.map((w, i) => (
        <text key={w.week} x={x(i)} y={H - 6} textAnchor="middle" style={{ font: "500 10px var(--font-mono)" }} fill="var(--color-mute)">
          {w.week}
        </text>
      ))}
      {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={P.t} y2={H - P.b} stroke="var(--color-ink)" strokeDasharray="3 3" />}
      <path d={path} fill="none" stroke="var(--color-ink)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {weekly.map((w, i) => (
        <g key={w.week}>
          <circle cx={x(i)} cy={y(w.utilisation)} r={hover === i ? 6 : 4.5} fill="var(--color-sun)" stroke="var(--color-ink)" strokeWidth={2} />
          <rect x={x(i) - 30} y={P.t} width={60} height={H - P.t - P.b} fill="transparent" onMouseEnter={() => setHover(i)} />
        </g>
      ))}
      <text x={x(weekly.length - 1) - 8} y={y(weekly[weekly.length - 1].utilisation) - 12} textAnchor="end" style={{ font: "700 12px var(--font-display)" }}>
        {pct(weekly[weekly.length - 1].utilisation)}
      </text>
      {hover !== null && (
        <g transform={`translate(${Math.min(x(hover) + 8, W - 130)} ${P.t + 4})`}>
          <rect width={120} height={40} rx={8} fill="var(--color-paper)" stroke="var(--color-ink)" strokeWidth={1.5} />
          <text x={10} y={17} style={{ font: "700 11px var(--font-sans)" }}>
            {weekly[hover].week}: {pct(weekly[hover].utilisation)} used
          </text>
          <text x={10} y={32} style={{ font: "500 11px var(--font-sans)" }} fill="var(--color-mute)">
            {weekly[hover].hours_unlocked} h unlocked that week
          </text>
        </g>
      )}
    </svg>
  );
}

function summarise(rows: RadarRow[]) {
  const avail = rows.reduce((s, r) => s + r.availableHours, 0);
  const booked = rows.reduce((s, r) => s + r.bookedHours, 0);
  const ns = rows.filter((r) => r.noShowRate !== null);
  return {
    utilisation: avail ? booked / avail : null,
    noShow: ns.length ? ns.reduce((s, r) => s + (r.noShowRate ?? 0), 0) / ns.length : null,
    waiting: rows.reduce((s, r) => s + r.waitlistLength, 0),
    unlocked: Math.round(rows.reduce((s, r) => s + r.hoursUnlocked, 0) * 10) / 10,
  };
}

export default function IdleRadarPage() {
  const ids = { from: useId(), to: useId() };
  const [range, setRange] = useState({ from: daysAgo(6), to: daysAgo(0) });
  const [view, setView] = useState<"chart" | "table">("chart");
  const { data, error, loading, reload } = useQuery(() => api.getIdleRadar(range.from, range.to), [range.from, range.to]);
  const rids = (data ?? []).map((r) => r.resourceId);
  const hourly = useQuery(() => (rids.length ? api.getIdleRadarHourly(rids, range.from, range.to) : Promise.resolve([])), [rids.join(","), range.from, range.to]);
  // last 4 weeks, one getIdleRadar call per week
  const weeks = useQuery(
    () =>
      Promise.all(
        [3, 2, 1, 0].map(async (w) => {
          const from = daysAgo(w * 7 + 6);
          const to = daysAgo(w * 7);
          const s = summarise(await api.getIdleRadar(from, to));
          return { week: w === 0 ? "This wk" : `${w} wk ago`, utilisation: s.utilisation ?? 0, hours_unlocked: s.unlocked };
        }),
      ),
    [],
  );

  const sum = summarise(data ?? []);
  const idle = (data ?? []).filter((r) => r.utilisation !== null && r.utilisation < IDLE_BELOW && !r.bottleneck);
  const hot = (data ?? []).filter((r) => r.bottleneck);

  return (
    <RequireHat hats={["admin", "owner"]}>
      <PageHeader
        eyebrow="where the idle hours are"
        title="Idle Radar"
        description="Booked vs open hours across shared resources, with peaks, dead hours and bottlenecks."
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <label htmlFor={ids.from} className="grid gap-1 text-[12px] font-semibold">
              From
              <Input id={ids.from} type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} className="h-10 w-40" />
            </label>
            <label htmlFor={ids.to} className="grid gap-1 text-[12px] font-semibold">
              To
              <Input id={ids.to} type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} className="h-10 w-40" />
            </label>
          </div>
        }
      />
      {error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingBlock rows={3} />
      ) : !data?.length ? (
        <EmptyState title="No resources to measure" body="Resources you can see appear here once they have open hours." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Hours unlocked" value={sum.unlocked} hint="Used under peer supervision" tone="ink" />
            <StatTile label="Avg utilisation" value={pct(sum.utilisation)} hint="Booked ÷ open hours" />
            <StatTile label="No-show rate" value={pct(sum.noShow)} hint="Average across resources" />
            <StatTile label="On waitlists" value={sum.waiting} hint="Students waiting now" tone="sun" />
          </div>

          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <Section
              title="Utilisation by resource"
              aside={
                <Tabs
                  value={view}
                  onChange={setView}
                  items={[
                    { value: "chart", label: "Chart" },
                    { value: "table", label: "Table" },
                  ]}
                />
              }
            >
              {view === "chart" ? (
                <UtilBars rows={data} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead>
                      <tr className="border-b-2 border-ink text-left text-[12px] uppercase tracking-[0.06em]">
                        <th className="py-2">Resource</th>
                        <th className="py-2 text-right">Booked h</th>
                        <th className="py-2 text-right">Used h</th>
                        <th className="py-2 text-right">Open h</th>
                        <th className="py-2 text-right">Booked</th>
                        <th className="py-2 text-right">No-shows</th>
                        <th className="py-2 text-right">Waiting</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((r) => (
                        <tr key={r.resourceId} className="border-b border-ink/15">
                          <td className="py-2 font-semibold">{r.resourceName}</td>
                          <td className="py-2 text-right tabular-nums">{r.bookedHours}</td>
                          <td className="py-2 text-right tabular-nums">{r.usedHours}</td>
                          <td className="py-2 text-right tabular-nums">{r.availableHours}</td>
                          <td className="py-2 text-right tabular-nums">{pct(r.utilisation)}</td>
                          <td className="py-2 text-right tabular-nums">{pct(r.noShowRate)}</td>
                          <td className="py-2 text-right tabular-nums">{r.waitlistLength}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>
            <Section title="What to do about it">
              {!hot.length && !idle.length ? (
                <p className="text-sm text-mute">Nothing stands out in this range.</p>
              ) : (
                <ul className="grid gap-3 text-sm">
                  {hot.map((r) => (
                    <li key={r.resourceId} className="rounded-xl border-2 border-ink bg-coral/60 p-3">
                      <p className="flex items-center gap-1.5 font-semibold">
                        <FlameIcon className="size-4" /> {r.resourceName} is a bottleneck
                      </p>
                      <p className="mt-1 text-ink/80">
                        {pct(r.utilisation)} booked and {r.waitlistLength} waiting. Approve another peer supervisor or extend open hours.
                      </p>
                    </li>
                  ))}
                  {idle.map((r) => (
                    <li key={r.resourceId} className="rounded-xl border-2 border-ink bg-sun-soft p-3">
                      <p className="flex items-center gap-1.5 font-semibold">
                        <MoonIcon className="size-4" /> {r.resourceName} sits idle
                      </p>
                      <p className="mt-1 text-ink/80">Only {pct(r.utilisation)} of open hours booked. Lower the tier or tell other departments it exists.</p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>

          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <Section title="Peak and dead hours" aside={<span className="text-[12px] text-mute">All resources above · India time</span>}>
              {hourly.data ? <Heatmap rows={hourly.data} /> : <LoadingBlock rows={2} />}
            </Section>
            <Section title="Utilisation by week" aside={<span className="text-[12px] text-mute">Last 4 weeks</span>}>
              {weeks.data ? <Trend weekly={weeks.data} /> : <LoadingBlock rows={2} />}
            </Section>
          </div>
        </>
      )}
    </RequireHat>
  );
}
