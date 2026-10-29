"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { RequireHat } from "@/components/layout/app-shell";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, ResourceThumb, SlotText, buttonVariants } from "@/components/shared";
import { Avatar } from "@/components/ui/misc";
import { api } from "@/lib/screens";
import { useQuery } from "@/lib/screens/use-query";

export default function ReturnsPage() {
  const { data, error, loading, reload } = useQuery(() => api.listPendingReturns(), []);
  return (
    <RequireHat hats={["manager", "owner", "admin"]}>
      <PageHeader eyebrow="handovers" title="Returns to confirm" description="Compare check-in and return photos, then confirm. Confirming completes the booking and pays any peer supervisor who co-signed both reports." />
      {error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingBlock />
      ) : !data?.length ? (
        <EmptyState title="Nothing to confirm" body="Returned bookings land here." art="plant" />
      ) : (
        <ul className="grid gap-3">
          {data.map((b) => (
            <li key={b.id} className="paper flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
              <ResourceThumb resource={b.resource} className="w-full sm:w-28" />
              <div className="flex flex-1 items-center gap-3">
                <Avatar name={b.userName ?? "Student"} />
                <div>
                  <p className="font-semibold">
                    {b.userName ?? "Student"} · {b.resource.name}
                  </p>
                  <p className="text-sm text-ink/75">
                    <SlotText start={b.start} end={b.end} />
                    {b.supervisorName && <> · with {b.supervisorName}</>}
                  </p>
                </div>
              </div>
              <Link href={`/manage/requests/${b.id}`} className={buttonVariants({ size: "sm" })}>
                Compare photos <ArrowRightIcon />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </RequireHat>
  );
}
