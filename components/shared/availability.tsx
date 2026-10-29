"use client";

// 7-day grid of a resource's open hours (A's availability_slots, Mon = 0, IST) with booked
// hours from resource_busy_times. Free hours are buttons when onPick is given.

import { useMemo } from "react";
import type { Slot } from "@/lib/screens/types";
import { cn, istDate, istParts, WEEKDAYS } from "@/lib/utils";

export interface Busy {
  start: string;
  end: string;
}

export function useWeek(days = 7) {
  return useMemo(() => {
    const t = istParts(new Date());
    return Array.from({ length: days }, (_, i) => {
      const start = istDate(t.year, t.month, t.day + i);
      const p = istParts(start);
      return { start, weekday: p.weekday, day: p.day, month: p.month, year: p.year };
    });
  }, [days]);
}

export function AvailabilityWeek({ slots, busy, onPick, selected, days = 7 }: { slots: Slot[]; busy: Busy[]; onPick?: (startIso: string) => void; selected?: Busy | null; days?: number }) {
  const week = useWeek(days);
  const hours = useMemo(() => {
    const starts = slots.map((s) => +s.start.slice(0, 2));
    const ends = slots.map((s) => Math.ceil(+s.end.slice(0, 2) + +s.end.slice(3, 5) / 60));
    const lo = starts.length ? Math.min(...starts) : 9;
    const hi = ends.length ? Math.max(...ends) : 17;
    return Array.from({ length: Math.max(0, hi - lo) }, (_, i) => lo + i);
  }, [slots]);

  if (!slots.length) return <p className="text-sm text-mute">The owner hasn&apos;t published open hours for this resource yet.</p>;

  return (
    <div>
      <div className="overflow-x-auto scrollbar-none">
        <table className="w-full min-w-[520px] border-separate border-spacing-1 text-[12px]">
          <caption className="sr-only">Open and booked hours for the next {days} days (India time)</caption>
          <thead>
            <tr>
              <th className="w-12" />
              {week.map((d) => (
                <th key={d.start.toISOString()} scope="col" className="pb-1 text-center font-semibold">
                  <span className="block text-mute">{WEEKDAYS[d.weekday]}</span>
                  <span className="font-display text-sm">{d.day}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((h) => (
              <tr key={h}>
                <th scope="row" className="pr-1 text-right font-mono text-[11px] font-medium text-mute">
                  {h > 12 ? h - 12 : h}
                  {h >= 12 ? "p" : "a"}
                </th>
                {week.map((d) => {
                  const s = istDate(d.year, d.month, d.day, h);
                  const e = new Date(s.getTime() + 3_600_000);
                  const hh = `${String(h).padStart(2, "0")}:00`;
                  const he = `${String(h + 1).padStart(2, "0")}:00`;
                  const open = slots.some((sl) => sl.weekday === d.weekday && sl.start <= hh && sl.end >= he);
                  const taken = busy.some((x) => new Date(x.start) < e && new Date(x.end) > s);
                  const past = s.getTime() < Date.now();
                  const sel = selected && new Date(selected.start) < e && new Date(selected.end) > s;
                  const label = `${WEEKDAYS[d.weekday]} ${d.day}, ${h}:00`;
                  if (!open) return <td key={d.start.toISOString()} className="h-7 rounded-md bg-ink/[0.06]" aria-label={`${label} closed`} />;
                  if (taken) return <td key={d.start.toISOString()} className={cn("h-7 rounded-md border-[1.5px] border-ink bg-ink", sel && "outline outline-2 outline-offset-1 outline-coral")} aria-label={`${label} booked`} title="Booked" />;
                  if (past) return <td key={d.start.toISOString()} className="h-7 rounded-md bg-paper/40" aria-label={`${label} past`} />;
                  return (
                    <td key={d.start.toISOString()} className="h-7 p-0">
                      {onPick ? (
                        <button type="button" onClick={() => onPick(s.toISOString())} className={cn("block h-7 w-full rounded-md border-[1.5px] transition-colors hover:border-ink hover:bg-sun", sel ? "border-ink bg-sun" : "border-ink/40 bg-paper")} aria-label={`${label} free, choose`} aria-pressed={!!sel} />
                      ) : (
                        <span className="block h-7 rounded-md border-[1.5px] border-ink/30 bg-paper" aria-label={`${label} free`} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-2 flex flex-wrap gap-4 text-[12px] text-ink/75">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded border-[1.5px] border-ink/40 bg-paper" /> Free
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-ink" /> Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-ink/10" /> Closed
        </span>
        <span>Times in India time (IST)</span>
      </div>
    </div>
  );
}
