"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";
import { FileUpIcon, LockIcon } from "lucide-react";
import { EmptyState, ErrorBlock, LoadingBlock, makeDemoPhoto, Notice, PageHeader, Section, buttonVariants } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, USE_MOCKS } from "@/lib/screens";
import { useQuery } from "@/lib/screens/use-query";
import { fmtDateTime } from "@/lib/utils";

/** A's certificates bucket: PDF or image, up to 10 MB. */
const CERT_ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";
const MAX = 10 * 1024 * 1024;

export default function CertificateUploadPage() {
  const { resourceId } = useParams<{ resourceId: string }>();
  const toast = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const res = useQuery(() => api.getResource(resourceId), [resourceId]);
  const badge = useQuery(() => api.getCertificateBadge(resourceId), [resourceId]);
  const mine = useQuery(() => api.listMyBadges(), []);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (res.error) return <ErrorBlock message={res.error} onRetry={res.reload} />;
  if (!res.data || badge.loading) return <LoadingBlock />;
  const r = res.data;
  const b = badge.data;
  if (!b) {
    return (
      <EmptyState
        title="No certificate needed here"
        body={`${r.name} doesn't take certificates. Check the resource page for what you need.`}
        action={
          <Link href={`/resources/${r.id}`} className={buttonVariants({ variant: "outline" })}>
            Back to {r.name}
          </Link>
        }
      />
    );
  }
  const shown = (mine.data ?? []).filter((x) => x.badgeId === b.badgeId).sort((x, y) => y.submittedAt.localeCompare(x.submittedAt))[0] ?? null;
  const pending = shown?.status === "pending";
  const approved = shown?.status === "approved";
  const needsQuiz = r.eligibility?.status === "needs_quiz";

  const send = async () => {
    setErr(null);
    let f = file;
    if (!f && USE_MOCKS) f = await makeDemoPhoto(`Certificate · ${r.name}`);
    if (!f) return setErr("Choose your certificate file first.");
    setBusy(true);
    const out = await api.submitCertificate(b.badgeId, f);
    setBusy(false);
    if (!out.ok) {
      setErr(out.error);
      return toast.error("Not sent", out.error);
    }
    setFile(null);
    toast.success("Sent for review", "The lab manager approves it, or rejects it with a reason.");
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader back={{ href: `/resources/${r.id}`, label: r.name }} eyebrow="Tier 2 · certificate" title={b.name} description={b.description ?? `For independent use of the ${r.name}. The lab manager checks it and approves the badge.`} />
      <div className="grid gap-6">
        {needsQuiz && (
          <Notice tone="warn">
            Pass the Tier 1 safety quiz first.{" "}
            <Link href={`/quiz/${r.id}`} className="font-semibold underline">
              Take the quiz
            </Link>
          </Notice>
        )}
        {shown && (
          <Section title="Review status" aside={<Badge tone={approved ? "mint" : shown.status === "rejected" ? "coral" : "sun"}>{pending ? "Waiting for manager" : shown.status}</Badge>}>
            <p className="text-sm">
              Sent {fmtDateTime(shown.submittedAt)}
              {shown.grantedAt && <> · approved {fmtDateTime(shown.grantedAt)}</>}
            </p>
            {shown.reason && <p className="mt-3 rounded-lg bg-paper-2 px-3 py-2 text-sm">Manager: “{shown.reason}”</p>}
            {approved && (
              <Link href={`/book/${r.id}`} className={buttonVariants({ className: "mt-4" })}>
                Request a slot
              </Link>
            )}
          </Section>
        )}
        {!approved && !pending && (
          <Section title={shown ? "Send a new certificate" : "Your certificate"}>
            <button type="button" onClick={() => ref.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-ink bg-white/70 px-4 py-8 text-center hover:bg-white">
              <FileUpIcon className="size-8" />
              <span className="font-semibold">{file ? file.name : "Choose a PDF or photo"}</span>
              <span className="text-[13px] text-mute">PDF, JPG, PNG or WebP, up to 10 MB</span>
            </button>
            <input
              ref={ref}
              type="file"
              accept={CERT_ACCEPT}
              className="sr-only"
              aria-label="Certificate file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                if (!CERT_ACCEPT.split(",").includes(f.type)) return setErr("Use a PDF, JPG, PNG or WebP file.");
                if (f.size > MAX) return setErr("That file is over 10 MB.");
                setErr(null);
                setFile(f);
              }}
            />
            {err && (
              <p role="alert" className="mt-2 text-[13px] font-medium text-red-ink">
                {err}
              </p>
            )}
            <p className="mt-3 flex items-center gap-2 text-[13px] text-mute">
              <LockIcon className="size-4" /> Stored privately. Only the reviewing lab manager can open it.
            </p>
            <Button className="mt-4" loading={busy} disabled={needsQuiz || (!file && !USE_MOCKS)} onClick={send}>
              {file || !USE_MOCKS ? "Send for review" : "Send a demo certificate"}
            </Button>
          </Section>
        )}
      </div>
    </div>
  );
}
