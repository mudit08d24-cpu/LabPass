"use client";

// The bell. Real mode follows API.md: getNotifications() for the first load, then B's
// useNotifications(userId, initial) hook keeps it live over Supabase Realtime.
// Mock mode reads the demo store instead.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BellIcon } from "lucide-react";
import { getNotifications } from "@/lib/actions/notifications";
import { useNotifications } from "@/lib/notifications/use-notifications";
import { api, USE_MOCKS } from "@/lib/screens";
import type { AppNotification } from "@/lib/screens/types";
import { useQuery } from "@/lib/screens/use-query";
import { cn, timeAgo } from "@/lib/utils";

export function useClickAway<T extends HTMLElement>(open: boolean, close: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (!open) return;
    const f = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && close();
    const k = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", f);
    document.addEventListener("keydown", k);
    return () => {
      document.removeEventListener("mousedown", f);
      document.removeEventListener("keydown", k);
    };
  }, [open, close]);
  return ref;
}

interface BellModel {
  items: AppNotification[];
  unread: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

export function NotificationRow({ n, onOpen }: { n: AppNotification; onOpen: (n: AppNotification) => void }) {
  const body = (
    <div className={cn("flex gap-3 rounded-xl px-2 py-2.5", !n.readAt && "bg-sun-soft/70")}>
      <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-ink")} aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{n.title}</p>
        {n.body && <p className="text-[13px] text-ink/75">{n.body}</p>}
        <p className="mt-0.5 text-[11px] text-mute">{timeAgo(n.createdAt)}</p>
      </div>
    </div>
  );
  return (
    <li>
      {n.href ? (
        <Link href={n.href} onClick={() => onOpen(n)} className="block rounded-xl hover:bg-paper-2/70">
          {body}
        </Link>
      ) : (
        <button type="button" className="block w-full text-left" onClick={() => onOpen(n)}>
          {body}
        </button>
      )}
    </li>
  );
}

function BellView({ model }: { model: BellModel }) {
  const [open, setOpen] = useState(false);
  const ref = useClickAway<HTMLDivElement>(open, () => setOpen(false));
  const { items, unread } = model;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid size-10 place-items-center rounded-full border-2 border-ink bg-paper hover:bg-white"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
      >
        <BellIcon className={cn("size-[18px]", unread > 0 && "animate-sway")} />
        {unread > 0 && <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full border-2 border-ink bg-coral px-1 text-[11px] font-bold">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="paper absolute right-0 top-12 z-50 w-[min(88vw,22rem)] p-2 shadow-pop-lg">
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="font-display font-bold">Notifications</p>
            {unread > 0 && (
              <button onClick={model.markAllRead} className="text-[12px] font-semibold underline underline-offset-2">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-80 overflow-y-auto">
            {items.slice(0, 6).map((n) => (
              <NotificationRow
                key={n.id}
                n={n}
                onOpen={(x) => {
                  if (!x.readAt) model.markRead(x.id);
                  setOpen(false);
                }}
              />
            ))}
            {!items.length && <li className="px-2 py-6 text-center text-sm text-mute">Nothing yet.</li>}
          </ul>
          <Link href="/notifications" onClick={() => setOpen(false)} className="mt-1 block rounded-xl border-t-2 border-dashed border-ink/30 px-2 py-2 text-center text-[13px] font-semibold hover:bg-sun/40">
            See all
          </Link>
        </div>
      )}
    </div>
  );
}

function toView(n: { id: string; type: string; title: string; body: string; href?: string | null; readAt?: string | null; createdAt: string }): AppNotification {
  return { id: n.id, type: n.type, title: n.title, body: n.body, href: n.href ?? null, readAt: n.readAt ?? null, createdAt: n.createdAt };
}

function LiveBell({ userId, initial }: { userId: string; initial: Parameters<typeof useNotifications>[1] }) {
  const live = useNotifications(userId, initial);
  return <BellView model={{ items: live.items.map(toView), unread: live.unread, markRead: (id) => void live.markRead(id), markAllRead: () => void live.markAllRead() }} />;
}

function RealBell({ userId }: { userId: string }) {
  const [initial, setInitial] = useState<Parameters<typeof useNotifications>[1] | null>(null);
  useEffect(() => {
    let live = true;
    // B's getNotifications() (a server action) for the first load; the hook keeps it live after that.
    getNotifications()
      .then((r) => {
        const d = (r as { ok?: boolean; data?: unknown })?.ok ? (r as { data: unknown }).data : r;
        if (live) setInitial((d ?? { items: [], unread: 0 }) as Parameters<typeof useNotifications>[1]);
      })
      .catch(() => live && setInitial({ items: [], unread: 0 } as unknown as Parameters<typeof useNotifications>[1]));
    return () => {
      live = false;
    };
  }, [userId]);
  if (!initial) return <BellView model={{ items: [], unread: 0, markRead: () => {}, markAllRead: () => {} }} />;
  return <LiveBell userId={userId} initial={initial} />;
}

function MockBell() {
  const { data } = useQuery(() => api.getNotifications(), []);
  return (
    <BellView
      model={{
        items: data?.items ?? [],
        unread: data?.unread ?? 0,
        markRead: (id) => void api.markNotificationRead(id),
        markAllRead: () => void api.markAllNotificationsRead(),
      }}
    />
  );
}

export function NotificationBell({ userId }: { userId: string }) {
  return USE_MOCKS ? <MockBell /> : <RealBell userId={userId} />;
}
