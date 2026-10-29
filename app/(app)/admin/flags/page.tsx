"use client";

// Restrictions to review (LINKS.adminFlags). A raises a flag after repeated no-shows or an AI
// usage pattern; nothing is blocked until an admin confirms (decideUserFlag).

import { useId, useState } from "react";
import { SparklesIcon } from "lucide-react";
import { scanUsagePatterns } from "@/lib/actions/admin";
import { RequireHat } from "@/components/layout/app-shell";
import { AiSuggestion, Ago, EmptyState, ErrorBlock, LoadingBlock, PageHeader, ReasonDialog } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api, USE_MOCKS, type UserFlag } from "@/lib/screens";
import { useQuery, useRules } from "@/lib/screens/use-query";
import { fmtDateTime } from "@/lib/utils";

function label(k: string) {
  return k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function show(v: unknown): string {
  if (v === null || v === undefined) return "–";
  if (Array.isArray(v)) return v.map(show).join(", ");
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return fmtDateTime(v);
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function Evidence({ f }: { f: UserFlag }) {
  const entries = Object.entries(f.evidence ?? {});
  if (!entries.length) return <p className="text-sm text-mute">No details recorded.</p>;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink/70">{label(k)}</dt>
          <dd className="font-semibold">
            {Array.isArray(v) && v.every((x) => typeof x === "string") ? (
              <ul className="list-disc pl-5">
                {v.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            ) : (
              show(v)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function FlagsPage() {
  const toast = useToast();
  const rules = useRules();
  const did = useId();
  const { data, error, loading, reload } = useQuery(() => api.listPendingFlags(), []);
  const [dlg, setDlg] = useState<null | { f: UserFlag; confirm: boolean }>(null);
  const [days, setDays] = useState(7);
  const [scanning, setScanning] = useState(false);

  return (
    <RequireHat hats={["admin"]}>
      <PageHeader
        eyebrow="admin only"
        title="Restrictions to review"
        description={`Raised after ${rules?.no_show_flag_count ?? "–"} no-shows in ${rules?.no_show_window_days ?? "–"} days, or by an AI usage pattern. Nothing happens unless you confirm.`}
      />
      {!USE_MOCKS && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            loading={scanning}
            onClick={async () => {
              setScanning(true);
              const r = await scanUsagePatterns();
              setScanning(false);
              if (!r.ok) toast.error("Scan didn't run", r.error);
              else {
                toast.success(r.data.flagged ? `${r.data.flagged} new pattern flag${r.data.flagged === 1 ? "" : "s"}` : "No new patterns found", `${r.data.scanned} bookings checked from the last 30 days.`);
                reload();
              }
            }}
          >
            <SparklesIcon /> Scan usage patterns now
          </Button>
          <p className="text-[13px] text-mute">Also runs every 5 minutes. Looks for late cancellations, repeated overdue returns and one student holding most of a busy resource.</p>
        </div>
      )}
      {error ? (
        <ErrorBlock message={error} onRetry={reload} />
      ) : loading && !data ? (
        <LoadingBlock />
      ) : !data?.length ? (
        <EmptyState title="No flags to review" art="plant" />
      ) : (
        <ul className="grid gap-4">
          {data.map((f) => (
            <li key={f.id} className="paper p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={f.userName ?? "Student"} />
                <div className="flex-1">
                  <p className="font-semibold">{f.userName ?? "Student"}</p>
                  <p className="text-[12px] text-mute">
                    flagged <Ago iso={f.createdAt} />
                    {f.proposedBlockDays ? ` · proposes a ${f.proposedBlockDays}-day block` : ""}
                  </p>
                </div>
                <Badge tone={f.source === "ai_pattern" ? "lilac" : "sun"}>{f.source === "ai_pattern" ? "AI pattern" : "No-show rule"}</Badge>
              </div>
              <div className="mt-4">
                {f.source === "ai_pattern" ? (
                  <AiSuggestion loading={false} title="Usage pattern">
                    <Evidence f={f} />
                  </AiSuggestion>
                ) : (
                  <div className="paper-inset p-3">
                    <Evidence f={f} />
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="danger"
                  onClick={() => {
                    setDays(f.proposedBlockDays ?? rules?.no_show_block_days ?? 7);
                    setDlg({ f, confirm: true });
                  }}
                >
                  Confirm & restrict
                </Button>
                <Button variant="outline" onClick={() => setDlg({ f, confirm: false })}>
                  Dismiss
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ReasonDialog
        open={!!dlg}
        onClose={() => setDlg(null)}
        title={dlg?.confirm ? `Restrict ${dlg.f.userName ?? "this student"}` : "Dismiss flag"}
        description={dlg?.confirm ? "They can't make new bookings until the block ends. They see your reason." : "Nothing changes for the student."}
        confirmLabel={dlg?.confirm ? "Restrict booking" : "Dismiss"}
        tone={dlg?.confirm ? "danger" : "default"}
        extra={
          dlg?.confirm ? (
            <Field id={did} label="Block length (days)" hint="1 to 30 days">
              <Input id={did} type="number" min={1} max={30} value={days} onChange={(e) => setDays(Math.min(30, Math.max(1, Math.round(+e.target.value))))} />
            </Field>
          ) : undefined
        }
        onConfirm={async (reason) => {
          if (!dlg) return;
          const r = await api.decideUserFlag(dlg.f.id, dlg.confirm, reason, dlg.confirm ? days : undefined);
          if (!r.ok) {
            toast.error("Not saved", r.error);
            return false;
          }
          toast.success(dlg.confirm ? "Booking restricted" : "Flag dismissed");
        }}
      />
    </RequireHat>
  );
}
