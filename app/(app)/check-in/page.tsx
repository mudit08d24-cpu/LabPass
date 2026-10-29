"use client";

// Where the printed QR sends a phone camera: /check-in?code=3FA09C1B (API.md "QR codes and check-in").
// checkIn(code) finds the student's approved booking whose window is open at this resource.
// Its condition report must already be saved, so if check-in is refused we send the student
// to the booking's own check-in screen, which walks through the report first.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CircleCheckIcon } from "lucide-react";
import { EmptyState, LoadingBlock, Notice, PageHeader, QrScanner, ResourceThumb, SlotText, buttonVariants } from "@/components/shared";
import { api, type Booking } from "@/lib/screens";
import { checkInOpen } from "@/lib/screens/format";
import { useQuery, useRules } from "@/lib/screens/use-query";
import { cn } from "@/lib/utils";

export default function CheckInByCodePage() {
  const router = useRouter();
  const rules = useRules();
  const [code, setCode] = useState<string | null>(null);
  const [state, setState] = useState<{ busy: boolean; error: string | null; doneId: string | null }>({ busy: false, error: null, doneId: null });
  const tried = useRef<string | null>(null);
  const { data: mine } = useQuery(() => api.listMyBookings(), []);
  const open = useMemo(() => (mine ?? []).filter((b) => checkInOpen(b, rules)), [mine, rules]);

  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get("code");
    if (c) setCode(c);
  }, []);

  useEffect(() => {
    if (!code || tried.current === code) return;
    tried.current = code;
    setState({ busy: true, error: null, doneId: null });
    api.checkIn(code).then((r) => setState({ busy: false, error: r.ok ? null : r.error, doneId: r.ok ? r.data.bookingId : null }));
  }, [code]);

  if (state.doneId) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="paper bg-mint p-6 text-center">
          <CircleCheckIcon className="mx-auto size-10" />
          <h1 className="mt-2 text-2xl font-extrabold">You&apos;re checked in</h1>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href={`/bookings/${state.doneId}`} className={buttonVariants()}>
              View booking
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader eyebrow="check in" title="Scan to start" description="Scan the QR on the resource, or type the code printed under it." />
      <div className="grid gap-5">
        {state.busy && <LoadingBlock rows={1} />}
        {state.error && (
          <Notice tone="warn">
            <p className="font-semibold">{state.error}</p>
            {open.length > 0 && <p className="mt-1">Open your booking below: it walks you through the condition report, then check-in.</p>}
          </Notice>
        )}
        {open.length > 0 && (
          <ul className="grid gap-2">
            {open.map((b: Booking) => (
              <li key={b.id}>
                <button type="button" onClick={() => router.push(`/check-in/${b.id}`)} className={cn("paper flex w-full items-center gap-3 p-3 text-left hover:bg-white")}>
                  <ResourceThumb resource={b.resource} className="w-20 shrink-0" />
                  <span className="min-w-0">
                    <span className="block font-display font-bold">{b.resource.name}</span>
                    <span className="block text-[13px] text-ink/75">
                      <SlotText start={b.start} end={b.end} />
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="paper p-5">
          <QrScanner
            onCode={(c) => {
              tried.current = null;
              setCode(c);
            }}
          />
        </div>
        {mine && open.length === 0 && !state.busy && (
          <EmptyState
            title="No booking is open for check-in right now"
            body={rules ? `Check-in opens ${rules.checkin_grace_minutes} minutes before your start time.` : undefined}
            art="cat"
            action={
              <Link href="/bookings" className={buttonVariants({ variant: "outline" })}>
                My bookings
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}
