"use client";

import Link from "next/link";
import { ArrowRightIcon, ClockIcon, MapPinIcon } from "lucide-react";
import { ResourceArt } from "@/components/art/resource-art";
import { EligibilityBadge, TierBadge } from "@/components/shared";
import type { ResourceWithEligibility } from "@/lib/screens/types";
import { WEEKDAYS } from "@/lib/utils";

function openDays(r: ResourceWithEligibility) {
  const days = Array.from(new Set(r.slots.map((s) => s.weekday))).sort();
  if (!days.length) return "No open hours yet";
  const first = r.slots[0];
  const range = days.length > 1 && days[days.length - 1] - days[0] === days.length - 1 ? `${WEEKDAYS[days[0]]}–${WEEKDAYS[days[days.length - 1]]}` : days.map((d) => WEEKDAYS[d]).join(", ");
  return `${range}, ${first.start}–${first.end}`;
}

export function ResourceCardView({ r }: { r: ResourceWithEligibility }) {
  return (
    <Link href={`/resources/${r.id}`} className="paper group flex flex-col overflow-hidden p-0 transition-transform hover:-translate-y-1 hover:shadow-pop-lg">
      <div className="relative border-b-2 border-ink">
        {r.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.photoUrl} alt={r.name} className="aspect-[16/10] w-full object-cover" />
        ) : (
          <ResourceArt kind={r.art} bg="sun" label={r.name} />
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          <TierBadge tier={r.tier} />
          <span className="rounded-full border-[1.5px] border-ink bg-paper px-2 text-[11px] font-semibold capitalize leading-5">{r.type}</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-[12px] font-bold uppercase tracking-[0.08em] text-mute">{r.departmentName}</p>
        <h3 className="mt-0.5 font-display text-lg font-bold leading-tight">{r.name}</h3>
        {r.location && (
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink/75">
            <MapPinIcon className="size-3.5 shrink-0" /> {r.location}
          </p>
        )}
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink/75">
          <ClockIcon className="size-3.5 shrink-0" /> {openDays(r)}
        </p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-4">
          {r.eligibility ? <EligibilityBadge value={r.eligibility.status} /> : <span />}
          <span className="inline-flex items-center gap-1 text-[13px] font-semibold group-hover:underline">
            View <ArrowRightIcon className="size-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
