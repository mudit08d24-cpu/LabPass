"use client";

// Who is signed in (A's profiles row plus derived owner / peer-supervisor status).
// Real mode: Supabase Auth session, read through api.getMe(). Mock mode: the demo account picked on /login.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./index";
import type { Me } from "./types";

export type Hat = "student" | "supervisor" | "manager" | "owner" | "admin";

/** The roles a person acts in. Owners come from departments.owner_id; peer supervisors from supervisor_approvals. */
export function hatsOf(me: Me | null): Hat[] {
  if (!me) return [];
  const h: Hat[] = [];
  if (me.roles.includes("student")) h.push("student");
  if (me.supervises.length) h.push("supervisor");
  if (me.roles.includes("manager")) h.push("manager");
  if (me.ownedDepartmentIds.length) h.push("owner");
  if (me.roles.includes("admin")) h.push("admin");
  return h;
}

export function homeFor(me: Me | null) {
  const h = hatsOf(me);
  if (h.includes("admin")) return "/admin/radar";
  if (h.includes("manager")) return "/manage/requests";
  if (h.includes("owner")) return "/owner/resources";
  return "/browse";
}

interface SessionValue {
  me: Me | null;
  ready: boolean;
  refresh: () => Promise<Me | null>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const m = await api.getMe();
      setMe(m);
      return m;
    } catch {
      setMe(null);
      return null;
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);
  // credits, blocks and supervisor status change with bookings
  useEffect(() => api.onChange(() => void refresh()), [refresh]);

  const value = useMemo<SessionValue>(
    () => ({
      me,
      ready,
      refresh,
      signOut: async () => {
        await api.signOut();
        setMe(null);
      },
    }),
    [me, ready, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession must be used inside SessionProvider");
  return v;
}

/** The signed-in user; only call inside AppShell (it waits for a session before rendering pages). */
export function useMe(): Me {
  const { me } = useSession();
  if (!me) throw new Error("Please sign in again.");
  return me;
}
