"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowRightIcon, BadgeCheckIcon, CameraIcon, ChevronDownIcon, ClipboardCheckIcon, HistoryIcon, KeyRoundIcon, MenuIcon, QrCodeIcon, ScaleIcon, SearchIcon, ShieldCheckIcon, SparklesIcon, UserCheckIcon, XIcon } from "lucide-react";
import { PierScene, ROD_BOX, RodFigure } from "@/components/art/scenes";
import { Sun, Cloud, Bird } from "@/components/art/primitives";
import { Logo } from "@/components/layout/logo";
import { Eyebrow } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import type { Rules } from "@/lib/screens/types";
import { useRules } from "@/lib/screens/use-query";
import { cn } from "@/lib/utils";

const NAV = [
  { id: "how", label: "How it works" },
  { id: "tiers", label: "Tiers" },
  { id: "fair", label: "Fairness" },
  { id: "faq", label: "FAQ" },
];

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function LandingNav() {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b-2 border-ink bg-sun/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-7 md:flex" aria-label="Sections">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              onClick={(e) => {
                e.preventDefault();
                scrollToId(n.id);
              }}
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              {n.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-4">
          <Link href="/login" className="hidden text-sm font-medium underline-offset-4 hover:underline sm:inline">
            Sign in
          </Link>
          <Link href="/signup" className={buttonVariants({ size: "sm" })}>
            Get your pass
          </Link>
          <button className="grid size-9 place-items-center rounded-full border-2 border-ink md:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Menu">
            {open ? <XIcon /> : <MenuIcon />}
          </button>
        </div>
      </div>
      {open && (
        <nav className="border-t-2 border-ink bg-paper px-4 py-3 md:hidden" aria-label="Sections">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => {
                setOpen(false);
                scrollToId(n.id);
              }}
              className="block w-full py-2.5 text-left font-semibold"
            >
              {n.label}
            </button>
          ))}
          <Link href="/login" className="block py-2.5 font-semibold">
            Sign in
          </Link>
        </nav>
      )}
    </header>
  );
}

/** The rod figure's line follows whichever card is on screen, so cards look lowered on a hook. */
function HookLine({ rodWidth }: { rodWidth: number }) {
  const [geo, setGeo] = useState<{ tx: number; ty: number; hx: number; hy: number } | null>(null);
  useEffect(() => {
    let raf = 0;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const s = rodWidth / ROD_BOX.w;
        const tx = ROD_BOX.tipX * s;
        const ty = 72 + ROD_BOX.tipY * s;
        const vh = window.innerHeight;
        const cards = Array.from(document.querySelectorAll<HTMLElement>("[data-hook]"));
        let hx = tx + 60;
        let hy = ty + (rodWidth < 200 ? 34 : 90);
        for (const c of cards) {
          const r = c.getBoundingClientRect();
          if (r.bottom > 140 && r.top < vh * 0.85) {
            hx = r.left + r.width / 2;
            hy = Math.max(ty + 40, r.top - 6);
            break;
          }
        }
        setGeo({ tx, ty, hx, hy });
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [rodWidth]);
  if (!geo) return null;
  const { tx, ty, hx, hy } = geo;
  const mx = (tx + hx) / 2;
  const my = Math.max(ty, hy) - Math.abs(hx - tx) * 0.05 + 30;
  return (
    <svg className="pointer-events-none fixed inset-0 z-20 h-full w-full" aria-hidden>
      <path d={`M${tx} ${ty} Q${mx} ${Math.min(my, hy - 10)} ${hx} ${hy - 16}`} className="ink-thin" strokeWidth={1.6} />
      <g transform={`translate(${hx} ${hy - 16})`}>
        <circle r={3.5} className="fill-paper ink" strokeWidth={1.6} />
        <path d="M0 3.5 v8 q0 6 5 6 q4 0 4 -5" className="ink" strokeWidth={2} />
      </g>
    </svg>
  );
}

function useRodWidth() {
  const [w, setW] = useState(300);
  useEffect(() => {
    const f = () => setW(window.innerWidth < 640 ? 170 : window.innerWidth < 1024 ? 230 : 300);
    f();
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  return w;
}

function HangingCard({ children, className, id, eyebrow, icon, title }: { children: ReactNode; className?: string; id: string; eyebrow: string; icon: ReactNode; title: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <section id={id} className="relative z-30 flex min-h-[100svh] scroll-mt-16 items-start justify-center px-4 pb-[34vh] pt-[18vh] sm:px-6">
      <div
        ref={ref}
        data-hook
        className={cn(
          "paper relative w-full max-w-4xl p-5 shadow-pop-lg transition-[opacity,transform] duration-700 sm:p-8",
          seen ? "translate-y-0 opacity-100" : "-translate-y-10 opacity-0",
          className,
        )}
      >
        <span className="absolute -top-2 left-1/2 size-3 -translate-x-1/2 rounded-full border-2 border-ink bg-paper" aria-hidden />
        <Eyebrow icon={icon}>{eyebrow}</Eyebrow>
        <h2 className="mt-3 text-[26px] font-extrabold leading-[1.1] sm:text-4xl">{title}</h2>
        <div className="mt-5 sm:mt-6">{children}</div>
      </div>
    </section>
  );
}

const STEPS = [
  { icon: <SearchIcon />, title: "Find it", body: "Browse rooms and equipment from every department. Each listing says if you can book it now or what you need first." },
  { icon: <BadgeCheckIcon />, title: "Earn the badge", body: "Pass a 5-question safety quiz for Tier 1, or upload a certificate for a manager to sign off Tier 2." },
  { icon: <ClipboardCheckIcon />, title: "Request a slot", body: "Pick a time and say why. LabPass runs every check and shows you the result with a reason." },
  { icon: <QrCodeIcon />, title: "Check in, hand back", body: "Scan the QR, tick the checklist, snap a photo. Do the same on return so the condition is on record." },
];

const WHY = [
  { icon: <UserCheckIcon />, title: "Owners stay in control", body: "Every approval, rejection and penalty is made by a named person with a written reason." },
  { icon: <CameraIcon />, title: "Photo-backed handovers", body: "Checklist and photo at both ends of every booking, co-signed by the supervisor when there is one." },
  { icon: <ScaleIcon />, title: "Explainable fairness", body: "Contested slots go by a priority score you can read line by line, not by who messaged first." },
  { icon: <HistoryIcon />, title: "Tamper-proof history", body: "An append-only audit log records who did what, when and why. No role can edit it." },
];

// Rule numbers come from A's labpass_config() via getRules(); the wording falls back to plain
// language when they can't be read (e.g. before sign-in).
const tiersFor = (r: Rules | null) => [
  { n: 0, need: "Any verified student", gets: "Seminar rooms", note: "Book straight away" },
  { n: 1, need: "Short safety quiz", gets: "Oscilloscope, DSLR, robotics lab", note: "Takes about 3 minutes" },
  { n: 2, need: "Certificate + manager sign-off", gets: "3D printer on your own", note: "Or graduate from Tier 3" },
  { n: 3, need: "Supervised use only", gets: "Laser cutter", note: r ? `${r.graduation_sessions} clean sessions → graduate` : "Clean sessions → graduate" },
];

const faqFor = (r: Rules | null) => [
  { q: "Who can use LabPass?", a: "Any verified student, from any department. You sign up with your college email and roll number; your department's resources and every other department's are in one list." },
  {
    q: "What does it cost?",
    a: r
      ? `Nothing in money. The institute gives you ${r.weekly_credit_budget} credits a week. An hour costs ${r.credits_per_hour} credit${r.credits_per_hour === 1 ? "" : "s"} (${r.credits_per_hour_specialised} for specialised machines). Cancel more than ${r.free_cancel_hours} hours ahead and you get them back.`
      : "Nothing in money. The institute gives you sponsored credits every week, an hour costs a credit or two, and cancelling early refunds them.",
  },
  {
    q: "Two people want the same slot. Who gets it?",
    a: r
      ? `The manager sees both requests side by side with a priority score: ${r.priority_base} base, +${r.priority_fresh_bonus} if you haven't used it in ${r.priority_fresh_days} days, +${r.priority_deadline_bonus} for a faculty-verified deadline, −${Math.abs(r.priority_per_week_hour)} per hour you've booked this week, −${Math.abs(r.priority_per_no_show)} per recent no-show. You see the same breakdown.`
      : "The manager sees both requests side by side with a priority score that favours people who haven't used it lately and verified deadlines, and counts against heavy weekly use and recent no-shows. You see the same breakdown.",
  },
  { q: "What if something breaks while I'm using it?", a: "Report it from your booking with a photo. Your check-in photo shows the condition you received it in. The manager decides with a reason, and you can respond or dispute; an admin resolves disputes." },
  { q: "Can I become a peer supervisor?", a: `Yes, once you hold Tier 2 for a machine. Apply, get approved by the lab manager, publish the hours you're free, and earn ${r ? `${r.supervisor_reward_per_hour} credit` : "credits"} per supervised hour.` },
  { q: "What does the AI do?", a: "It suggests: what a certificate says, what changed between check-in and return photos, and usage patterns worth a look. Every suggestion is labelled and a person makes the decision. If the AI is down, everything still works." },
];

function Faq() {
  const FAQ = faqFor(useRules());
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="grid gap-2.5">
      {FAQ.map((f, i) => (
        <div key={f.q} className="paper-inset overflow-hidden">
          <button className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left font-semibold" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
            {f.q}
            <span className={cn("grid size-7 shrink-0 place-items-center rounded-full border-2 border-ink bg-sun transition-transform", open === i && "rotate-180")}>
              <ChevronDownIcon className="size-4" />
            </span>
          </button>
          {open === i && <p className="px-4 pb-4 text-[15px] leading-relaxed text-ink/80">{f.a}</p>}
        </div>
      ))}
    </div>
  );
}

function Stamp() {
  return (
    <svg viewBox="0 0 100 100" className="absolute -right-4 -top-6 size-24 rotate-12 sm:-right-8 sm:size-28" aria-hidden>
      <circle cx={50} cy={50} r={44} className="fill-sun ink" />
      <circle cx={50} cy={50} r={34} className="ink-thin" strokeDasharray="2 3" />
      <defs>
        <path id="stamp-circle" d="M50 50 m-38 0 a38 38 0 1 1 76 0 a38 38 0 1 1 -76 0" />
      </defs>
      <text style={{ font: "700 8.5px var(--font-mono)", letterSpacing: "0.18em" }}>
        <textPath href="#stamp-circle">VERIFIED · NORTHFIELD · FAIR QUEUE ·</textPath>
      </text>
      <text x={50} y={56} textAnchor="middle" style={{ font: "800 17px var(--font-display)" }}>
        PASS
      </text>
    </svg>
  );
}

export function Landing() {
  const TIERS = tiersFor(useRules());
  const rodW = useRodWidth();
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <LandingNav />

      {/* fixed scenery */}
      <div className="pointer-events-none fixed inset-0 z-10" aria-hidden>
        <div className="absolute left-0 top-[72px]" style={{ width: rodW }}>
          <RodFigure className="w-full" />
        </div>
        <svg className="absolute right-3 top-[72px] size-12 sm:right-10 sm:top-24 sm:size-24" viewBox="-40 -40 80 80">
          <Sun x={0} y={0} r={18} />
        </svg>
        <svg className="absolute left-[6%] top-[52%] hidden w-40 lg:block" viewBox="0 0 120 60">
          <Cloud x={10} y={20} s={1.2} />
          <Bird x={80} y={10} />
          <Bird x={96} y={4} />
        </svg>
        <svg className="absolute right-[18%] top-[46%] hidden w-24 lg:block" viewBox="0 0 60 30">
          <Cloud x={5} y={10} />
        </svg>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-10 h-[22vh] min-h-[140px] max-h-[290px] sm:h-[30vh] sm:min-h-[170px]">
        <PierScene />
      </div>
      <HookLine rodWidth={rodW} />

      <main>
        {/* hero */}
        <section className="relative z-30 flex min-h-[100svh] flex-col items-center px-4 pb-[30vh] pt-[19vh] text-center sm:px-6 sm:pt-[20vh]">
          <h1 className="max-w-4xl text-[36px] font-extrabold leading-[1.02] sm:text-6xl lg:text-7xl">
            Idle labs for every student. <span className="scribble">Book a bench.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-[16px] leading-relaxed text-ink/80 sm:text-lg">
            LabPass lets Northfield&apos;s departments share idle labs, rooms and equipment with students from any department, with a skills passport, peer supervisors, a fair queue and photo-backed handovers.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link href="/signup" className={buttonVariants({ size: "lg" })}>
              Get your pass <ArrowRightIcon />
            </Link>
            <button onClick={() => scrollToId("how")} className={buttonVariants({ size: "lg", variant: "outline" })}>
              How it works
            </button>
          </div>
          <p className="mt-4 font-hand text-[15px] text-ink/80">
            ↳ try it now: <Link href="/login" className="underline decoration-2 underline-offset-2">6 demo accounts</Link>, no sign-up
          </p>
        </section>

        <HangingCard id="how" eyebrow="How it works" icon={<KeyRoundIcon />} title="Four steps from browse to bench.">
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <li key={s.title} className="paper-inset p-4">
                <span className="grid size-8 place-items-center rounded-full border-2 border-ink bg-sun font-display font-bold">{i + 1}</span>
                <h3 className="mt-3 flex items-center gap-2 font-display text-[17px] font-bold">{s.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink/75">{s.body}</p>
              </li>
            ))}
          </ol>
        </HangingCard>

        <HangingCard id="why" eyebrow="Why owners say yes" icon={<ShieldCheckIcon />} title="Safer than borrowing a friend's lab key.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {WHY.map((s) => (
              <div key={s.title} className="paper-inset p-4">
                <span className="grid size-9 place-items-center rounded-full border-2 border-ink bg-sun [&_svg]:size-4">{s.icon}</span>
                <h3 className="mt-3 font-display text-[17px] font-bold leading-tight">{s.title}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-ink/75">{s.body}</p>
              </div>
            ))}
          </div>
        </HangingCard>

        <HangingCard id="tiers" eyebrow="Skills passport" icon={<BadgeCheckIcon />} title="Start at Tier 0. Graduate to Tier 2.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TIERS.map((t) => (
              <div key={t.n} className={cn("paper-inset relative p-4", t.n === 3 && "bg-ink text-paper")}>
                <p className={cn("text-[11px] font-bold uppercase tracking-[0.12em]", t.n === 3 ? "text-sun" : "text-mute")}>Tier</p>
                <p className="font-display text-5xl font-extrabold leading-none">{t.n}</p>
                <p className="mt-3 text-[14px] font-semibold">{t.need}</p>
                <p className={cn("mt-1 text-[13px]", t.n === 3 ? "text-paper/75" : "text-ink/70")}>{t.gets}</p>
                <p className="mt-3 font-hand text-[14px]">{t.note}</p>
              </div>
            ))}
          </div>
        </HangingCard>

        <HangingCard id="fair" eyebrow="Fair queue" icon={<ScaleIcon />} title="When two people want the same slot, you see why.">
          <div className="grid items-start gap-5 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="text-[15px] leading-relaxed text-ink/80">Every contested request gets a priority score. The manager still decides, but both of you see the same breakdown. Ties go to whoever asked first.</p>
              <div className="mt-4 flex flex-wrap gap-2 text-[13px] font-semibold">
                {[
                  ["Base", "50"],
                  ["Haven't used it in 14 days", "+20"],
                  ["Faculty-verified deadline", "+15"],
                  ["Per hour booked this week", "−5"],
                  ["Per no-show in 30 days", "−25"],
                ].map(([l, v]) => (
                  <span key={l} className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-paper py-1 pl-3 pr-1">
                    {l}
                    <span className={cn("rounded-full px-2 py-0.5 font-display", v.startsWith("−") ? "bg-coral" : "bg-mint")}>{v}</span>
                  </span>
                ))}
              </div>
            </div>
            <div className="paper-inset p-4">
              <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-mute">Laser cutter · Thu 2–4 pm</p>
              {[
                { who: "Sana", s: 85, parts: "50 + 20 + 15", tag: "approved" },
                { who: "Priya", s: 60, parts: "50 + 20 − 10", tag: "waitlist #1" },
              ].map((r) => (
                <div key={r.who} className="mt-3">
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-semibold">
                      {r.who} <span className="font-normal text-mute">({r.parts})</span>
                    </span>
                    <span className="font-display text-lg font-bold">{r.s}</span>
                  </div>
                  <div className="mt-1 h-3 rounded-full border-[1.5px] border-ink bg-paper">
                    <div className={cn("h-full rounded-full", r.s > 70 ? "bg-ink" : "bg-sun-2")} style={{ width: `${r.s}%` }} />
                  </div>
                  <p className="mt-1 text-[12px] text-mute">{r.tag}</p>
                </div>
              ))}
            </div>
          </div>
        </HangingCard>

        <section id="faq" className="relative z-30 flex min-h-[100svh] scroll-mt-16 items-start justify-center px-4 pb-[34vh] pt-[16vh] sm:px-6">
          <div data-hook className="w-full max-w-3xl">
            <p className="font-hand text-lg">questions from the queue</p>
            <h2 className="text-4xl font-extrabold sm:text-5xl">Before you book</h2>
            <div className="mt-6">
              <Faq />
            </div>
          </div>
        </section>

        <section className="relative z-30 flex min-h-[100svh] items-start justify-center px-4 pb-[34vh] pt-[20vh] sm:px-6">
          <div data-hook className="paper relative w-full max-w-2xl p-7 text-center shadow-pop-lg sm:p-10">
            <Stamp />
            <Eyebrow icon={<SparklesIcon />}>Get started</Eyebrow>
            <h2 className="mt-4 text-4xl font-extrabold sm:text-5xl">Ready to book a bench?</h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] text-ink/75">Sign up with your college email, take a 3-minute safety quiz, and request your first slot today.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link href="/signup" className={buttonVariants({ size: "lg" })}>
                Get your pass
              </Link>
              <Link href="/login" className={buttonVariants({ size: "lg", variant: "outline" })}>
                Sign in
              </Link>
            </div>
            <p className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[13px] text-mute">
              <span>✓ Verified students</span>
              <span>✓ Every action audited</span>
              <span>✓ AI suggests, people decide</span>
            </p>
            <p className="mt-4 text-[11px] text-mute/80">Northfield Institute of Technology is a fictional demo university. All data is made up.</p>
          </div>
        </section>
      </main>

    </div>
  );
}
