import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------------------------------------------------------
// Time. LabPass runs on institution time (Asia/Kolkata, UTC+05:30, no DST),
// whatever time zone the viewer's device is in. API.md: send and receive ISO strings.
// ---------------------------------------------------------------------------

export const TZ = "Asia/Kolkata";
const IST_OFFSET_MIN = 330;

/** Calendar parts of an instant in IST. weekday: Mon = 0 … Sun = 6 (A's availability_slots). */
export function istParts(d: Date | string) {
  const t = new Date(typeof d === "string" ? d : d.getTime());
  const s = new Date(t.getTime() + IST_OFFSET_MIN * 60_000);
  return {
    year: s.getUTCFullYear(),
    month: s.getUTCMonth(),
    day: s.getUTCDate(),
    hour: s.getUTCHours(),
    minute: s.getUTCMinutes(),
    weekday: (s.getUTCDay() + 6) % 7,
  };
}

/** The instant for an IST wall-clock time. */
export function istDate(year: number, month: number, day: number, hour = 0, minute = 0) {
  return new Date(Date.UTC(year, month, day, hour, minute) - IST_OFFSET_MIN * 60_000);
}

/** Start of today in IST, plus `days`. */
export function istDayStart(days = 0) {
  const p = istParts(new Date());
  return istDate(p.year, p.month, p.day + days);
}

/** yyyy-mm-dd of an instant in IST (Idle Radar dates). */
export function istDateKey(d: Date | string) {
  const p = istParts(d);
  return `${p.year}-${String(p.month + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

const WD = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const WEEKDAYS = WD;

export function fmtTime(iso: string) {
  const p = istParts(iso);
  const ap = p.hour >= 12 ? "pm" : "am";
  const h = p.hour % 12 || 12;
  return p.minute ? `${h}:${String(p.minute).padStart(2, "0")} ${ap}` : `${h} ${ap}`;
}

export function fmtDay(iso: string) {
  const p = istParts(iso);
  const t = istParts(new Date());
  const diff = Math.round((Date.UTC(p.year, p.month, p.day) - Date.UTC(t.year, t.month, t.day)) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return `${WD[p.weekday]} ${p.day} ${MON[p.month]}`;
}

export function fmtDateTime(iso: string) {
  return `${fmtDay(iso)}, ${fmtTime(iso)}`;
}

export function fmtSlot(start: string, end: string) {
  return `${fmtDay(start)}, ${fmtTime(start)}–${fmtTime(end)}`;
}

export function hoursBetween(start: string, end: string) {
  return Math.round(((new Date(end).getTime() - new Date(start).getTime()) / 3_600_000) * 100) / 100;
}

export function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}

export function initials(name: string) {
  return (
    name
      .replace(/^(Dr|Mr|Ms|Mrs)\.?\s+/i, "")
      .split(/\s+/)
      .filter(Boolean)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?"
  );
}

export function pct(n: number | null | undefined) {
  return n === null || n === undefined ? "–" : `${Math.round(n * 100)}%`;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
