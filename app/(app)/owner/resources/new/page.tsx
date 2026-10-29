"use client";

import { useRouter } from "next/navigation";
import { RequireHat } from "@/components/layout/app-shell";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader } from "@/components/shared";
import { ResourceForm } from "@/components/shared/resource-form";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/screens";
import { useQuery } from "@/lib/screens/use-query";

export default function NewResourcePage() {
  const router = useRouter();
  const toast = useToast();
  const depts = useQuery(() => api.listOwnedDepartments(), []);
  const managers = useQuery(() => api.listAssignableManagers(), []);
  if (depts.error || managers.error) return <ErrorBlock message={depts.error ?? managers.error ?? ""} onRetry={depts.reload} />;
  if (!depts.data || !managers.data) return <LoadingBlock />;
  if (!depts.data.length) return <EmptyState title="You don't own a department" body="Only department owners and admins can list resources." />;
  return (
    <RequireHat hats={["owner", "admin"]}>
      <PageHeader back={{ href: "/owner/resources", label: "Our resources" }} eyebrow="new listing" title="List a resource" />
      <ResourceForm
        departments={depts.data}
        managers={managers.data}
        submitLabel="Publish listing"
        initial={{
          name: "",
          type: "equipment",
          tier: 1,
          departmentId: depts.data[0].id,
          managerId: managers.data[0]?.id ?? "",
          location: "",
          maxHours: 3,
          weeklyCapHours: 6,
          depositAmount: 0,
          checklist: ["Powered off and clean", "All parts present"],
          slots: [0, 1, 2, 3, 4].map((weekday) => ({ weekday, start: "09:00", end: "17:00" })),
        }}
        onSubmit={async (v) => {
          const r = await api.saveResource(v);
          if (!r.ok) return toast.error("Not saved", r.error);
          toast.success("Listed", "Add a photo, then print the QR and stick it on the resource.");
          router.push(`/owner/resources/${r.data.id}/edit`);
        }}
      />
    </RequireHat>
  );
}
