"use client";

// LINKS.adminIncident: a disputed incident for the admin to uphold or overturn.

import { useParams } from "next/navigation";
import { RequireHat } from "@/components/layout/app-shell";
import { IncidentView } from "@/components/shared/incident-view";

export default function AdminIncidentPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireHat hats={["admin"]}>
      <IncidentView id={id} mode="admin" back={{ href: "/admin/disputes", label: "Disputes" }} />
    </RequireHat>
  );
}
