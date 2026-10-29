// LabPass business rules, read from the database — Member B. Goes in the repo at lib/rules.ts.
//
// The numbers live in A's labpass_config() (agreed at the hour-4 sync), so the database
// checks and the screens always use the same values. Server-side only.
//
// Usage in a server component or server action:
//   const rules = await getRules();
//   rules.max_active_bookings   // 2

import { cache } from "react";
import { getDb } from "@/lib/actions/db";

// Keys match labpass_config() in labpass_schema.sql.
export type Rules = {
  timezone: string;
  max_active_bookings: number;
  default_weekly_hours_per_resource: number;
  weekly_credit_budget: number;
  credits_per_hour: number;
  credits_per_hour_specialised: number;
  supervisor_reward_per_hour: number;
  free_cancel_hours: number;
  checkin_grace_minutes: number;
  reminder_minutes: number;
  waitlist_offer_minutes: number;
  graduation_sessions: number;
  no_show_flag_count: number;
  no_show_window_days: number;
  no_show_block_days: number;
  photo_retention_days: number;
  priority_base: number;
  priority_fresh_bonus: number;
  priority_fresh_days: number;
  priority_deadline_bonus: number;
  priority_per_week_hour: number; // negative, e.g. -5
  priority_per_no_show: number; // negative, e.g. -25
};

// cache() means one database call per page request, however many times it's used.
export const getRules = cache(async (): Promise<Rules> => {
  const supabase = await getDb();
  const { data, error } = await supabase.rpc("labpass_config");
  if (error || !data) throw new Error("Could not load LabPass rules from the database");
  return data as Rules;
});
