"use server";

// In-app notifications — Member B. Repo path: lib/actions/notifications.ts
//
// A's database creates notification rows automatically (_notify, bookings_notify trigger).
// Students and staff read only their own rows (RLS) and mark them read with A's function.
// For the live bell, C uses useNotifications() from lib/notifications/use-notifications.ts.

import { getDb } from "@/lib/actions/db";
import { describeNotification, type NotificationMessage, type NotificationPayload } from "@/lib/notifications/messages";
import { type Result, ok, fail, friendlyError, UUID } from "@/lib/actions/errors";

export type NotificationItem = NotificationMessage & {
  id: string;
  type: string;
  payload: NotificationPayload;
  readAt: string | null;
  createdAt: string;
};

export async function getNotifications(limit = 30): Promise<Result<{ items: NotificationItem[]; unread: number }>> {
  const supabase = await getDb();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail("Please log in first.");

  const [list, count] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, type, payload, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 100)),
    supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
  ]);
  if (list.error) return fail(friendlyError(list.error));

  type Row = { id: string; type: string; payload: NotificationPayload | null; read_at: string | null; created_at: string };
  const items: NotificationItem[] = ((list.data ?? []) as Row[]).map((n) => ({
    id: n.id as string,
    type: n.type as string,
    payload: (n.payload ?? {}) as NotificationPayload,
    readAt: (n.read_at as string | null) ?? null,
    createdAt: n.created_at as string,
    ...describeNotification(n.type as string, (n.payload ?? {}) as NotificationPayload),
  }));
  return ok({ items, unread: (count.count as number | null) ?? items.filter((i) => !i.readAt).length });
}

export async function markNotificationRead(id: string): Promise<Result<null>> {
  if (!UUID.test(id)) return fail("Unknown notification.");
  const supabase = await getDb();
  const { error } = await supabase.rpc("mark_notification_read", { p_notification_id: id });
  if (error) return fail(friendlyError(error));
  return ok(null);
}

export async function markAllNotificationsRead(): Promise<Result<{ marked: number }>> {
  const supabase = await getDb();
  const { data, error } = await supabase.from("notifications").select("id").is("read_at", null).limit(200);
  if (error) return fail(friendlyError(error));
  const ids = ((data ?? []) as { id: string }[]).map((n) => n.id);
  const results = await Promise.all(ids.map((id: string) => supabase.rpc("mark_notification_read", { p_notification_id: id })));
  return ok({ marked: results.filter((r) => !r.error).length });
}
