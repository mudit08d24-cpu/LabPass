"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "success" | "error" | "info";
interface Toast { id: number; title: string; body?: string; tone: Tone }

const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export function Toaster({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x.slice(-2), { ...t, id }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), t.tone === "error" ? 6000 : 3800);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:left-auto sm:items-end" aria-live="polite">
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex w-full max-w-sm animate-rise items-start gap-3 rounded-2xl border-2 border-ink px-4 py-3 shadow-pop",
              t.tone === "error" ? "bg-coral" : t.tone === "success" ? "bg-mint" : "bg-paper",
            )}
          >
            <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-bold text-sun" aria-hidden>
              {t.tone === "error" ? "!" : t.tone === "success" ? "✓" : "i"}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[13px] text-ink/75">{t.body}</p>}
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const push = useContext(Ctx);
  return {
    success: (title: string, body?: string) => push({ title, body, tone: "success" }),
    error: (title: string, body?: string) => push({ title, body, tone: "error" }),
    info: (title: string, body?: string) => push({ title, body, tone: "info" }),
  };
}
