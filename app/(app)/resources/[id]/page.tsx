"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMemo } from "react";
import { BadgeCheckIcon, BookOpenCheckIcon, CalendarPlusIcon, ClockIcon, CoinsIcon, LockIcon, MapPinIcon, QrCodeIcon, ShieldCheckIcon, UsersIcon } from "lucide-react";
import { ResourceArt } from "@/components/art/resource-art";
import { AvailabilityWeek } from "@/components/shared/availability";
import { EligibilityBadge, ErrorBlock, LoadingBlock, Notice, PageHeader, Section, TierBadge, buttonVariants } from "@/components/shared";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/misc";
import { api } from "@/lib/screens";
import { creditRate, SHOW_DEPOSITS_TO_STUDENTS, TIER_TEXT } from "@/lib/screens/format";
import { hatsOf, useMe } from "@/lib/screens/session";
import { useQuery, useRules } from "@/lib/screens/use-query";
import { cn, fmtDateTime, fmtSlot, istDayStart } from "@/lib/utils";

export default function ResourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const range = useMemo(() => ({ from: istDayStart(0).toISOString(), to: istDayStart(7).toISOString() }), []);
  const rules = useRules();
  const hats = hatsOf(useMe());
  const staff = hats.includes("manager") || hats.includes("owner") || hats.includes("admin");
  const { data: r, error, loading, reload } = useQuery(() => api.getResource(id), [id]);
  const { data: busy } = useQuery(() => api.getBusyTimes(id, range.from, range.to), [id]);
  const { data: sup } = useQuery(() => (r && r.tier === 3 ? api.listSupervisorAvailability(id, range.from, range.to) : Promise.resolve([])), [id, r?.tier]);

  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (loading || !r) return <LoadingBlock rows={3} />;
  const rate = creditRate(rules, r.type);
  const elig = r.eligibility;
  const tier = TIER_TEXT[r.tier] ?? TIER_TEXT[0];
  const supervisors = Array.from(new Map((sup ?? []).map((s) => [s.supervisorId, s])).values());

  const next = !elig
    ? null
    : {
        eligible: { title: "You can book this", body: r.tier === 0 ? "Open to every verified student." : "You hold the badge this resource needs.", cta: { href: `/book/${r.id}`, label: "Request a slot", icon: <CalendarPlusIcon /> } },
        needs_quiz: { title: "Pass the safety quiz first", body: `A few questions about using the ${r.name} safely. Takes about 3 minutes.`, cta: { href: `/quiz/${r.id}`, label: "Take the quiz", icon: <BookOpenCheckIcon /> } },
        needs_certificate: {
          title: "Upload a certificate",
          body: `Independent use needs Tier 2: a certificate checked by the lab manager. Or book supervised sessions and graduate after ${rules?.graduation_sessions ?? "a few"} clean ones.`,
          cta: { href: `/certificates/${r.id}`, label: "Upload certificate", icon: <BadgeCheckIcon /> },
        },
        needs_supervisor: { title: "Book with a supervisor", body: "Supervised use only. Pick a staff or peer supervisor who has published hours for your slot.", cta: { href: `/book/${r.id}`, label: "Request a supervised slot", icon: <UsersIcon /> } },
        blocked: {
          title: "Booking is paused for you",
          body: `${elig.reason ?? "Your booking access is restricted."}${elig.until ? ` Until ${fmtDateTime(elig.until)}.` : ""} You can still view resources.`,
          cta: { href: "/passport", label: "See my passport", icon: <LockIcon /> },
        },
      }[elig.status];

  return (
    <div>
      <PageHeader
        back={{ href: "/browse", label: "All resources" }}
        eyebrow={`${r.departmentName} · ${r.type}`}
        title={r.name}
        actions={
          staff ? (
            <Link href={`/owner/resources/${r.id}/qr`} className={buttonVariants({ variant: "outline" })}>
              <QrCodeIcon /> Check-in QR
            </Link>
          ) : undefined
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {r.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPinIcon className="size-4" /> {r.location}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon className="size-4" /> Up to {r.maxHours} h per booking
            </span>
            {rate !== null && (
              <span className="inline-flex items-center gap-1.5">
                <CoinsIcon className="size-4" /> {rate} credit{rate === 1 ? "" : "s"} per hour
              </span>
            )}
          </span>
        }
      />
      {r.status !== "active" && (
        <div className="mb-6">
          <Notice tone="warn">{r.status === "maintenance" ? "Under maintenance. Booking is paused until the manager reopens it." : "This resource isn't taking bookings right now."}</Notice>
        </div>
      )}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-6">
          <Card className="overflow-hidden p-0">
            <div className="border-b-2 border-ink">
              {r.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.photoUrl} alt={r.name} className="aspect-[16/10] w-full object-cover" />
              ) : (
                <ResourceArt kind={r.art} bg="sun" label={r.name} />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 p-5 sm:p-6">
              <TierBadge tier={r.tier} />
              {elig && <EligibilityBadge value={elig.status} />}
              {r.depositAmount > 0 && (staff || SHOW_DEPOSITS_TO_STUDENTS) && <span className="text-[13px] text-mute">Deposit ₹{r.depositAmount} (shown only, never charged)</span>}
            </div>
          </Card>

          <Section title="Availability, next 7 days" aside={<span className="text-[13px] text-mute">Open hours set by the owner</span>}>
            <AvailabilityWeek slots={r.slots} busy={busy ?? []} />
          </Section>
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-6">
          {next && (
            <div className={cn("paper p-5 sm:p-6", elig?.status === "eligible" ? "bg-mint" : elig?.status === "blocked" ? "bg-coral/60" : "bg-sun-soft")}>
              <p className="text-[12px] font-bold uppercase tracking-[0.1em]">What you need</p>
              <h2 className="mt-1 font-display text-2xl font-bold">{next.title}</h2>
              <p className="mt-2 text-[15px] text-ink/80">{next.body}</p>
              {(r.status === "active" || elig?.status === "blocked") && (
                <Link href={next.cta.href} className={cn(buttonVariants({ size: "lg" }), "mt-4 w-full")}>
                  {next.cta.icon} {next.cta.label}
                </Link>
              )}
            </div>
          )}

          <Section title="Rules in plain words">
            <ul className="grid gap-2.5 text-[14px]">
              <li className="flex gap-2.5">
                <ShieldCheckIcon className="mt-0.5 size-4 shrink-0" />
                <span>
                  <b>{tier.name}:</b> {tier.need}.
                </span>
              </li>
              {rules && (
                <>
                  <li className="flex gap-2.5">
                    <ClockIcon className="mt-0.5 size-4 shrink-0" />
                    <span>
                      Max {r.maxHours} hours a booking and {r.weeklyCapHours} hours a week. Check in within {rules.checkin_grace_minutes} minutes of the start or it counts as a no-show.
                    </span>
                  </li>
                  <li className="flex gap-2.5">
                    <CoinsIcon className="mt-0.5 size-4 shrink-0" />
                    <span>
                      Credits are taken when the manager approves, and refunded if you cancel more than {rules.free_cancel_hours} hours before. You can hold {rules.max_active_bookings} active bookings at a time.
                    </span>
                  </li>
                </>
              )}
            </ul>
          </Section>

          {r.checklist.length > 0 && (
            <Section title="Handover checklist">
              <p className="mb-3 text-[13px] text-mute">You&apos;ll tick these and take a photo at check-in and at return.</p>
              <ul className="grid gap-1.5">
                {r.checklist.map((c) => (
                  <li key={c} className="flex items-center gap-2 text-[14px]">
                    <span className="size-4 rounded border-[1.5px] border-ink bg-paper" aria-hidden /> {c}
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {r.tier === 3 && (
            <Section title="Supervisors this week">
              {supervisors.length === 0 ? (
                <p className="text-sm text-mute">No supervisor has published hours in the next 7 days yet.</p>
              ) : (
                <ul className="grid gap-3">
                  {supervisors.map((s) => (
                    <li key={s.supervisorId} className="flex items-center gap-3">
                      <Avatar name={s.supervisorName} className={s.kind === "peer" ? "bg-lilac" : "bg-sky"} />
                      <span>
                        <span className="block text-sm font-semibold">{s.supervisorName}</span>
                        <span className="block text-[12px] text-mute">
                          {s.kind === "peer" ? "Peer supervisor" : "Staff"} · next {fmtSlot(s.start, s.end)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
