"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRightIcon, HourglassIcon, QrCodeIcon, Undo2Icon } from "lucide-react";
import { RequireHat } from "@/components/layout/app-shell";
import { CancelDialog } from "@/components/shared/cancel-dialog";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, ResourceThumb, SlotText, StatusBadge, buttonVariants } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/misc";
import { api, type Booking, type Rules } from "@/lib/screens";
import { checkInOpen } from "@/lib/screens/format";
import { useQuery, useRules } from "@/lib/screens/use-query";
import { cn } from "@/lib/utils";

const UPCOMING = ["requested", "approved", "waitlisted", "checked_in", "returned", "overdue"];

function Row({ b, rules, onCancel }: { b: Booking; rules: Rules | null; onCancel: () => void }) {
  const canCheckIn = checkInOpen(b, rules);
  return (
    <li className="paper flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
      <ResourceThumb resource={b.resource} className="w-full shrink-0 sm:w-28" />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={b.status} />
          {b.liveOffer && <span className="rounded-full border-[1.5px] border-ink bg-sun px-2 text-[11px] font-bold leading-5">Offer open!</span>}
          {b.supervisorName && <span className="text-[12px] text-mute">with {b.supervisorName}</span>}
        </div>
        <Link href={`/bookings/${b.id}`} className="mt-1.5 block font-display text-lg font-bold leading-tight hover:underline">
          {b.resource.name}
        </Link>
        <p className="text-[14px] text-ink/75">
          <SlotText start={b.start} end={b.end} />
          {b.creditsCharged > 0 && <> · {b.creditsCharged} credits</>}
        </p>
        {b.reason && ["rejected", "waitlisted", "cancelled"].includes(b.status) && <p className="mt-1 text-[13px] text-ink/70">“{b.reason}”</p>}
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {canCheckIn && (
          <Link href={`/check-in/${b.id}`} className={buttonVariants({ size: "sm" })}>
            <QrCodeIcon /> Check in
          </Link>
        )}
        {b.status === "approved" && !canCheckIn && <span className="self-center text-[12px] text-mute">Check-in opens {rules?.checkin_grace_minutes ?? "–"} min before</span>}
        {(b.status === "checked_in" || b.status === "overdue") && (
          <Link href={`/return/${b.id}`} className={buttonVariants({ size: "sm" })}>
            <Undo2Icon /> Return
          </Link>
        )}
        {b.status === "waitlisted" && (
          <Link href={`/bookings/${b.id}`} className={buttonVariants({ size: "sm", variant: b.liveOffer ? "default" : "outline" })}>
            <HourglassIcon /> {b.liveOffer ? "Accept offer" : "See my place"}
          </Link>
        )}
        {["requested", "approved", "waitlisted"].includes(b.status) && (
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Link href={`/bookings/${b.id}`} className={cn(buttonVariants({ size: "sm", variant: "outline" }))} aria-label={`Details for ${b.resource.name}`}>
          Details <ArrowRightIcon />
        </Link>
      </div>
    </li>
  );
}

export default function MyBookingsPage() {
  const rules = useRules();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [cancel, setCancel] = useState<Booking | null>(null);
  const { data, error, loading, reload } = useQuery(() => api.listMyBookings(), []);
  const up = data?.filter((b) => UPCOMING.includes(b.status)).sort((a, b) => a.start.localeCompare(b.start)) ?? [];
  const past = data?.filter((b) => !UPCOMING.includes(b.status)).sort((a, b) => b.start.localeCompare(a.start)) ?? [];
  const list = tab === "upcoming" ? up : past;

  return (
    <RequireHat hats={["student"]}>
      <PageHeader
        eyebrow="your slots"
        title="My bookings"
        description={rules ? `You can hold ${rules.max_active_bookings} active bookings at a time.` : undefined}
        actions={
          <Link href="/browse" className={buttonVariants()}>
            Book something
          </Link>
        }
      />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "upcoming", label: "Upcoming", count: up.length },
          { value: "past", label: "Past", count: past.length },
        ]}
      />
      <div className="mt-5">
        {error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingBlock />
        ) : list.length === 0 ? (
          <EmptyState
            title={tab === "upcoming" ? "No upcoming bookings" : "Nothing here yet"}
            body={tab === "upcoming" ? "Find something idle and request a slot." : "Finished and cancelled bookings show up here."}
            art="person"
            action={
              tab === "upcoming" ? (
                <Link href="/browse" className={buttonVariants()}>
                  Browse resources
                </Link>
              ) : undefined
            }
          />
        ) : (
          <ul className="grid gap-3">
            {list.map((b) => (
              <Row key={b.id} b={b} rules={rules} onCancel={() => setCancel(b)} />
            ))}
          </ul>
        )}
      </div>
      <CancelDialog booking={cancel} onClose={() => setCancel(null)} />
    </RequireHat>
  );
}
