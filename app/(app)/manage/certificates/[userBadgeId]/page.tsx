"use client";

// LINKS.certificateReview = /manage/certificates/<user_badge_id>.
// The file is private: getCertificateUrl(path) returns a short-lived link.

import { useParams } from "next/navigation";
import { useState } from "react";
import { CheckIcon, ExternalLinkIcon, XIcon } from "lucide-react";
import { RequireHat } from "@/components/layout/app-shell";
import { AiSuggestion, ErrorBlock, LoadingBlock, Notice, PageHeader, ReasonDialog, Section } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/screens";
import { useQuery } from "@/lib/screens/use-query";
import { fmtDateTime } from "@/lib/utils";

function label(k: string) {
  return k.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export default function CertificateReviewPage() {
  const { userBadgeId } = useParams<{ userBadgeId: string }>();
  const toast = useToast();
  const { data: c, error, loading, reload } = useQuery(() => api.getCertificateSubmission(userBadgeId), [userBadgeId]);
  const { data: url, loading: urlLoading } = useQuery(() => (c?.path ? api.getCertificateUrl(c.path) : Promise.resolve(null)), [c?.path]);
  const [reject, setReject] = useState(false);
  const [busy, setBusy] = useState(false);
  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (loading || !c) return <LoadingBlock rows={3} />;
  const isPdf = c.path?.toLowerCase().endsWith(".pdf");
  const ai = c.aiExtraction ? Object.entries(c.aiExtraction).filter(([k, v]) => k !== "note" && v !== null && v !== "") : [];
  const note = c.aiExtraction && typeof c.aiExtraction.note === "string" ? c.aiExtraction.note : null;

  return (
    <RequireHat hats={["manager", "owner", "admin"]}>
      <PageHeader back={{ href: "/manage/certificates", label: "Certificates" }} eyebrow="Tier 2 · certificate" title={`${c.userName ?? "Student"} · ${c.resourceName}`} description={`Sent ${fmtDateTime(c.submittedAt)}`} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Section title="Certificate" aside={url && <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-semibold underline"><ExternalLinkIcon className="size-3.5" /> Open in new tab</a>}>
          {urlLoading ? (
            <LoadingBlock rows={2} />
          ) : !url ? (
            <p className="rounded-xl border-2 border-dashed border-ink/40 px-3 py-10 text-center text-sm text-mute">The file can&apos;t be previewed here. {c.path ? "It may have been removed." : "No file was attached."}</p>
          ) : isPdf ? (
            <iframe src={url} title="Certificate PDF" className="h-[70vh] w-full rounded-xl border-2 border-ink bg-white" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={`Certificate from ${c.userName ?? "student"}`} className="w-full rounded-xl border-2 border-ink bg-white object-contain" />
          )}
        </Section>
        <div className="grid content-start gap-6">
          <Section title="Student">
            <div className="flex items-center gap-3">
              <Avatar name={c.userName ?? "Student"} />
              <div>
                <p className="font-semibold">{c.userName ?? "Student"}</p>
                {c.userRollNo && <p className="text-[12px] text-mute">{c.userRollNo}</p>}
              </div>
            </div>
          </Section>
          {ai.length > 0 && (
            <AiSuggestion loading={false} title="Read from the certificate">
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                {ai.map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-ink/70">{label(k)}</dt>
                    <dd className="font-semibold">{String(v)}</dd>
                  </div>
                ))}
              </dl>
              {note && <p className="mt-2 border-t-2 border-dashed border-ink/30 pt-2 text-[13px]">{note}</p>}
            </AiSuggestion>
          )}
          <div className="paper p-5">
            <p className="text-[12px] font-bold uppercase tracking-[0.1em]">Your decision</p>
            {c.status === "pending" ? (
              <div className="mt-3 grid gap-2">
                <Button
                  size="lg"
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    const r = await api.decideCertificate(c.userBadgeId, "approved");
                    setBusy(false);
                    if (!r.ok) toast.error("Not approved", r.error);
                    else toast.success("Tier 2 badge granted", `${c.userName ?? "The student"} can now book the ${c.resourceName} alone.`);
                  }}
                >
                  <CheckIcon /> Approve badge
                </Button>
                <Button size="lg" variant="danger" onClick={() => setReject(true)}>
                  <XIcon /> Reject
                </Button>
              </div>
            ) : (
              <div className="mt-3 grid gap-2">
                <Badge tone={c.status === "approved" ? "mint" : "coral"}>{c.status}</Badge>
                {c.reason && <Notice>“{c.reason}”</Notice>}
              </div>
            )}
          </div>
        </div>
      </div>
      <ReasonDialog
        open={reject}
        onClose={() => setReject(false)}
        title="Reject certificate"
        confirmLabel="Reject"
        tone="danger"
        placeholder="e.g. This course doesn't cover the laser cutter. Book supervised sessions to graduate instead."
        onConfirm={async (reason) => {
          const r = await api.decideCertificate(c.userBadgeId, "rejected", reason);
          if (!r.ok) {
            toast.error("Not rejected", r.error);
            return false;
          }
          toast.success("Rejected with reason");
        }}
      />
    </RequireHat>
  );
}
