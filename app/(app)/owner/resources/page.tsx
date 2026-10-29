"use client";

import Link from "next/link";
import { PencilIcon, PlusIcon, QrCodeIcon } from "lucide-react";
import { RequireHat } from "@/components/layout/app-shell";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, ResourceThumb, TierBadge, buttonVariants } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/screens";
import { useQuery } from "@/lib/screens/use-query";

const STATUS = { active: { l: "Bookable", t: "mint" }, maintenance: { l: "Maintenance", t: "coral" }, inactive: { l: "Hidden", t: "muted" } } as const;

export default function OwnerResourcesPage() {
  const { data, error, loading, reload } = useQuery(() => api.listOwnerResources(), []);
  return (
    <RequireHat hats={["owner", "admin"]}>
      <PageHeader
        eyebrow="department owner"
        title="Our resources"
        description="List what your department can share, set who can use it and how much, and print a QR for each one."
        actions={
          <Link href="/owner/resources/new" className={buttonVariants()}>
            <PlusIcon /> List a resource
          </Link>
        }
      />
      {error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingBlock />
      ) : !data?.length ? (
        <EmptyState
          title="Nothing listed yet"
          body="Start with the room or machine that sits idle most."
          action={
            <Link href="/owner/resources/new" className={buttonVariants()}>
              List a resource
            </Link>
          }
        />
      ) : (
        <div className="paper overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b-2 border-ink bg-paper-2 text-left text-[12px] uppercase tracking-[0.08em]">
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Limits</th>
                  <th className="px-4 py-3">Activity</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.id} className="border-b-[1.5px] border-ink/15 last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ResourceThumb resource={r} className="w-16 shrink-0 rounded-lg" />
                        <div>
                          <Link href={`/resources/${r.id}`} className="font-semibold hover:underline">
                            {r.name}
                          </Link>
                          <p className="text-[12px] text-mute">
                            {r.departmentName}
                            {r.location && ` · ${r.location}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <TierBadge tier={r.tier} />
                    </td>
                    <td className="px-4 py-3 text-[13px]">
                      {r.maxHours} h / booking
                      <br />
                      {r.weeklyCapHours} h / week
                    </td>
                    <td className="px-4 py-3 text-[13px]">
                      {r.openRequests} pending · {r.openIncidents} incidents
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS[r.status].t}>{STATUS[r.status].l}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1.5">
                        <Link href={`/owner/resources/${r.id}/qr`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                          <QrCodeIcon /> QR
                        </Link>
                        <Link href={`/owner/resources/${r.id}/edit`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                          <PencilIcon /> Edit
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </RequireHat>
  );
}
