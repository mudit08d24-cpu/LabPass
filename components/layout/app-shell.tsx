"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarDaysIcon,
  FileBadgeIcon,
  FlagIcon,
  GaugeIcon,
  GavelIcon,
  HandshakeIcon,
  IdCardIcon,
  InboxIcon,
  LayoutGridIcon,
  ListIcon,
  LogOutIcon,
  MenuIcon,
  RotateCcwIcon,
  ShieldAlertIcon,
  SwordsIcon,
  Undo2Icon,
  UsersIcon,
  WarehouseIcon,
  XIcon,
} from "lucide-react";
import { PierScene } from "@/components/art/scenes";
import { Logo } from "@/components/layout/logo";
import { NotificationBell, useClickAway } from "@/components/layout/notification-bell";
import { Avatar } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { USE_MOCKS } from "@/lib/screens";
import { mockReset } from "@/lib/screens/mock";
import { hatsOf, homeFor, useSession, type Hat } from "@/lib/screens/session";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const NAV: Record<Hat, NavItem[]> = {
  student: [
    { href: "/browse", label: "Browse", icon: <LayoutGridIcon /> },
    { href: "/bookings", label: "My bookings", icon: <CalendarDaysIcon /> },
    { href: "/passport", label: "Passport", icon: <IdCardIcon /> },
  ],
  supervisor: [{ href: "/supervising", label: "Supervising", icon: <HandshakeIcon /> }],
  manager: [
    { href: "/manage/requests", label: "Requests", icon: <InboxIcon /> },
    { href: "/manage/conflicts", label: "Conflicts", icon: <SwordsIcon /> },
    { href: "/manage/returns", label: "Returns", icon: <Undo2Icon /> },
    { href: "/manage/incidents", label: "Incidents", icon: <ShieldAlertIcon /> },
    { href: "/manage/certificates", label: "Certificates", icon: <FileBadgeIcon /> },
    { href: "/manage/supervisors", label: "Supervisors", icon: <UsersIcon /> },
  ],
  owner: [
    { href: "/owner/resources", label: "Our resources", icon: <WarehouseIcon /> },
    { href: "/admin/radar", label: "Idle Radar", icon: <GaugeIcon /> },
  ],
  admin: [
    { href: "/admin/radar", label: "Idle Radar", icon: <GaugeIcon /> },
    { href: "/admin/disputes", label: "Disputes", icon: <GavelIcon /> },
    { href: "/admin/flags", label: "Flags", icon: <FlagIcon /> },
    { href: "/admin/bookings", label: "All bookings", icon: <ListIcon /> },
    { href: "/owner/resources", label: "Resources", icon: <WarehouseIcon /> },
  ],
};

export const HAT_LABEL: Record<Hat, string> = {
  student: "Student",
  supervisor: "Peer supervisor",
  manager: "Manager",
  owner: "Owner",
  admin: "Admin",
};

function navFor(hats: Hat[]) {
  const seen = new Set<string>();
  return hats.flatMap((h) => NAV[h]).filter((n) => (seen.has(n.href) ? false : (seen.add(n.href), true)));
}

function UserMenu() {
  const { me, signOut, refresh } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useClickAway<HTMLDivElement>(open, () => setOpen(false));
  const router = useRouter();
  const toast = useToast();
  if (!me) return null;
  const hats = hatsOf(me);
  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-full border-2 border-ink bg-paper py-0.5 pl-0.5 pr-3 hover:bg-white" aria-expanded={open} aria-label="Account menu">
        <Avatar name={me.name} className="size-8 border-0 bg-sun" />
        <span className="hidden text-left leading-tight lg:block">
          <span className="block max-w-[10rem] truncate text-[13px] font-semibold">{me.name}</span>
          <span className="block text-[11px] text-mute">{hats.map((h) => HAT_LABEL[h]).join(" · ")}</span>
        </span>
      </button>
      {open && (
        <div className="paper absolute right-0 top-12 z-50 w-64 p-2 shadow-pop-lg">
          <div className="px-2 py-2">
            <p className="font-semibold">{me.name}</p>
            <p className="break-all text-[12px] text-mute">{me.email}</p>
            {me.roles.includes("student") && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border-[1.5px] border-ink bg-sun px-2.5 py-0.5 text-[12px] font-bold">{me.credits} credits</p>}
          </div>
          {USE_MOCKS && (
            <button
              onClick={async () => {
                mockReset();
                await refresh();
                toast.success("Demo data reset", "Every booking is back to its starting state.");
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm font-medium hover:bg-paper-2"
            >
              <RotateCcwIcon className="size-4" /> Reset demo data
            </button>
          )}
          <button
            onClick={async () => {
              await signOut();
              router.push("/login");
            }}
            className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-sm font-medium hover:bg-paper-2"
          >
            <LogOutIcon className="size-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { me, ready } = useSession();
  const router = useRouter();
  const path = usePathname();
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    if (ready && !me) router.replace(`/login?next=${encodeURIComponent(path + window.location.search)}`);
  }, [ready, me, router, path]);
  useEffect(() => setMobile(false), [path]);

  if (!ready || !me) {
    return (
      <div className="grid min-h-screen place-items-center">
        <span className="size-8 animate-spin rounded-full border-[3px] border-ink border-r-transparent" aria-label="Loading" />
      </div>
    );
  }
  const items = navFor(hatsOf(me));
  const isActive = (href: string) => path === href || path.startsWith(`${href}/`);
  const blocked = me.blockedUntil && new Date(me.blockedUntil).getTime() > Date.now();

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-sun">
        Skip to content
      </a>
      <header className="no-print sticky top-0 z-40 border-b-2 border-ink bg-sun/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Logo href={homeFor(me)} />
          <nav className="ml-4 hidden flex-1 items-center gap-1 xl:flex" aria-label="Main">
            {items.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href) ? "page" : undefined}
                className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13.5px] font-semibold [&_svg]:size-4", isActive(n.href) ? "bg-ink text-sun" : "hover:bg-ink/8")}
              >
                {n.icon}
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell userId={me.id} />
            <UserMenu />
            <button className="grid size-10 place-items-center rounded-full border-2 border-ink bg-paper xl:hidden" onClick={() => setMobile((m) => !m)} aria-expanded={mobile} aria-label="Menu">
              {mobile ? <XIcon /> : <MenuIcon />}
            </button>
          </div>
        </div>
        {mobile && (
          <nav className="grid gap-1 border-t-2 border-ink bg-paper px-3 py-3 xl:hidden" aria-label="Main">
            {items.map((n) => (
              <Link key={n.href} href={n.href} aria-current={isActive(n.href) ? "page" : undefined} className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2.5 font-semibold [&_svg]:size-4", isActive(n.href) ? "bg-ink text-sun" : "hover:bg-sun/40")}>
                {n.icon}
                {n.label}
              </Link>
            ))}
          </nav>
        )}
        {blocked && (
          <div className="border-t-2 border-ink bg-coral px-4 py-2 text-center text-[13px] font-semibold">
            Booking is paused until {new Date(me.blockedUntil!).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
            {me.blockReason ? `: ${me.blockReason}` : ""}
          </div>
        )}
      </header>
      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pb-10 pt-6 sm:px-6 sm:pt-10">
        {children}
      </main>
      <footer className="no-print h-[150px] overflow-hidden sm:h-[190px]" aria-hidden>
        <PierScene variant="story" />
      </footer>
    </div>
  );
}

/** Shows children only to people acting in one of `hats`. */
export function RequireHat({ hats, children }: { hats: Hat[]; children: ReactNode }) {
  const { me } = useSession();
  if (!me) return null;
  const mine = hatsOf(me);
  if (!hats.some((h) => mine.includes(h))) {
    return (
      <div className="paper mx-auto max-w-lg p-8 text-center">
        <p className="font-hand text-lg">wrong door</p>
        <h1 className="mt-1 text-2xl font-extrabold">This page is for {hats.map((h) => HAT_LABEL[h].toLowerCase()).join(" or ")}s</h1>
        <p className="mt-2 text-sm text-mute">
          You&apos;re signed in as {me.name} ({mine.map((h) => HAT_LABEL[h]).join(", ") || "no role yet"}).
        </p>
        <Link href={homeFor(me)} className="mt-5 inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-semibold text-paper">
          Go to my home
        </Link>
      </div>
    );
  }
  return <>{children}</>;
}
