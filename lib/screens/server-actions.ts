"use server";

// C's two server actions. Everything else the screens write goes through B's actions.
//  - loadRules: screens are client components, and B's getRules() is server-only.
//  - saveResource: API.md has no action for the owner's add/edit form; A's grants let a
//    department owner write resources and availability_slots under RLS, so this writes them
//    from the server. B can move it into src/lib/actions/resources.ts without screen changes.

import { getRules } from "@/lib/rules";
import { serverDb } from "./server";
import type { ResourceDraft, Result, Rules } from "./types";

export async function loadRules(): Promise<Rules> {
  return (await getRules()) as unknown as Rules;
}

export async function saveResource(d: ResourceDraft): Promise<Result<{ id: string }>> {
  const db = await serverDb();
  const row = {
    name: d.name.trim(),
    type: d.type,
    tier: d.tier,
    department_id: d.departmentId,
    manager_id: d.managerId,
    location: d.location.trim() || null,
    max_hours: d.maxHours,
    weekly_cap_hours: d.weeklyCapHours,
    deposit_amount: d.depositAmount,
    checklist: d.checklist,
  };
  let id = d.id;
  if (id) {
    const { error } = await db.from("resources").update(row).eq("id", id);
    if (error) return { ok: false, error: plain(error.message) };
  } else {
    const { data, error } = await db.from("resources").insert(row).select("id").single();
    if (error || !data) return { ok: false, error: plain(error?.message) };
    id = data.id;
  }
  const { error: delErr } = await db.from("availability_slots").delete().eq("resource_id", id);
  if (delErr) return { ok: false, error: plain(delErr.message) };
  if (d.slots.length) {
    const { error } = await db
      .from("availability_slots")
      .insert(d.slots.map((s) => ({ resource_id: id!, weekday: s.weekday, start_time: s.start, end_time: s.end })));
    if (error) return { ok: false, error: plain(error.message) };
  }
  return { ok: true, data: { id: id! } };
}

function plain(msg?: string) {
  if (!msg) return "Something went wrong. Please try again.";
  if (/row-level security|permission denied/i.test(msg)) return "You don't have permission to do this.";
  if (/manager role/i.test(msg)) return "The assigned manager must have the manager role.";
  if (/duplicate|unique/i.test(msg)) return "Two open-hours rows are the same; remove the duplicate.";
  return msg;
}

/** Saves the photo paths list after B's uploadResourcePhoto (API.md: save `path` in resources.photos). */
export async function setResourcePhotos(resourceId: string, paths: string[]): Promise<Result> {
  const db = await serverDb();
  const { error } = await db.from("resources").update({ photos: paths }).eq("id", resourceId);
  return error ? { ok: false, error: plain(error.message) } : { ok: true, data: undefined };
}
