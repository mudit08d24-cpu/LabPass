"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn, initials } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-ink/10", className)} aria-hidden />;
}

export function Progress({ value, className, label }: { value: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("h-3 overflow-hidden rounded-full border-[1.5px] border-ink bg-paper", className)} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} aria-label={label}>
      <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn("grid size-9 shrink-0 place-items-center rounded-full border-2 border-ink bg-paper font-display text-[13px] font-bold", className)} aria-hidden>
      {initials(name)}
    </span>
  );
}

export function Tabs<T extends string>({ value, onChange, items, className }: { value: T; onChange: (v: T) => void; items: { value: T; label: ReactNode; count?: number }[]; className?: string }) {
  return (
    <div role="tablist" className={cn("inline-flex flex-wrap gap-1 rounded-full border-2 border-ink bg-paper p-1", className)}>
      {items.map((it) => (
        <button
          key={it.value}
          role="tab"
          aria-selected={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors", value === it.value ? "bg-ink text-sun" : "hover:bg-ink/8")}
        >
          {it.label}
          {it.count !== undefined && <span className={cn("rounded-full px-1.5 text-[11px]", value === it.value ? "bg-sun text-ink" : "bg-ink/10")}>{it.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Accessible modal built on <dialog>. */
export function Dialog({ open, onClose, title, description, children, className }: { open: boolean; onClose: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn("paper m-auto w-[min(92vw,30rem)] p-0 text-ink backdrop:bg-ink/45 backdrop:backdrop-blur-[2px]", className)}
    >
      <div className="p-5 sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold">{title}</h2>
            {description && <p className="mt-1 text-sm text-mute">{description}</p>}
          </div>
          <button onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink hover:bg-sun" aria-label="Close">
            <svg viewBox="0 0 20 20" className="size-3.5" aria-hidden>
              <path d="M5 5l10 10M15 5L5 15" className="ink" />
            </svg>
          </button>
        </div>
        {open && children}
      </div>
    </dialog>
  );
}
