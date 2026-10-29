// Time-range helpers — Member B. Repo path: lib/ranges.ts
// Plain functions, safe in server and client code.
//
// A's bookings.time_range and supervisor_slots.time_range are Postgres tstzrange values.
// Supabase returns them as text like: ["2026-10-29 10:00:00+00","2026-10-29 12:00:00+00")

export type TimeRange = { start: Date; end: Date };

function toDate(s: string): Date {
  // "2026-10-29 10:00:00+00" -> "2026-10-29T10:00:00+00:00" so every browser parses it
  const iso = s.trim().replace(" ", "T").replace(/([+-]\d{2})$/, "$1:00");
  return new Date(iso);
}

export function parseRange(value: string | null | undefined): TimeRange | null {
  if (!value) return null;
  const m = /^[[(]"?([^",]+)"?,\s*"?([^",)\]]+)"?[)\]]$/.exec(value.trim());
  if (!m) return null;
  const start = toDate(m[1]);
  const end = toDate(m[2]);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { start, end };
}

// Range text for queries, in the half-open form A's schema uses: [start, end)
export function toRange(start: Date | string, end: Date | string): string {
  const a = new Date(start).toISOString();
  const b = new Date(end).toISOString();
  return `[${a},${b})`;
}
