// Entry point for every screen: `import { api } from "@/lib/screens"`.
// NEXT_PUBLIC_USE_MOCKS=true serves the in-browser demo data (no backend needed);
// otherwise everything runs on B's actions and A's database.

import { mockApi } from "./mock";
import { realApi } from "./real";
import type { ScreensApi } from "./types";

export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

const base: ScreensApi = USE_MOCKS ? mockApi : realApi;

// Writes notify open screens so lists refresh right away (Realtime covers other people's changes).
const WRITES = new Set<keyof ScreensApi>([
  "signIn", "signOut", "requestBooking", "cancelBooking", "decideBooking", "setDeadlineVerified", "acceptWaitlistOffer",
  "declineWaitlistOffer", "saveConditionReport", "signConditionReport", "checkIn", "returnBooking", "confirmReturn",
  "rotateCheckinCode", "submitQuiz", "submitCertificate", "decideCertificate", "graduateStudent", "applyAsSupervisor",
  "publishSupervisorHours", "removeSupervisorHours", "decideSupervisor", "openIncident", "startIncidentReview",
  "decideIncident", "respondToIncident", "closeIncident", "resolveIncidentDispute", "setResourceStatus",
  "markNotificationRead", "markAllNotificationsRead", "decideUserFlag", "liftUserBlock", "saveResource", "uploadResourcePhoto",
]);

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const api: ScreensApi = new Proxy(base, {
  get(target, prop: keyof ScreensApi) {
    const v = target[prop];
    if (prop === "onChange") {
      return (fn: () => void) => {
        listeners.add(fn);
        const off = target.onChange(fn);
        return () => {
          listeners.delete(fn);
          off();
        };
      };
    }
    if (typeof v === "function" && WRITES.has(prop)) {
      return async (...args: unknown[]) => {
        const out = await (v as (...a: unknown[]) => Promise<unknown>).apply(target, args);
        setTimeout(emit, 0);
        return out;
      };
    }
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(target) : v;
  },
});

export * from "./types";
