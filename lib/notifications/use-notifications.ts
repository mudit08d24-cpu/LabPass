"use client";

// Live notification bell — Member B, for C's screens. Repo path: lib/notifications/use-notifications.ts
//
// A's schema adds `notifications` to Supabase Realtime. This hook listens for new rows for the
// current user and keeps the list and unread count up to date.
//
// Usage in C's bell component:
//   const { items, unread, markRead, markAllRead } = useNotifications(userId, initial);
// where `initial` comes from getNotifications() on the server.

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { describeNotification, type NotificationPayload } from "@/lib/notifications/messages";
import { markNotificationRead, markAllNotificationsRead, type NotificationItem } from "@/lib/actions/notifications";

type Row = { id: string; type: string; payload: NotificationPayload | null; read_at: string | null; created_at: string };

function toItem(row: Row): NotificationItem {
  const payload = row.payload ?? {};
  return {
    id: row.id,
    type: row.type,
    payload,
    readAt: row.read_at,
    createdAt: row.created_at,
    ...describeNotification(row.type, payload),
  };
}

export function useNotifications(userId: string | null, initial: { items: NotificationItem[]; unread: number }) {
  const [items, setItems] = useState<NotificationItem[]>(initial.items);
  const [unread, setUnread] = useState<number>(initial.unread);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let stopped = false;
    void (async () => {
      // Realtime applies row-level security with the token it holds. Give it the signed-in user's
      // token first; otherwise it connects as anonymous and never receives this user's rows.
      const { data } = await supabase.auth.getSession();
      if (stopped) return;
      if (data.session?.access_token) await supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`notifications:${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          (change) => {
            const item = toItem(change.new as Row);
            setItems((prev) => (prev.some((i) => i.id === item.id) ? prev : [item, ...prev].slice(0, 100)));
            setUnread((n) => n + 1);
          },
        )
        .subscribe();
    })();
    return () => {
      stopped = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId]);

  const markRead = useCallback(async (id: string) => {
    const target = items.find((i) => i.id === id);
    if (!target || target.readAt) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, readAt: now } : i)));
    setUnread((n) => Math.max(0, n - 1));
    const res = await markNotificationRead(id);
    if (!res.ok) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, readAt: null } : i)));
      setUnread((n) => n + 1);
    }
  }, [items]);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((i) => (i.readAt ? i : { ...i, readAt: now })));
    setUnread(0);
    await markAllNotificationsRead();
  }, []);

  return { items, unread, markRead, markAllRead };
}
