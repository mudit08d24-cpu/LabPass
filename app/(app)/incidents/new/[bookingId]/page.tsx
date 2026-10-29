"use client";

import { useParams, useRouter } from "next/navigation";
import { useId, useState } from "react";
import { ErrorBlock, LoadingBlock, Notice, PageHeader, PhotoUpload, SlotText, type PickedPhoto } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api, type IncidentType } from "@/lib/screens";
import { useQuery } from "@/lib/screens/use-query";
import { cn } from "@/lib/utils";

const TYPES: { v: IncidentType; l: string; d: string }[] = [
  { v: "damage", l: "Damage", d: "Something is broken, scratched or not working" },
  { v: "missing_item", l: "Missing item", d: "An accessory or part isn't there" },
  { v: "delay", l: "Delay", d: "Late return or the slot couldn't start on time" },
  { v: "other", l: "Other", d: "Safety concern or anything else" },
];

export default function ReportIncidentPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const router = useRouter();
  const toast = useToast();
  const did = useId();
  const { data, error, loading, reload } = useQuery(() => api.getBooking(bookingId), [bookingId]);
  const [type, setType] = useState<IncidentType>("damage");
  const [desc, setDesc] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (error) return <ErrorBlock message={error} onRetry={reload} />;
  if (loading || !data) return <LoadingBlock />;
  const b = data.booking;
  const allowed = ["checked_in", "overdue", "returned", "completed"].includes(b.status);

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader back={{ href: `/bookings/${b.id}`, label: "Booking" }} eyebrow="report an issue" title={b.resource.name} description={<SlotText start={b.start} end={b.end} />} />
      {!allowed ? (
        <Notice tone="warn">Issues can be reported once a booking is checked in, overdue, returned or completed.</Notice>
      ) : (
        <form
          className="grid gap-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (desc.trim().length < 10) return setErr("Describe what happened in a sentence or two.");
            setErr(null);
            const paths: string[] = [];
            for (let i = 0; i < photos.length; i++) {
              setBusy(`Uploading photo ${i + 1} of ${photos.length}…`);
              const up = await api.uploadEvidencePhoto(b.id, photos[i].file);
              if (!up.ok) {
                setBusy(null);
                return setErr(up.error);
              }
              paths.push(up.data.path);
            }
            setBusy("Sending…");
            const res = await api.openIncident(b.id, type, desc.trim(), paths);
            setBusy(null);
            if (!res.ok) return setErr(res.error);
            toast.success("Issue reported", "The lab manager will review it with the check-in and return records.");
            router.push(`/incidents/${res.data.incidentId}`);
          }}
        >
          <div className="paper p-5">
            <fieldset>
              <legend className="text-sm font-semibold">What kind of issue?</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup">
                {TYPES.map((t) => (
                  <button key={t.v} type="button" role="radio" aria-checked={type === t.v} onClick={() => setType(t.v)} className={cn("rounded-xl border-2 border-ink px-3 py-2.5 text-left", type === t.v ? "bg-ink text-paper" : "bg-white hover:bg-sun-soft")}>
                    <span className="block text-sm font-semibold">{t.l}</span>
                    <span className={cn("block text-[12px]", type === t.v ? "text-paper/70" : "text-mute")}>{t.d}</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          <div className="paper grid gap-4 p-5">
            <Field id={did} label="What happened?" error={err}>
              <Textarea id={did} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Where is the problem, when did you notice it, and was it there at check-in?" aria-invalid={!!err} />
            </Field>
            <PhotoUpload value={photos} onChange={setPhotos} demoLabel={`${b.resource.name} · issue`} label="Photos of the problem (optional)" />
          </div>
          <Notice>The check-in and return reports are already on record. Nothing is decided automatically: the lab manager reviews it and gives a reason, and the student can respond or dispute.</Notice>
          <Button type="submit" size="lg" loading={!!busy}>
            {busy ?? "Send report"}
          </Button>
        </form>
      )}
    </div>
  );
}
