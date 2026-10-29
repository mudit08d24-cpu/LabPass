"use client";

import { NotificationRow } from "@/components/layout/notification-bell";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/screens";
import { useQuery } from "@/lib/screens/use-query";

export default function NotificationsPage() {
  const { data, error, loading, reload } = useQuery(() => api.getNotifications(), []);
  const unread = data?.unread ?? 0;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="in-app and email"
        title="Notifications"
        actions={
          unread > 0 ? (
            <Button variant="outline" onClick={() => api.markAllNotificationsRead()}>
              Mark all read
            </Button>
          ) : undefined
        }
      />
      {error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingBlock />
      ) : !data?.items.length ? (
        <EmptyState title="All quiet" body="Approvals, waitlist offers, reminders and decisions show up here." />
      ) : (
        <ul className="paper grid gap-1 p-2">
          {data.items.map((n) => (
            <NotificationRow key={n.id} n={n} onOpen={(x) => !x.readAt && api.markNotificationRead(x.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}
