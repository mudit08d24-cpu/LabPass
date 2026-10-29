"use client";

import Link from "next/link";
import { useState } from "react";
import { RequireHat } from "@/components/layout/app-shell";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, SlotText, StatusBadge } from "@/components/shared";
import { Input, Select } from "@/components/ui/input";
import { api, type BookingStatus } from "@/lib/screens";
import { useQuery } from "@/lib/screens/use-query";

const STATUSES: BookingStatus[] = ["requested", "approved", "waitlisted", "checked_in", "returned", "completed", "cancelled", "rejected", "no_show", "overdue"];

export default function AllBookingsPage() {
  const { data, error, loading, reload } = useQuery(() => api.listAllBookings(), []);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const rows = (data ?? []).filter((b) => (!status || b.status === status) && (!needle || `${b.userName ?? ""} ${b.userRollNo ?? ""} ${b.resource.name}`.toLowerCase().includes(needle)));
  return (
    <RequireHat hats={["admin"]}>
      <PageHeader
        eyebrow="everything, every department"
        title="All bookings"
        actions={
          <div className="flex flex-wrap gap-2">
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Student, roll no or resource" aria-label="Search bookings" className="w-60" />
            <div className="w-44">
              <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status">
                <option value="">All statuses</option>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace("_", " ")}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        }
      />
      {error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingBlock />
      ) : !rows.length ? (
        <EmptyState title="No bookings match" />
      ) : (
        <div className="paper overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b-2 border-ink bg-paper-2 text-left text-[12px] uppercase tracking-[0.08em]">
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Resource</th>
                  <th className="px-4 py-3">Slot</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Credits</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id} className="border-b border-ink/15 hover:bg-sun-soft/50">
                    <td className="px-4 py-2.5">
                      <span className="font-semibold">{b.userName ?? "Student"}</span>
                      {b.userRollNo && <span className="block text-[12px] text-mute">{b.userRollNo}</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/manage/requests/${b.id}`} className="underline-offset-2 hover:underline">
                        {b.resource.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <SlotText start={b.start} end={b.end} />
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={b.status} />
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{b.creditsCharged}</td>
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
