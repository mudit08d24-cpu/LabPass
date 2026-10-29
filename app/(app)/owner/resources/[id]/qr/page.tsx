"use client";

// The printable check-in QR (getResourceQr). The QR holds <APP_URL>/check-in?code=…;
// the 8-character code is printed under it for typing in.

import { useParams } from "next/navigation";
import { useState } from "react";
import { DownloadIcon, PrinterIcon, RefreshCwIcon } from "lucide-react";
import { RequireHat } from "@/components/layout/app-shell";
import { LogoMark } from "@/components/layout/logo";
import { ErrorBlock, LoadingBlock, MockQr, PageHeader, ReasonDialog } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { api, type QrInfo } from "@/lib/screens";
import { TIER_TEXT } from "@/lib/screens/format";
import { useQuery, useRules } from "@/lib/screens/use-query";

export default function QrPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const rules = useRules();
  const qr = useQuery(() => api.getResourceQr(id), [id]);
  const res = useQuery(() => api.getResource(id), [id]);
  const [rotated, setRotated] = useState<QrInfo | null>(null);
  const [confirm, setConfirm] = useState(false);
  if (qr.error || res.error) return <ErrorBlock message={qr.error ?? res.error ?? ""} onRetry={qr.reload} />;
  if (!qr.data || !res.data) return <LoadingBlock />;
  if (!qr.data.ok) return <ErrorBlock message={qr.data.error} />;
  const q = rotated ?? qr.data.data;
  const r = res.data;
  return (
    <RequireHat hats={["owner", "manager", "admin"]}>
      <div className="no-print">
        <PageHeader
          back={{ href: "/owner/resources", label: "Our resources" }}
          eyebrow="check-in QR"
          title={`QR for ${r.name}`}
          description="Print it and stick it on the resource. Students scan it, or type the code under it, to check in."
          actions={
            <>
              <Button onClick={() => window.print()}>
                <PrinterIcon /> Print
              </Button>
              {q.qrDataUrl && (
                <a href={q.qrDataUrl} download={`labpass-qr-${r.name.toLowerCase().replace(/\s+/g, "-")}.png`} className="inline-flex h-11 items-center gap-2 rounded-full border-2 border-ink bg-paper px-5 text-sm font-semibold hover:bg-white">
                  <DownloadIcon className="size-4" /> PNG
                </a>
              )}
              <Button variant="outline" onClick={() => setConfirm(true)}>
                <RefreshCwIcon /> New code
              </Button>
            </>
          }
        />
      </div>
      <div className="mx-auto w-full max-w-sm">
        <div className="paper bg-white p-6 text-center print:shadow-none">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 font-display text-[13px] font-extrabold tracking-[0.12em]">
              <LogoMark className="h-4" /> LABPASS
            </span>
            <span className="rounded-full bg-ink px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sun">{TIER_TEXT[r.tier]?.name}</span>
          </div>
          <p className="mt-4 font-display text-2xl font-extrabold leading-tight">{r.name}</p>
          {r.location && <p className="text-[13px] text-mute">{r.location}</p>}
          <div className="mx-auto mt-4 w-56 rounded-xl border-2 border-ink p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {q.qrDataUrl ? <img src={q.qrDataUrl} alt={`QR code for ${r.name}`} className="w-full" /> : <MockQr value={q.link} className="w-full" />}
          </div>
          <p className="mt-3 text-[12px] uppercase tracking-[0.1em] text-mute">or type this code</p>
          <p className="font-mono text-3xl font-bold tracking-[0.12em]">{q.code}</p>
          <p className="mt-4 border-t-2 border-dashed border-ink/30 pt-3 text-[12px]">Book first on LabPass · Check in within {rules?.checkin_grace_minutes ?? 15} minutes of your start</p>
        </div>
        <p className="no-print mt-3 break-all text-center text-[12px] text-mute">{q.link}</p>
      </div>
      <ReasonDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Make a new code?"
        description="The printed QR stops working straight away. Print and stick up the new one."
        confirmLabel="New code"
        tone="danger"
        placeholder="e.g. Old sticker was photographed and shared."
        onConfirm={async () => {
          const out = await api.rotateCheckinCode(id);
          if (!out.ok) {
            toast.error("Not changed", out.error);
            return false;
          }
          setRotated(out.data);
          toast.success("New code ready", "Print it now.");
        }}
      />
    </RequireHat>
  );
}
