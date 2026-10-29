"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { BadgeCheckIcon, BookOpenCheckIcon, GraduationCapIcon } from "lucide-react";
import { RequireHat } from "@/components/layout/app-shell";
import { LogoMark } from "@/components/layout/logo";
import { EmptyState, ErrorBlock, LoadingBlock, Notice, PageHeader, Section, buttonVariants } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/misc";
import { api, type BadgeKind } from "@/lib/screens";
import { useQuery, useRules } from "@/lib/screens/use-query";
import { cn, fmtDateTime, fmtDay } from "@/lib/utils";

const KIND: Record<BadgeKind, { label: string; icon: ReactNode; bg: string }> = {
  quiz: { label: "Tier 1 · Safety quiz", icon: <BookOpenCheckIcon />, bg: "bg-sun-soft" },
  certificate: { label: "Tier 2 · Certified", icon: <BadgeCheckIcon />, bg: "bg-mint" },
  graduation: { label: "Tier 2 · Graduated", icon: <GraduationCapIcon />, bg: "bg-lilac" },
};

export default function PassportPage() {
  const rules = useRules();
  const { data, error, loading, reload } = useQuery(() => api.getPassport(), []);
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingBlock rows={3} />;
  const p = data.me;
  const earned = data.badges.filter((b) => b.status === "approved");
  const others = data.badges.filter((b) => b.status !== "approved");
  const blocked = p.blockedUntil && new Date(p.blockedUntil).getTime() > Date.now();

  return (
    <RequireHat hats={["student"]}>
      <PageHeader eyebrow="your skills passport" title="Passport" description="Badges you've earned, progress toward the next tier, and your credits." />
      {blocked && (
        <div className="mb-6">
          <Notice tone="warn">
            Booking is paused until {fmtDateTime(p.blockedUntil!)}.{p.blockReason ? ` ${p.blockReason}` : ""} You can still view resources and finish what you&apos;ve started.
          </Notice>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="grid content-start gap-6">
          <div className="paper relative overflow-hidden bg-ink p-6 text-paper shadow-pop-lg">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2 font-display text-[13px] font-extrabold tracking-[0.14em] text-sun">
                <LogoMark className="h-4" /> LABPASS
              </span>
              <span className="rounded-full bg-sun px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-ink">{p.supervises.length ? "Peer supervisor" : "Student"}</span>
            </div>
            <div className="mt-5 flex items-center gap-4">
              <Avatar name={p.name} className="size-16 bg-sun text-xl text-ink" />
              <div>
                <p className="font-display text-2xl font-bold">{p.name}</p>
                {p.rollNo && <p className="font-mono text-[13px] text-paper/70">{p.rollNo}</p>}
                <p className="text-[13px] text-paper/70">{p.departmentName ?? "Department not set yet"}</p>
              </div>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl border-2 border-paper/30 py-2">
                <p className="font-display text-2xl font-extrabold text-sun">{earned.length}</p>
                <p className="text-[11px] text-paper/70">badges</p>
              </div>
              <div className="rounded-xl border-2 border-paper/30 py-2">
                <p className="font-display text-2xl font-extrabold text-sun">{data.balance}</p>
                <p className="text-[11px] text-paper/70">credits</p>
              </div>
              <div className="rounded-xl border-2 border-paper/30 py-2">
                <p className="font-display text-2xl font-extrabold text-sun">{blocked || p.status !== "active" ? "Hold" : "OK"}</p>
                <p className="text-[11px] text-paper/70">standing</p>
              </div>
            </div>
          </div>

          <Section title="Credits" aside={rules && <span className="text-[12px] text-mute">{rules.weekly_credit_budget} sponsored each week</span>}>
            <p className="font-display text-4xl font-extrabold">{data.balance}</p>
            {data.history.length === 0 ? (
              <p className="mt-3 text-sm text-mute">No credit changes yet.</p>
            ) : (
              <ul className="mt-3 divide-y-2 divide-dashed divide-ink/15">
                {data.history.slice(0, 8).map((l, i) => (
                  <li key={`${l.createdAt}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span>
                      <span className="block">{l.reason}</span>
                      <span className="text-[12px] text-mute">{fmtDay(l.createdAt)}</span>
                    </span>
                    <span className={cn("font-display font-bold", l.change > 0 ? "text-green-ink" : "")}>
                      {l.change > 0 ? "+" : ""}
                      {l.change}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <div className="grid content-start gap-6">
          <Section title="Badges">
            {earned.length === 0 ? (
              <EmptyState
                title="No badges yet"
                body="Take a short safety quiz to earn your first Tier 1 badge."
                action={
                  <Link href="/browse" className={buttonVariants()}>
                    Find a quiz
                  </Link>
                }
              />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {earned.map((b) => (
                  <li key={b.userBadgeId}>
                    <Link href={`/resources/${b.resourceId}`} className={cn("flex items-start gap-3 rounded-2xl border-2 border-ink p-3 hover:-translate-y-0.5", KIND[b.kind].bg)}>
                      <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink bg-paper [&_svg]:size-5">{KIND[b.kind].icon}</span>
                      <span>
                        <span className="block text-[11px] font-bold uppercase tracking-[0.08em]">{KIND[b.kind].label}</span>
                        <span className="block font-semibold leading-tight">{b.resourceName}</span>
                        {b.grantedAt && <span className="block text-[12px] text-ink/70">Earned {fmtDay(b.grantedAt)}</span>}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {others.length > 0 && (
              <ul className="mt-4 grid gap-2">
                {others.map((b) => (
                  <li key={b.userBadgeId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-[1.5px] border-ink bg-paper px-3 py-2 text-sm">
                    <span>
                      <span className="font-semibold">{b.name}</span> · {b.resourceName}
                      {b.reason && <span className="block text-[12px] text-ink/70">“{b.reason}”</span>}
                    </span>
                    <Badge tone={b.status === "pending" ? "sun" : "coral"}>{b.status === "pending" ? "Waiting for manager" : b.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Graduation progress" aside={<span className="text-[12px] text-mute">Tier 3 → Tier 2</span>}>
            {data.graduation.length === 0 ? (
              <p className="text-sm text-mute">Nothing in progress. Book a supervised (Tier 3) machine to start; after {rules?.graduation_sessions ?? "a few"} clean sessions the manager can graduate you.</p>
            ) : (
              <ul className="grid gap-4">
                {data.graduation.map((g) => (
                  <li key={g.resourceId}>
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-semibold">{g.resourceName}</span>
                      <span>{g.progress.graduated ? "Graduated" : `${Math.min(g.progress.cleanSessions, g.progress.required)} of ${g.progress.required} clean sessions`}</span>
                    </div>
                    <div className="mt-2 flex gap-2">
                      {Array.from({ length: g.progress.required }, (_, i) => (
                        <span key={i} className={cn("h-3 flex-1 rounded-full border-[1.5px] border-ink", i < g.progress.cleanSessions || g.progress.graduated ? "bg-ink" : "bg-paper")} />
                      ))}
                    </div>
                    <p className="mt-1.5 text-[12px] text-mute">{g.progress.readyForSignoff && !g.progress.graduated ? "Ready: the lab manager can sign you off." : "A session counts when it's supervised, completed and has no incident."}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
      </div>
    </RequireHat>
  );
}
