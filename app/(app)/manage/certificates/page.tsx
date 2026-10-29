"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRightIcon, FileTextIcon } from "lucide-react";
import { RequireHat } from "@/components/layout/app-shell";
import { Ago, EmptyState, ErrorBlock, LoadingBlock, PageHeader, buttonVariants } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Avatar, Tabs } from "@/components/ui/misc";
import { api } from "@/lib/screens";
import { useQuery } from "@/lib/screens/use-query";

export default function CertificateQueuePage() {
  const [tab, setTab] = useState<"pending" | "decided">("pending");
  const { data, error, loading, reload } = useQuery(() => api.listCertificatesToReview(tab), [tab]);
  const pending = useQuery(() => api.listCertificatesToReview("pending"), []);

  return (
    <RequireHat hats={["manager", "owner", "admin"]}>
      <PageHeader eyebrow="Tier 2 badges" title="Certificate review" description="Open each certificate, check it covers the machine, then approve the badge or reject it with a reason." />
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { value: "pending", label: "To review", count: pending.data?.length },
          { value: "decided", label: "Decided" },
        ]}
      />
      <div className="mt-5">
        {error ? (
          <ErrorBlock message={error} onRetry={reload} />
        ) : loading && !data ? (
          <LoadingBlock />
        ) : !data?.length ? (
          <EmptyState title={tab === "pending" ? "No certificates waiting" : "Nothing decided yet"} art="plant" />
        ) : (
          <ul className="grid gap-3">
            {data.map((c) => (
              <li key={c.userBadgeId} className="paper flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-3">
                  <Avatar name={c.userName ?? "Student"} />
                  <div className="min-w-0">
                    <p className="font-semibold">
                      {c.userName ?? "Student"} <span className="font-normal text-mute">for</span> {c.resourceName}
                    </p>
                    <p className="flex items-center gap-1.5 text-[13px] text-mute">
                      <FileTextIcon className="size-3.5" /> {c.userRollNo ? `${c.userRollNo} · ` : ""}sent <Ago iso={c.submittedAt} />
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {c.status !== "pending" && <Badge tone={c.status === "approved" ? "mint" : "coral"}>{c.status}</Badge>}
                  <Link href={`/manage/certificates/${c.userBadgeId}`} className={buttonVariants({ size: "sm" })}>
                    {c.status === "pending" ? "Review" : "View"} <ArrowRightIcon />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </RequireHat>
  );
}
