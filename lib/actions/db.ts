import "server-only";

// Helpers shared by B's server actions — Member B. Repo path: lib/actions/db.ts
// Plain server module (not "use server"): imported by B's action files, never by screens.

import { createClient } from "@/lib/supabase/server";
import { type Result, ok, fail, failFrom, UUID } from "@/lib/actions/errors";

// The parts of the Supabase client B's code uses, with loose types.
// A's README suggests creating clients with createClient<Database>(...). If the repo's
// lib/supabase/server.ts does that, typed calls by a variable function name wouldn't compile,
// so every B file gets its client through getDb(), which works with typed or untyped clients.
// Safety doesn't depend on these types: A's database functions and row-level security decide.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;
export type Db = {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: Loose; error: Loose }>;
  from(table: string): Loose;
  storage: { from(bucket: string): Loose };
  auth: { getUser(): Promise<{ data: { user: { id: string } | null } }> };
};

// The logged-in user's Supabase client (row-level security applies).
export async function getDb(): Promise<Db> {
  return (await createClient()) as unknown as Db;
}

// Calls one of A's database functions as the logged-in user.
// The function's own checks and plain-language errors decide what's allowed.
export async function rpc<T = null>(fn: string, args?: Record<string, unknown>): Promise<Result<T>> {
  const db = await getDb();
  const { data, error } = await db.rpc(fn, args);
  if (error) return failFrom(error);
  return ok((data ?? null) as T);
}

// The logged-in user's id, or null.
export async function currentUserId(db?: Db): Promise<string | null> {
  const client = db ?? (await getDb());
  const { data } = await client.auth.getUser();
  return data.user?.id ?? null;
}

// ---- Input checks (catch obvious mistakes before calling the database) ----

export function badId(value: unknown): boolean {
  return typeof value !== "string" || !UUID.test(value);
}

// Accepts an ISO string or Date; returns an ISO string, or null if it isn't a real time.
export function isoTime(value: unknown): string | null {
  if (!(typeof value === "string" || value instanceof Date)) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// Accepts "2026-10-29" (or a Date / ISO string); returns "YYYY-MM-DD", or null.
export function isoDate(value: unknown): string | null {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const iso = isoTime(value);
  return iso ? iso.slice(0, 10) : null;
}

export function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function needsReason(reason: unknown, what: string) {
  return text(reason).length === 0 ? fail(`Please give a reason to ${what}.`) : null;
}

export { fail, ok };
