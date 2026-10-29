"use client";

// Booking request (API.md "Bookings"): evaluateBooking shows A's checklist live as the student
// picks a slot; requestBooking sends it. Blocking failures stop the request, non-blocking ones
// (a taken slot) are warnings: the request can still be sent and waitlisted.

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { z } from "zod";
import { CircleCheckIcon, CoinsIcon } from "lucide-react";
import { AvailabilityWeek } from "@/components/shared/availability";
import { ChecksList, ErrorBlock, LoadingBlock, Notice, PageHeader, ResourceThumb, ScoreBreakdown, Section, SlotText, TierBadge, buttonVariants } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api, type Evaluation } from "@/lib/screens";
import { creditRate, SHOW_DEPOSITS_TO_STUDENTS } from "@/lib/screens/format";
import { useMe } from "@/lib/screens/session";
import { useQuery, useRules } from "@/lib/screens/use-query";
import { cn, fmtDateTime, fmtTime, hoursBetween, istDayStart } from "@/lib/utils";

const schema = z.object({
  start: z.string().min(1, "Pick a start time on the calendar"),
  purpose: z.string().trim().min(10, "Say in a sentence what you'll use it for (at least 10 characters)"),
});

export default function BookPage() {
  const { resourceId } = useParams<{ resourceId: string }>();
  const me = useMe();
  const rules = useRules();
  const toast = useToast();
  const ids = { purpose: useId(), dur: useId(), sup: useId() };
  const range = useMemo(() => ({ from: istDayStart(0).toISOString(), to: istDayStart(7).toISOString() }), []);
  const { data: r, error, loading, reload } = useQuery(() => api.getResource(resourceId), [resourceId]);
  const { data: busy } = useQuery(() => api.getBusyTimes(resourceId, range.from, range.to), [resourceId]);
  const { data: windows } = useQuery(() => (r && r.tier === 3 ? api.listSupervisorAvailability(resourceId, range.from, range.to) : Promise.resolve([])), [resourceId, r?.tier]);
  const [start, setStart] = useState<string | null>(null);
  const [dur, setDur] = useState(1);
  const [purpose, setPurpose] = useState("");
  const [sup, setSup] = useState("");
  const [ev, setEv] = useState<Evaluation | null>(null);
  const [evErr, setEvErr] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<string[] | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ bookingId: string; start: string; end: string } | null>(null);

  const end = useMemo(() => (start ? new Date(new Date(start).getTime() + dur * 3_600_000).toISOString() : null), [start, dur]);
  const durations = useMemo(() => {
    const max = r?.maxHours ?? 1;
    const out = Array.from({ length: Math.max(1, Math.floor(max)) }, (_, i) => i + 1);
    if (max < 1) return [max];
    if (max % 1) out.push(max);
    return out;
  }, [r?.maxHours]);

  // supervisors whose published hours cover the whole slot
  const free = useMemo(() => {
    if (!start || !end) return [];
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    const seen = new Map<string, NonNullable<typeof windows>[number]>();
    for (const w of windows ?? []) if (new Date(w.start).getTime() <= s && new Date(w.end).getTime() >= e && !seen.has(w.supervisorId)) seen.set(w.supervisorId, w);
    return Array.from(seen.values());
  }, [windows, start, end]);

  useEffect(() => {
    if (sup && !free.some((f) => f.supervisorId === sup)) setSup("");
  }, [free, sup]);

  useEffect(() => {
    if (r) setDur((d) => Math.min(d, r.maxHours));
  }, [r]);

  useEffect(() => {
    if (!r || !start || !end) {
      setEv(null);
      return;
    }
    let live = true;
    const t = setTimeout(async () => {
      const out = await api.evaluateBooking(r.id, start, end, sup || null);
      if (!live) return;
      if (out.ok) {
        setEv(out.data);
        setEvErr(null);
      } else {
        setEv(null);
        setEvErr(out.error);
      }
    }, 250);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [r, start, end, sup]);

  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (loading || !r) return <LoadingBlock rows={3} />;

  const rate = creditRate(rules, r.type) ?? 0;
  const cost = ev?.cost ?? (start ? Math.ceil(hoursBetween(start, end!) * rate) : 0);
  const blocking = ev?.checks.filter((c) => !c.ok && c.blocking) ?? [];
  const warnings = ev?.checks.filter((c) => !c.ok && !c.blocking) ?? [];
  const needsSup = r.tier === 3 || ev?.needsSupervisor;

  if (done) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="paper bg-mint p-6 text-center sm:p-8">
          <CircleCheckIcon className="mx-auto size-10" />
          <h1 className="mt-2 text-3xl font-extrabold">Request sent</h1>
          <p className="mt-2 text-[15px]">
            {r.name} · <SlotText start={done.start} end={done.end} />
          </p>
          <p className="mt-1 text-sm text-ink/75">The lab manager will approve, reject or waitlist it. You&apos;ll get a notification either way, with a reason.</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <Link href={`/bookings/${done.bookingId}`} className={buttonVariants({ size: "lg" })}>
              View booking
            </Link>
            <Link href="/browse" className={buttonVariants({ size: "lg", variant: "outline" })}>
              Browse more
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader back={{ href: `/resources/${r.id}`, label: r.name }} eyebrow="request a slot" title={`Book the ${r.name}`} />
      <form
        noValidate
        className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"
        onSubmit={async (e) => {
          e.preventDefault();
          const p = schema.safeParse({ start: start ?? "", purpose });
          const errs: Record<string, string> = p.success ? {} : Object.fromEntries(p.error.issues.map((i) => [String(i.path[0]), i.message]));
          if (needsSup && !sup) errs.sup = "This needs a supervisor. Pick one who's free for your slot.";
          setErrors(errs);
          if (Object.keys(errs).length) return;
          setSending(true);
          setReasons(null);
          const res = await api.requestBooking(r.id, start!, end!, purpose.trim(), sup || null);
          setSending(false);
          if (!res.ok) {
            setReasons(res.reasons ?? null);
            toast.error("Request not sent", res.error);
            return;
          }
          toast.success("Request sent", "We'll notify you when the manager decides.");
          setDone({ bookingId: res.data.bookingId, start: start!, end: end! });
        }}
      >
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-6">
          <Section title="1 · Pick a start time" aside={errors.start ? <span className="text-[13px] font-medium text-red-ink">{errors.start}</span> : <span className="text-[13px] text-mute">Tap a free hour</span>}>
            <AvailabilityWeek slots={r.slots} busy={busy ?? []} onPick={(s) => setStart(s)} selected={start && end ? { start, end } : null} />
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field id={ids.dur} label="How long?" hint={`Max ${r.maxHours} hours per booking`}>
                <Select id={ids.dur} value={dur} onChange={(e) => setDur(+e.target.value)}>
                  {durations.map((h) => (
                    <option key={h} value={h}>
                      {h} hour{h === 1 ? "" : "s"}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid gap-1.5">
                <span className="text-sm font-semibold">Your slot</span>
                <div className={cn("flex h-11 items-center rounded-xl border-2 border-ink px-3.5 text-[15px]", start ? "bg-sun-soft font-semibold" : "bg-white/60 text-mute")}>{start && end ? `${fmtDateTime(start)}–${fmtTime(end)}` : "Not picked yet"}</div>
              </div>
            </div>
          </Section>

          <Section title="2 · Tell the manager why">
            <Field id={ids.purpose} label="Purpose" error={errors.purpose} hint={`Shown to the manager. Mention deadlines: a faculty-verified deadline adds +${rules?.priority_deadline_bonus ?? "–"} to your priority.`}>
              <Textarea id={ids.purpose} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Measuring the PWM output of my motor driver for the mini-project demo on Friday" aria-invalid={!!errors.purpose} />
            </Field>
          </Section>

          {needsSup && (
            <Section title="3 · Choose a supervisor">
              {!start ? (
                <p className="text-sm text-mute">Pick a time first to see who&apos;s free.</p>
              ) : (
                <Field id={ids.sup} label="Supervisor" error={errors.sup} hint={`Peer supervisors earn ${rules?.supervisor_reward_per_hour ?? "–"} credit per hour for co-signing.`}>
                  <div className="grid gap-2" role="radiogroup" id={ids.sup}>
                    {free.length === 0 && <p className="rounded-xl border-2 border-dashed border-ink/40 px-3 py-4 text-center text-[13px] text-mute">Nobody has published hours covering this slot. Try another time.</p>}
                    {free.map((s) => (
                      <button
                        key={s.supervisorId}
                        type="button"
                        role="radio"
                        aria-checked={sup === s.supervisorId}
                        onClick={() => setSup(s.supervisorId)}
                        className={cn("flex items-center justify-between gap-3 rounded-xl border-2 border-ink px-4 py-3 text-left", sup === s.supervisorId ? "bg-ink text-paper" : "bg-white hover:bg-sun-soft")}
                      >
                        <span>
                          <span className="block text-sm font-semibold">{s.supervisorName}</span>
                          <span className={cn("block text-[12px]", sup === s.supervisorId ? "text-paper/70" : "text-mute")}>
                            {s.kind === "staff" ? "Staff" : "Peer supervisor"} · free {fmtTime(s.start)}–{fmtTime(s.end)}
                          </span>
                        </span>
                        {sup === s.supervisorId && <span className="rounded-full bg-sun px-2 text-[11px] font-bold text-ink">Chosen</span>}
                      </button>
                    ))}
                  </div>
                </Field>
              )}
            </Section>
          )}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          <div className="paper p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <ResourceThumb resource={r} className="w-20 shrink-0" />
              <div className="min-w-0">
                <p className="font-display text-lg font-bold leading-tight">{r.name}</p>
                <p className="mt-1 flex items-center gap-2 text-[13px] text-mute">
                  <TierBadge tier={r.tier} /> {r.departmentName}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl border-2 border-ink bg-sun-soft px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <CoinsIcon className="size-4" /> Cost
              </span>
              <span className="text-right">
                <span className="block font-display text-xl font-extrabold">{cost} credits</span>
                <span className="block text-[12px] text-ink/70">You have {me.credits}. Taken when approved.</span>
              </span>
            </div>
            {SHOW_DEPOSITS_TO_STUDENTS && r.depositAmount > 0 && <p className="mt-2 text-[12px] text-mute">Deposit ₹{r.depositAmount} is shown for reference only. Nothing is charged.</p>}

            <h2 className="mt-5 text-[12px] font-bold uppercase tracking-[0.1em]">Checks</h2>
            <div className="mt-2" aria-live="polite">
              {ev ? (
                <ChecksList checks={ev.checks} />
              ) : evErr ? (
                <Notice tone="warn">{evErr}</Notice>
              ) : (
                <p className="rounded-xl border-2 border-dashed border-ink/40 px-3 py-4 text-center text-[13px] text-mute">Pick a slot and every rule is checked here: eligibility, conflicts, caps, credits, supervisor and open incidents.</p>
              )}
            </div>
            {warnings.length > 0 && !blocking.length && (
              <div className="mt-3">
                <Notice tone="warn">You can still send this. The manager may waitlist you, and you&apos;ll get a {rules?.waitlist_offer_minutes ?? "–"}-minute offer if the slot frees up.</Notice>
              </div>
            )}
            {ev?.priority && (
              <details className="mt-4 rounded-xl border-2 border-ink bg-paper px-4 py-3">
                <summary className="cursor-pointer text-sm font-semibold">Your priority if it comes to a waitlist: {Math.round(ev.priority.score)}</summary>
                <div className="mt-3">
                  <ScoreBreakdown breakdown={ev.priority.breakdown} rules={rules} total={ev.priority.score} />
                </div>
              </details>
            )}
            {reasons && reasons.length > 0 && (
              <ul role="alert" className="mt-3 grid list-disc gap-1 rounded-xl border-2 border-ink bg-coral/70 py-2.5 pl-8 pr-3 text-sm">
                {reasons.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            )}
            <Button type="submit" size="lg" className="mt-5 w-full" loading={sending} disabled={!!blocking.length}>
              {warnings.length ? "Request & join waitlist" : "Send request"}
            </Button>
            {blocking.length > 0 && <p className="mt-2 text-center text-[13px] text-red-ink">Fix the red checks to send this request.</p>}
          </div>
        </div>
      </form>
    </div>
  );
}
