"use client";

// Peer supervisor applications (LINKS.supervisorApplications) and Tier 3 → Tier 2 graduation.

import { useState } from "react";
import { CheckIcon, GraduationCapIcon, PauseIcon } from "lucide-react";
import { RequireHat } from "@/components/layout/app-shell";
import { Ago, EmptyState, ErrorBlock, LoadingBlock, PageHeader, ReasonDialog, Section } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, type GraduationCandidate } from "@/lib/screens";
import { useQuery, useRules } from "@/lib/screens/use-query";
import { cn } from "@/lib/utils";

type Dlg = null | { kind: "rejected" | "suspended"; id: string } | { kind: "graduate"; g: GraduationCandidate };

export default function SupervisorsPage() {
  const toast = useToast();
  const rules = useRules();
  const apps = useQuery(() => api.listSupervisorApplications(), []);
  const grads = useQuery(() => api.listGraduationCandidates(), []);
  const [dlg, setDlg] = useState<Dlg>(null);
  const [busy, setBusy] = useState<string | null>(null);
  if (apps.error) return <ErrorBlock message={apps.error} onRetry={apps.reload} />;
  if (apps.loading && !apps.data) return <LoadingBlock rows={3} />;
  const all = apps.data ?? [];
  const pending = all.filter((a) => a.status === "pending");
  const decided = all.filter((a) => a.status !== "pending");

  const approve = async (id: string, name: string | null) => {
    setBusy(id);
    const r = await api.decideSupervisor(id, "approved");
    setBusy(null);
    if (!r.ok) toast.error("Not approved", r.error);
    else toast.success(`${name?.split(" ")[0] ?? "They"} can supervise now`);
  };

  return (
    <RequireHat hats={["manager", "owner", "admin"]}>
      <PageHeader eyebrow="peer supervision" title="Supervisors" description="Approve Tier 2 students to supervise, suspend them with a reason, and graduate Tier 3 students after clean supervised sessions." />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid content-start gap-6">
          <Section title={`Applications (${pending.length})`}>
            {!pending.length ? (
              <EmptyState title="No applications" art="plant" />
            ) : (
              <ul className="grid gap-3">
                {pending.map((a) => (
                  <li key={a.id} className="rounded-2xl border-2 border-ink bg-white p-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={a.userName ?? "Student"} />
                      <div className="flex-1">
                        <p className="font-semibold">{a.userName ?? "Student"}</p>
                        <p className="text-[12px] text-mute">
                          {a.resourceName} · {a.completedSessions} completed sessions · <Ago iso={a.createdAt} />
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" loading={busy === a.id} onClick={() => approve(a.id, a.userName)}>
                        <CheckIcon /> Approve
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setDlg({ kind: "rejected", id: a.id })}>
                        Reject
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Supervisors">
            {!decided.length ? (
              <p className="text-sm text-mute">No supervisors yet.</p>
            ) : (
              <ul className="grid gap-2">
                {decided.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-ink bg-white px-3 py-2.5">
                    <Avatar name={a.userName ?? "Student"} className={cn(a.status === "approved" ? "bg-lilac" : "bg-paper-2")} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{a.userName ?? "Student"}</p>
                      <p className="text-[12px] text-mute">
                        {a.resourceName} · {a.completedSessions} completed sessions
                      </p>
                      {a.reason && a.status !== "approved" && <p className="text-[12px]">“{a.reason}”</p>}
                    </div>
                    <Badge tone={a.status === "approved" ? "mint" : "coral"}>{a.status}</Badge>
                    {a.status === "approved" ? (
                      <Button size="sm" variant="outline" onClick={() => setDlg({ kind: "suspended", id: a.id })}>
                        <PauseIcon /> Suspend
                      </Button>
                    ) : a.status === "suspended" ? (
                      <Button size="sm" variant="outline" loading={busy === a.id} onClick={() => approve(a.id, a.userName)}>
                        Reinstate
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
        <Section title="Graduation · Tier 3 → Tier 2">
          <p className="mb-4 text-sm text-mute">Students become eligible after {rules?.graduation_sessions ?? "–"} supervised sessions with clean returns. Sign-off is yours.</p>
          {grads.loading && !grads.data ? (
            <LoadingBlock rows={2} />
          ) : !grads.data?.length ? (
            <EmptyState title="No one in progress" />
          ) : (
            <ul className="grid gap-3">
              {grads.data.map((g) => {
                const p = g.progress;
                return (
                  <li key={`${g.userId}-${g.resource.id}`} className={cn("rounded-2xl border-2 border-ink p-4", p.readyForSignoff ? "bg-mint" : "bg-white")}>
                    <div className="flex items-center gap-3">
                      <Avatar name={g.userName ?? "Student"} />
                      <div className="flex-1">
                        <p className="font-semibold">{g.userName ?? "Student"}</p>
                        <p className="text-[12px] text-mute">{g.resource.name}</p>
                      </div>
                      <span className="font-display text-lg font-bold">
                        {Math.min(p.cleanSessions, p.required)}/{p.required}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2" aria-hidden>
                      {Array.from({ length: p.required }, (_, i) => (
                        <span key={i} className={cn("h-2.5 flex-1 rounded-full border-[1.5px] border-ink", i < p.cleanSessions ? "bg-ink" : "bg-paper")} />
                      ))}
                    </div>
                    <Button size="sm" className="mt-3" disabled={!p.readyForSignoff || p.graduated} onClick={() => setDlg({ kind: "graduate", g })}>
                      <GraduationCapIcon /> {p.graduated ? "Graduated" : p.readyForSignoff ? "Sign off graduation" : `Needs ${Math.max(0, p.required - p.cleanSessions)} more`}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
      </div>
      <ReasonDialog
        open={!!dlg}
        onClose={() => setDlg(null)}
        title={dlg?.kind === "suspended" ? "Suspend supervisor" : dlg?.kind === "graduate" ? "Sign off graduation" : "Reject application"}
        description={dlg?.kind === "graduate" ? "Grants the Tier 2 badge. The student sees your note." : "They'll see this reason."}
        confirmLabel={dlg?.kind === "suspended" ? "Suspend" : dlg?.kind === "graduate" ? "Graduate" : "Reject"}
        tone={dlg?.kind === "graduate" ? "default" : "danger"}
        placeholder={dlg?.kind === "graduate" ? "e.g. Three clean sessions with careful setup each time." : undefined}
        onConfirm={async (reason) => {
          if (!dlg) return;
          const r = dlg.kind === "graduate" ? await api.graduateStudent(dlg.g.userId, dlg.g.resource.id, reason) : await api.decideSupervisor(dlg.id, dlg.kind, reason);
          if (!r.ok) {
            toast.error("Not saved", r.error);
            return false;
          }
          toast.success(dlg.kind === "graduate" ? "Graduated to Tier 2" : "Saved with reason");
        }}
      />
    </RequireHat>
  );
}
