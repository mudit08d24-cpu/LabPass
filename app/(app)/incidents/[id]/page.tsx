"use client";

// One link for everyone (LINKS.incident = /incidents/<id>): the booking's student sees
// respond/dispute; managers, owners and admins see the review tools.

import { useParams } from "next/navigation";
import { IncidentView } from "@/components/shared/incident-view";
import { ErrorBlock, LoadingBlock } from "@/components/shared";
import { api } from "@/lib/screens";
import { hatsOf, useMe } from "@/lib/screens/session";
import { useQuery } from "@/lib/screens/use-query";

export default function IncidentPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const { data, error, reload } = useQuery(() => api.getIncident(id), [id]);
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (!data) return <LoadingBlock rows={3} />;
  const hats = hatsOf(me);
  const mine = data.incident.booking.userId === me.id;
  const staff = hats.includes("manager") || hats.includes("owner") || hats.includes("admin");
  const mode = mine ? "student" : staff ? "staff" : "viewer";
  return <IncidentView id={id} mode={mode} back={mine ? { href: `/bookings/${data.incident.bookingId}`, label: "Booking" } : { href: "/manage/incidents", label: "Incidents" }} />;
}
