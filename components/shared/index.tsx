"use client";

// Shared building blocks reused across every role's screens
// (roadmap: StatusBadge, Checklist, PhotoUpload, Timeline, EmptyState,
// EligibilityBadge, ScoreBreakdown, AiSuggestion, Countdown, QrScanner).

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CameraIcon, CheckIcon, CircleAlertIcon, ImagePlusIcon, LockIcon, SparklesIcon, XIcon, TriangleAlertIcon, UsersIcon, BookOpenCheckIcon, BadgeCheckIcon } from "lucide-react";
import { ResourceArt, PhotoView } from "@/components/art/resource-art";
import { Person, Plant, Cat } from "@/components/art/primitives";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/input";
import { Dialog, Skeleton } from "@/components/ui/misc";
import { breakdownRows, CHECK_LABEL } from "@/lib/screens/format";
import type { BookingStatus, Breakdown, CheckItem, EligibilityStatus, IncidentStatus, Resource, Rules, TimelineEntry } from "@/lib/screens/types";
import { cn, fmtDateTime, fmtTime, timeAgo } from "@/lib/utils";

/* ---------- page chrome ---------- */

export function PageHeader({ eyebrow, title, description, actions, back }: { eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-3 inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-paper px-3 py-1 text-[13px] font-semibold hover:bg-white">
            ← {back.label}
          </Link>
        )}
        {eyebrow && <p className="font-hand text-[17px] leading-none text-ink/80">{eyebrow}</p>}
        <h1 className="mt-1 text-[30px] font-extrabold leading-[1.05] sm:text-[40px]">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-[15px] text-ink/75">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- status ---------- */

const BOOKING_STATUS: Record<BookingStatus, { label: string; tone: "paper" | "mint" | "coral" | "lilac" | "sky" | "peach" | "ink" | "muted" | "sun" }> = {
  requested: { label: "Requested", tone: "sun" },
  approved: { label: "Approved", tone: "mint" },
  rejected: { label: "Rejected", tone: "coral" },
  waitlisted: { label: "Waitlisted", tone: "lilac" },
  checked_in: { label: "Checked in", tone: "sky" },
  returned: { label: "Returned", tone: "peach" },
  completed: { label: "Completed", tone: "ink" },
  cancelled: { label: "Cancelled", tone: "muted" },
  no_show: { label: "No-show", tone: "coral" },
  overdue: { label: "Overdue", tone: "coral" },
};

export function StatusBadge({ status, className }: { status: BookingStatus; className?: string }) {
  const s = BOOKING_STATUS[status];
  return (
    <Badge tone={s.tone} className={className}>
      <span className={cn("size-1.5 rounded-full", s.tone === "ink" ? "bg-sun" : "bg-ink")} aria-hidden />
      {s.label}
    </Badge>
  );
}

const INCIDENT_STATUS: Record<IncidentStatus, { label: string; tone: "sun" | "sky" | "mint" | "coral" | "muted" }> = {
  open: { label: "Open", tone: "sun" },
  under_review: { label: "Under review", tone: "sky" },
  decided: { label: "Decided", tone: "mint" },
  disputed: { label: "Disputed", tone: "coral" },
  closed: { label: "Closed", tone: "muted" },
};

export function IncidentBadge({ status }: { status: IncidentStatus }) {
  const s = INCIDENT_STATUS[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

const ELIG: Record<EligibilityStatus, { label: string; tone: "mint" | "sun" | "peach" | "lilac" | "coral"; icon: ReactNode }> = {
  eligible: { label: "You can book", tone: "mint", icon: <CheckIcon /> },
  needs_quiz: { label: "Needs quiz", tone: "sun", icon: <BookOpenCheckIcon /> },
  needs_certificate: { label: "Needs certificate", tone: "peach", icon: <BadgeCheckIcon /> },
  needs_supervisor: { label: "Needs supervisor", tone: "lilac", icon: <UsersIcon /> },
  blocked: { label: "Booking paused", tone: "coral", icon: <LockIcon /> },
};

export function EligibilityBadge({ value, className }: { value: EligibilityStatus; className?: string }) {
  const e = ELIG[value];
  return (
    <Badge tone={e.tone} className={className}>
      {e.icon}
      {e.label}
    </Badge>
  );
}

export function TierBadge({ tier }: { tier: number }) {
  return (
    <Badge tone={tier === 3 ? "ink" : "paper"} className="font-mono text-[11px]">
      T{tier}
    </Badge>
  );
}

/* ---------- states ---------- */

export function EmptyState({ title, body, action, art = "cat" }: { title: string; body?: ReactNode; action?: ReactNode; art?: "cat" | "person" | "plant" }) {
  return (
    <div className="paper-inset flex flex-col items-center px-6 py-10 text-center">
      <svg viewBox="0 0 120 70" className="h-20 w-auto" aria-hidden>
        <path d="M4 66 h112" className="ink" />
        {art === "cat" && <Cat x={60} y={66} />}
        {art === "person" && <Person x={60} y={66} pose="wave" shirt="stripe" hat="bucket" />}
        {art === "plant" && <Plant x={60} y={66} />}
        <path d="M84 20 q4 -4 7 0 q3 -4 7 0" className="ink-thin" />
      </svg>
      <p className="mt-3 font-display text-lg font-bold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-mute">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ rows = 3 }: { rows?: number }) {
  return (
    <div className="grid gap-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-24 border-2 border-ink/10" />
      ))}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl border-2 border-ink bg-coral px-4 py-3">
      <CircleAlertIcon className="size-5 shrink-0" />
      <p className="flex-1 text-sm font-medium">{message}</p>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/* ---------- checks + checklist ---------- */

/** A's booking checklist (evaluate_booking / bookings.checks), one row per check with its message.
 *  A failed non-blocking check is a warning: the student can still request and be waitlisted. */
export function ChecksList({ checks, compact }: { checks: CheckItem[]; compact?: boolean }) {
  return (
    <ul className="grid gap-2">
      {checks.map((c) => {
        const warn = !c.ok && !c.blocking;
        return (
          <li key={c.key} className={cn("flex items-start gap-3 rounded-xl border-[1.5px] border-ink px-3 py-2.5", c.ok ? "bg-paper" : warn ? "bg-peach" : "bg-coral/70")}>
            <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border-[1.5px] border-ink", c.ok ? "bg-mint" : "bg-paper")} aria-hidden>
              {c.ok ? <CheckIcon className="size-3" /> : warn ? <TriangleAlertIcon className="size-3" /> : <XIcon className="size-3" />}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {CHECK_LABEL[c.key] ?? c.key} <span className="sr-only">{c.ok ? "passed" : warn ? "warning" : "failed"}</span>
              </p>
              {!compact && <p className="text-[13px] text-ink/75">{c.message}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Interactive condition checklist for check-in / return. */
export function Checklist({ items, value, onChange }: { items: string[]; value: Record<string, boolean>; onChange: (v: Record<string, boolean>) => void }) {
  const id = useId();
  return (
    <fieldset className="grid gap-2">
      <legend className="sr-only">Condition checklist</legend>
      {items.map((item, i) => {
        const v = value[item];
        return (
          <div key={item} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-[1.5px] border-ink bg-paper px-3 py-2">
            <span className="text-sm font-medium" id={`${id}-${i}`}>
              {item}
            </span>
            <div className="flex gap-1.5" role="radiogroup" aria-labelledby={`${id}-${i}`}>
              <button type="button" role="radio" aria-checked={v === true} onClick={() => onChange({ ...value, [item]: true })} className={cn("h-8 rounded-full border-[1.5px] border-ink px-3 text-[13px] font-semibold", v === true ? "bg-mint" : "bg-white hover:bg-mint/40")}>
                ✓ OK
              </button>
              <button type="button" role="radio" aria-checked={v === false} onClick={() => onChange({ ...value, [item]: false })} className={cn("h-8 rounded-full border-[1.5px] border-ink px-3 text-[13px] font-semibold", v === false ? "bg-coral" : "bg-white hover:bg-coral/40")}>
                ✕ Issue
              </button>
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}

export function ChecklistResult({ items }: { items: { item: string; ok: boolean; note?: string }[] }) {
  return (
    <ul className="grid gap-1">
      {items.map((c) => (
        <li key={c.item} className="flex items-start gap-2 text-[13px]">
          <span className={cn("mt-0.5 grid size-4 shrink-0 place-items-center rounded-full border border-ink", c.ok ? "bg-mint" : "bg-coral")} aria-hidden>
            {c.ok ? <CheckIcon className="size-2.5" /> : <XIcon className="size-2.5" />}
          </span>
          <span>
            <span className={cn(!c.ok && "font-semibold")}>{c.item}</span>
            {c.note && <span className="text-ink/70"> — {c.note}</span>}
            <span className="sr-only">{c.ok ? "OK" : "Issue"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ---------- photo upload ---------- */

export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp";
const PHOTO_MAX = 10 * 1024 * 1024;

export interface PickedPhoto {
  file: File;
  preview: string;
}

/** A plain demo photo (PNG drawn on a canvas) for judges testing without a camera. */
export async function makeDemoPhoto(label: string): Promise<File | null> {
  try {
    const c = document.createElement("canvas");
    c.width = 960;
    c.height = 640;
    const g = c.getContext("2d");
    if (!g) return null;
    g.fillStyle = "#f1e43c";
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = "#151515";
    g.lineWidth = 8;
    g.strokeRect(40, 40, c.width - 80, c.height - 80);
    g.fillStyle = "#151515";
    g.font = "bold 48px sans-serif";
    g.fillText("LabPass demo photo", 80, 140);
    g.font = "36px sans-serif";
    g.fillText(label, 80, 220);
    g.fillText(new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }), 80, 280);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
    return blob ? new File([blob], `demo-${Date.now()}.png`, { type: "image/png" }) : null;
  } catch {
    return null;
  }
}

/** Picks photos (camera on phones). Files are uploaded by the form that owns them. */
export function PhotoUpload({ value, onChange, demoLabel, label = "Photo of the resource", max = 3 }: { value: PickedPhoto[]; onChange: (v: PickedPhoto[]) => void; demoLabel?: string; label?: string; max?: number }) {
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  const add = (files: File[]) => {
    const next = [...value];
    setErr(null);
    for (const f of files) {
      if (!PHOTO_ACCEPT.split(",").includes(f.type)) {
        setErr("Photos must be JPG, PNG or WebP.");
        continue;
      }
      if (f.size > PHOTO_MAX) {
        setErr("That photo is over 10 MB. Try a smaller one.");
        continue;
      }
      if (next.length < max) next.push({ file: f, preview: URL.createObjectURL(f) });
    }
    onChange(next);
  };
  return (
    <div>
      <p className="text-sm font-semibold">{label}</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {value.map((p, i) => (
          <div key={p.preview} className="relative overflow-hidden rounded-xl border-2 border-ink">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt={`Photo ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
            <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="absolute right-1 top-1 grid size-6 place-items-center rounded-full border-[1.5px] border-ink bg-paper" aria-label={`Remove photo ${i + 1}`}>
              <XIcon className="size-3" />
            </button>
          </div>
        ))}
        {value.length < max && (
          <button type="button" onClick={() => ref.current?.click()} className="grid aspect-[4/3] place-items-center rounded-xl border-2 border-dashed border-ink bg-paper/70 text-center text-[12px] font-semibold hover:bg-white">
            <span className="grid justify-items-center gap-1">
              <CameraIcon className="size-5" />
              Take or add photo
            </span>
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept={PHOTO_ACCEPT} capture="environment" multiple className="sr-only" onChange={(e) => add(Array.from(e.target.files ?? []))} aria-label={label} />
      {demoLabel && value.length === 0 && (
        <button
          type="button"
          onClick={async () => {
            const f = await makeDemoPhoto(demoLabel);
            if (f) add([f]);
          }}
          className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold underline decoration-dashed underline-offset-4"
        >
          <ImagePlusIcon className="size-4" /> No camera? Use a demo photo
        </button>
      )}
      {err && <p className="mt-1 text-[13px] text-red-ink" role="alert">{err}</p>}
    </div>
  );
}

/** Shows stored condition/incident photos. URLs come from getConditionPhotoUrls (signed, 1 hour). */
export function StoredPhoto({ url, alt, className }: { url: string | undefined; alt: string; className?: string }) {
  if (!url) return <div className={cn("grid place-items-center bg-paper-2 text-[12px] text-mute", className)}>Photo unavailable</div>;
  return <PhotoView src={url} alt={alt} className={className} />;
}

/* ---------- timeline ---------- */

export function Timeline({ items }: { items: TimelineEntry[] }) {
  if (!items.length) return <p className="text-sm text-mute">No activity yet.</p>;
  return (
    <ol className="relative grid gap-4 pl-6">
      <span className="absolute bottom-2 left-[9px] top-2 w-0.5 bg-ink" aria-hidden />
      {items.map((a, i) => (
        <li key={a.id} className="relative">
          <span className={cn("absolute -left-6 top-0.5 size-[20px] rounded-full border-2 border-ink", i === items.length - 1 ? "bg-sun" : "bg-paper")} aria-hidden />
          <p className="text-sm">
            <span className="font-semibold">{a.actor}</span> · {a.text}
          </p>
          {a.reason && <p className="mt-0.5 rounded-lg bg-paper-2 px-2 py-1 text-[13px] text-ink/80">“{a.reason}”</p>}
          <p className="mt-0.5 text-[12px] text-mute">
            <time dateTime={a.at}>{fmtDateTime(a.at)}</time>
          </p>
        </li>
      ))}
    </ol>
  );
}

/* ---------- fairness ---------- */

/** A's priority breakdown object, worded with the rule values. */
export function ScoreBreakdown({ breakdown, rules, total }: { breakdown: Breakdown; rules?: Rules | null; total?: number }) {
  const rows = breakdownRows(breakdown, rules);
  const sum = total ?? breakdown.total;
  return (
    <div>
      <ul className="grid gap-1.5">
        {rows.map((it) => (
          <li key={it.label} className="flex items-center justify-between gap-3 text-sm">
            <span>{it.label}</span>
            <span className={cn("rounded-full border-[1.5px] border-ink px-2 font-display text-[13px] font-bold tabular-nums", it.points < 0 ? "bg-coral" : it.label === "Base" ? "bg-paper" : "bg-mint")}>
              {it.points > 0 && it.label !== "Base" ? "+" : it.points < 0 ? "−" : ""}
              {Math.abs(it.points)}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-center justify-between border-t-2 border-dashed border-ink pt-2">
        <span className="text-sm font-semibold">Priority score</span>
        <span className="font-display text-2xl font-extrabold tabular-nums">{Math.round(sum * 10) / 10}</span>
      </div>
    </div>
  );
}

/* ---------- AI ---------- */

/** Wraps any AI output: labelled, loading skeleton, hidden on failure or after 10 s. */
export function AiSuggestion({ loading, failed, children, title = "AI suggestion" }: { loading: boolean; failed?: boolean; children: ReactNode; title?: string }) {
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    if (!loading) return;
    setTimedOut(false);
    const t = setTimeout(() => setTimedOut(true), 10_000);
    return () => clearTimeout(t);
  }, [loading]);
  if (failed || (loading && timedOut)) return null;
  return (
    <div className="rounded-2xl border-2 border-dashed border-ink bg-lilac p-4">
      <p className="flex flex-wrap items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em]">
        <SparklesIcon className="size-4" /> {title}
        <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] tracking-normal text-sun normal-case">AI suggestion — needs review</span>
      </p>
      <div className="mt-2">
        {loading ? (
          <div className="grid gap-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/* ---------- countdown ---------- */

export function Countdown({ to, onExpire, className }: { to: string; onExpire?: () => void; className?: string }) {
  const [left, setLeft] = useState(() => new Date(to).getTime() - Date.now());
  useEffect(() => {
    const t = setInterval(() => {
      const l = new Date(to).getTime() - Date.now();
      setLeft(l);
      if (l <= 0) {
        clearInterval(t);
        onExpire?.();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [to, onExpire]);
  const s = Math.max(0, Math.floor(left / 1000));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return (
    <span className={cn("font-mono font-bold tabular-nums", className)} role="timer" aria-label={`${mm} minutes ${ss} seconds left`}>
      {mm}:{ss}
    </span>
  );
}

/* ---------- QR ---------- */

/** Deterministic QR-style pattern for mock mode. In production B's function returns a real QR image URL. */
export function MockQr({ value, className }: { value: string; className?: string }) {
  const n = 25;
  let h = 2166136261;
  for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const cells: [number, number][] = [];
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const inFinder = (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);
      if (inFinder) continue;
      h = Math.imul(h ^ (x * 31 + y), 16777619);
      if ((h >>> 0) % 100 < 46) cells.push([x, y]);
    }
  const finder = (x: number, y: number) => (
    <g key={`${x}${y}`}>
      <rect x={x} y={y} width={7} height={7} className="fill-ink" />
      <rect x={x + 1} y={y + 1} width={5} height={5} fill="#fff" />
      <rect x={x + 2} y={y + 2} width={3} height={3} className="fill-ink" />
    </g>
  );
  return (
    <svg viewBox={`-2 -2 ${n + 4} ${n + 4}`} className={cn("bg-white", className)} role="img" aria-label="QR code">
      {cells.map(([x, y]) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} className="fill-ink" />
      ))}
      {finder(0, 0)}
      {finder(n - 7, 0)}
      {finder(0, n - 7)}
    </svg>
  );
}

export { QrScanner } from "./qr-scanner";

/* ---------- resource bits ---------- */

export function ResourceThumb({ resource, className }: { resource: Pick<Resource, "art" | "name" | "photoUrl">; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-xl border-2 border-ink", className)}>
      {resource.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={resource.photoUrl} alt={resource.name} className="aspect-[16/10] w-full object-cover" />
      ) : (
        <ResourceArt kind={resource.art} label={resource.name} />
      )}
    </div>
  );
}

export function SlotText({ start, end }: { start: string; end: string }) {
  return (
    <span>
      {fmtDateTime(start)}–{fmtTime(end)}
    </span>
  );
}

export function Ago({ iso }: { iso: string }) {
  return (
    <time dateTime={iso} title={new Date(iso).toLocaleString()}>
      {timeAgo(iso)}
    </time>
  );
}

/* ---------- reason dialog ---------- */

export function ReasonDialog({ open, onClose, title, description, confirmLabel, onConfirm, tone = "default", placeholder, extra }: { open: boolean; onClose: () => void; title: string; description?: string; confirmLabel: string; onConfirm: (reason: string) => Promise<boolean | void>; tone?: "default" | "danger"; placeholder?: string; extra?: ReactNode }) {
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();
  useEffect(() => {
    if (open) {
      setReason("");
      setErr(null);
    }
  }, [open]);
  return (
    <Dialog open={open} onClose={onClose} title={title} description={description}>
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          if (reason.trim().length < 5) {
            setErr("Write a short reason the student will see (at least 5 characters).");
            return;
          }
          setBusy(true);
          const ok = await onConfirm(reason.trim());
          setBusy(false);
          if (ok !== false) onClose();
        }}
      >
        <Field id={id} label="Reason (shown to the student and saved in the audit log)" error={err}>
          <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} aria-invalid={!!err} autoFocus />
        </Field>
        {extra}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant={tone === "danger" ? "danger" : "default"} loading={busy}>
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/* ---------- misc ---------- */

export function StatTile({ label, value, hint, tone = "paper" }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "paper" | "ink" | "sun" }) {
  return (
    <div className={cn("rounded-2xl border-2 border-ink p-4", tone === "ink" ? "bg-ink text-paper" : tone === "sun" ? "bg-sun-soft" : "bg-paper")}>
      <p className={cn("text-[12px] font-bold uppercase tracking-[0.08em]", tone === "ink" ? "text-sun" : "text-mute")}>{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold leading-none">{value}</p>
      {hint && <p className={cn("mt-1.5 text-[13px]", tone === "ink" ? "text-paper/75" : "text-mute")}>{hint}</p>}
    </div>
  );
}

export function Section({ title, children, aside, className }: { title: ReactNode; children: ReactNode; aside?: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-bold">{title}</h2>
        {aside}
      </div>
      {children}
    </Card>
  );
}

export function Notice({ tone = "info", children, icon }: { tone?: "info" | "warn" | "ok"; children: ReactNode; icon?: ReactNode }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border-2 border-ink px-4 py-3 text-sm", tone === "warn" ? "bg-peach" : tone === "ok" ? "bg-mint" : "bg-sky")}>
      <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon ?? (tone === "warn" ? <TriangleAlertIcon /> : tone === "ok" ? <CheckIcon /> : <LockIcon />)}</span>
      <div>{children}</div>
    </div>
  );
}

export { buttonVariants };
