"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { QrCodeIcon } from "lucide-react";
import { RequireHat } from "@/components/layout/app-shell";
import { ErrorBlock, LoadingBlock, PageHeader, ReasonDialog, buttonVariants } from "@/components/shared";
import { ResourceForm } from "@/components/shared/resource-form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, type ResourceStatus } from "@/lib/screens";
import { useQuery } from "@/lib/screens/use-query";

export default function EditResourcePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const draft = useQuery(() => api.getResourceDraft(id), [id]);
  const res = useQuery(() => api.getResource(id), [id]);
  const depts = useQuery(() => api.listOwnedDepartments(), []);
  const managers = useQuery(() => api.listAssignableManagers(), []);
  const [status, setStatus] = useState<ResourceStatus | null>(null);
  const err = draft.error ?? res.error ?? depts.error ?? managers.error;
  if (err) return <ErrorBlock message={err} onRetry={draft.reload} />;
  if (!draft.data || !res.data || !depts.data || !managers.data) return <LoadingBlock rows={3} />;
  const r = res.data;
  return (
    <RequireHat hats={["owner", "admin"]}>
      <PageHeader
        back={{ href: "/owner/resources", label: "Our resources" }}
        eyebrow={`edit listing · ${r.status}`}
        title={r.name}
        actions={
          <>
            <Link href={`/owner/resources/${id}/qr`} className={buttonVariants({ variant: "outline" })}>
              <QrCodeIcon /> QR
            </Link>
            {r.status === "active" ? (
              <>
                <Button variant="outline" onClick={() => setStatus("maintenance")}>
                  Maintenance
                </Button>
                <Button variant="ghost" onClick={() => setStatus("inactive")}>
                  Hide
                </Button>
              </>
            ) : (
              <Button onClick={() => setStatus("active")}>Make bookable</Button>
            )}
          </>
        }
      />
      <ResourceForm
        key={draft.data.id}
        departments={depts.data}
        managers={managers.data}
        photoUrl={r.photoUrl}
        submitLabel="Save changes"
        initial={draft.data}
        onSubmit={async (v) => {
          const out = await api.saveResource({ ...v, id });
          if (!out.ok) return toast.error("Not saved", out.error);
          toast.success("Saved");
          router.push("/owner/resources");
        }}
      />
      <ReasonDialog
        open={!!status}
        onClose={() => setStatus(null)}
        title={status === "active" ? "Make it bookable" : status === "maintenance" ? "Put under maintenance" : "Hide from students"}
        description="Saved in the audit log. Students with bookings are told."
        confirmLabel="Save"
        tone={status === "active" ? "default" : "danger"}
        onConfirm={async (reason) => {
          const out = await api.setResourceStatus(id, status!, reason);
          if (!out.ok) {
            toast.error("Not changed", out.error);
            return false;
          }
          toast.success("Status changed");
        }}
      />
    </RequireHat>
  );
}
