"use client";

// Peer supervision (API.md "Peer supervisors"). LINKS.supervising = /supervising.

import Link from "next/link";
import { useId, useState } from "react";
import { CalendarClockIcon, HandshakeIcon, Trash2Icon } from "lucide-react";
import { RequireHat } from "@/components/layout/app-shell";
import { EmptyState, ErrorBlock, LoadingBlock, PageHeader, Section, SlotText, StatTile, StatusBadge, buttonVariants } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/screens";
import { useQuery, useRules } from "@/lib/screens/use-query";
import { istDate, istDateKey } from "@/lib/utils";

/** "2026-10-30" + "14:00" in India time → ISO. */
function istIso(date: string, time: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return istDate(y, m - 1, d, hh, mm).toISOString();
}

export default function SupervisingPage() {
  const toast = useToast();
  const rules = useRules();
  const ids = { res: useId(), date: useId(), from: useId(), to: useId(), app: useId() };
  const { data, error, loading, reload } = useQuery(() => api.getSupervision(), []);
  const tomorrow = istDateKey(new Date(Date.now() + 86_400_000));
  const [form, setForm] = useState({ resource: "", date: tomorrow, from: "14:00", to: "17:00" });
  const [applyFor, setApplyFor] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingBlock rows={3} />;
  const approved = data.applications.filter((a) => a.status === "approved");
  const toSign = data.sessions.filter((s) => s.needsCosign);
  const resourceId = form.resource || approved[0]?.resourceId || "";
  const applyId = applyFor || data.canApply[0]?.id || "";
  const upcoming = data.sessions.filter((s) => !["completed", "cancelled", "rejected", "no_show"].includes(s.status));
  
  return (
    <RequireHat hats={["student", "supervisor"]}>
      <PageHeader
        eyebrow="peer supervision"
        title="Supervising"
        description={`Tier 2 students can supervise Tier 3 sessions and earn ${rules?.supervisor_reward_per_hour ?? "–"} credit per hour once the manager confirms the return. Every hour you publish unlocks the machine for someone else.`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Approved for" value={approved.length} hint={approved.map((a) => a.resourceName).join(", ") || "Nothing yet"} />
        <StatTile label="Waiting for your co-sign" value={toSign.length} tone={toSign.length ? "sun" : "paper"} />
        <StatTile label="Hours windows published" value={data.hours.length} hint="Students can pick you in these" tone="ink" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="grid content-start gap-6">
          <Section title="Sessions you supervise">
            {upcoming.length === 0 ? (
              <EmptyState title="No sessions yet" body="When a student picks you for a Tier 3 slot, it shows up here." art="plant" />
            ) : (
              <ul className="grid gap-2">
                {upcoming.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-ink bg-white px-3 py-2.5">
                    <Avatar name={s.userName ?? "Student"} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">
                        {s.userName ?? "Student"} · {s.resource.name}
                      </p>
                      <p className="text-[12px] text-mute">
                        <SlotText start={s.start} end={s.end} />
                      </p>
                    </div>
                    {s.needsCosign ? (
                      <Link href={`/supervising/cosign/${s.id}`} className={buttonVariants({ size: "sm" })}>
                        <HandshakeIcon /> Co-sign {s.needsCosign.stage === "check_in" ? "check-in" : "return"}
                      </Link>
                    ) : (
                      <StatusBadge status={s.status} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Applications">
            {data.applications.length > 0 && (
              <ul className="mb-4 grid gap-2">
                {data.applications.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border-2 border-ink bg-white px-3 py-2">
                    <span className="text-sm">
                      <span className="font-semibold">{a.resourceName}</span>
                      {a.reason && <span className="block text-[12px] text-ink/70">“{a.reason}”</span>}
                    </span>
                    <Badge tone={a.status === "approved" ? "mint" : a.status === "pending" ? "sun" : "coral"}>{a.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
            {data.canApply.length === 0 ? (
              <p className="text-sm text-mute">{approved.length || data.applications.length ? "Nothing else to apply for right now." : "You need a Tier 2 badge on a supervised (Tier 3) machine before you can supervise it."}</p>
            ) : (
              <form
                className="grid gap-3"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy("apply");
                  const r = await api.applyAsSupervisor(applyId);
                  setBusy(null);
                  if (!r.ok) toast.error("Not sent", r.error);
                  else toast.success("Application sent", "The lab manager approves it or replies with a reason.");
                }}
              >
                <Field id={ids.app} label="Machine">
                  <Select id={ids.app} value={applyId} onChange={(e) => setApplyFor(e.target.value)}>
                    {data.canApply.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Button type="submit" loading={busy === "apply"}>
                  Apply to supervise
                </Button>
              </form>
            )}
          </Section>
        </div>

        <Section title="Hours you're free to supervise" aside={<CalendarClockIcon className="size-5" />}>
          {approved.length === 0 ? (
            <p className="text-sm text-mute">Once a manager approves you, publish the hours you can supervise here.</p>
          ) : (
            <>
              <form
                className="grid gap-3 sm:grid-cols-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (form.to <= form.from) return toast.error("Check the times", "The end must be after the start.");
                  setBusy("hours");
                  const r = await api.publishSupervisorHours(resourceId, istIso(form.date, form.from), istIso(form.date, form.to));
                  setBusy(null);
                  if (!r.ok) toast.error("Not published", r.error);
                  else toast.success("Hours published", "Students can now pick you for this window.");
                }}
              >
                <Field id={ids.res} label="Machine" className="sm:col-span-2">
                  <Select id={ids.res} value={resourceId} onChange={(e) => setForm({ ...form, resource: e.target.value })}>
                    {approved.map((a) => (
                      <option key={a.resourceId} value={a.resourceId}>
                        {a.resourceName}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field id={ids.date} label="Day" className="sm:col-span-2">
                  <Input id={ids.date} type="date" value={form.date} min={istDateKey(new Date())} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </Field>
                <Field id={ids.from} label="From (India time)">
                  <Input id={ids.from} type="time" step={1800} value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} />
                </Field>
                <Field id={ids.to} label="To">
                  <Input id={ids.to} type="time" step={1800} value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
                </Field>
                <Button type="submit" className="sm:col-span-2" loading={busy === "hours"}>
                  Publish hours
                </Button>
              </form>
              <ul className="mt-5 grid gap-2">
                {data.hours.length === 0 && <li className="text-sm text-mute">No hours published yet.</li>}
                {data.hours.map((s) => (
                  <li key={s.slotId} className="flex items-center justify-between gap-3 rounded-xl border-2 border-ink bg-white px-3 py-2">
                    <span className="text-sm">
                      <span className="font-semibold">{s.resourceName}</span> · <SlotText start={s.start} end={s.end} />
                    </span>
                    <button
                      onClick={async () => {
                        const r = await api.removeSupervisorHours(s.slotId);
                        if (!r.ok) toast.error("Not removed", r.error);
                      }}
                      className="grid size-8 place-items-center rounded-full hover:bg-coral"
                      aria-label={`Remove hours for ${s.resourceName}`}
                    >
                      <Trash2Icon className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Section>
      </div>
    </RequireHat>
  );
}
