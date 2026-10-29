// Shared result type and error wording for every LabPass server action — Member B.
// Plain module (not "use server"), imported by the action files.
//
// Every action returns Result<T>. Screens show `error` to the user as-is.
// When A's database refuses a booking, approval or waitlist offer, `reasons` lists each
// failed check separately, for a bullet list on screen.

export type Failure = { ok: false; error: string; reasons?: string[] };
export type Result<T> = { ok: true; data: T } | Failure;

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function fail(error: string): Failure {
  return { ok: false, error };
}

type DbError = { message?: string; code?: string; details?: string | null };

const GENERIC = "Something went wrong. Please try again.";

// A's functions start these messages with a fixed prefix, then list the failed checks.
const CHECK_FAILURES: { prefix: string; lead: string }[] = [
  { prefix: "Booking blocked: ", lead: "This booking isn't possible yet" },
  { prefix: "Cannot approve: ", lead: "This request can't be approved" },
  { prefix: "Cannot accept: ", lead: "You can't accept this offer" },
];

function checkFailure(message: string) {
  return CHECK_FAILURES.find((c) => message.startsWith(c.prefix));
}

// Turns a Supabase / Postgres error into a sentence a user can read.
// A's functions raise their own plain-language messages (Postgres code P0001); those pass through.
export function friendlyError(error: unknown): string {
  if (!error || typeof error !== "object") return GENERIC;
  const { message = "", code } = error as DbError;

  // Postgres errors that aren't A's own messages
  if (code === "23P01") return "That time was just booked by someone else. Please pick another slot.";
  if (code === "23505") return "This has already been done.";
  if (code === "23514" || code === "23502" || code === "22P02" || code === "22007" || code === "22008") {
    return "Some of the details aren't valid. Please check and try again.";
  }
  if (code === "42501") return "You don't have permission to do this.";
  if (code === "PGRST202") return GENERIC; // function not found: deployment problem, not the user's fault

  if (code === "P0001" || !code) {
    if (message === "Not authorized") return "You don't have permission to do this.";
    if (message === "Authentication required") return "Please log in first.";
    const cf = checkFailure(message);
    if (cf) {
      const reasons = blockedReasons(error);
      return `${cf.lead}: ` + reasons.map((r) => r.replace(/[.\s]+$/, "")).join(". ") + ".";
    }
    if (message.length > 0 && message.length < 300) return message;
  }
  return GENERIC;
}

// The individual failed checks, as a list.
// A attaches the full checks object as the error detail; reasons come from there, because one
// message ("Costs 4 credits; balance 2") itself contains "; ".
export function blockedReasons(error: unknown): string[] {
  const { message = "", details } = (error ?? {}) as DbError;
  const cf = checkFailure(message);
  if (!cf) return [];
  if (details) {
    try {
      const checks = JSON.parse(details) as Record<string, { ok?: boolean; blocking?: boolean; message?: string }>;
      const failed = Object.keys(checks)
        .sort()
        .map((k) => checks[k])
        .filter((c) => c && c.ok === false && c.blocking === true && c.message)
        .map((c) => c.message as string);
      if (failed.length > 0) return failed;
    } catch {
      // fall through to the message text
    }
  }
  return [message.slice(cf.prefix.length)];
}

// A Failure from a database error, with `reasons` when A listed failed checks.
export function failFrom(error: unknown): Failure {
  const reasons = blockedReasons(error);
  return reasons.length > 0 ? { ok: false, error: friendlyError(error), reasons } : fail(friendlyError(error));
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
