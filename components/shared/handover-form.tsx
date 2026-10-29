"use client";

// Condition report for check-in and return (API.md "Check-in, return and condition reports"):
// upload photos with uploadEvidencePhoto → saveConditionReport(stage, checklist, photoPaths, notes).
// The checklist has one { item, ok, note? } per item of the resource's checklist, in the same order.

import { useId, useState } from "react";
import { Notice, PhotoUpload, type PickedPhoto } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/screens";
import type { Booking, ChecklistAnswer, ReportStage } from "@/lib/screens/types";
import { cn } from "@/lib/utils";

export function HandoverReportForm({ booking, stage, onSaved, step = 1 }: { booking: Booking; stage: ReportStage; onSaved: (reportId: string) => void; step?: number }) {
  const toast = useToast();
  const nid = useId();
  const items = booking.resource.checklist;
  const [marks, setMarks] = useState<Record<number, { ok?: boolean; note: string }>>({});
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const answered = items.every((_, i) => marks[i]?.ok !== undefined);
  const issues = items.filter((_, i) => marks[i]?.ok === false);

  const submit = async () => {
    if (!answered) return setErr("Mark every checklist item as OK or Issue.");
    if (!photos.length) return setErr("Add at least one photo.");
    if (issues.length && !notes.trim() && items.every((_, i) => marks[i]?.ok !== false || !marks[i]?.note.trim())) {
      return setErr("You marked an issue. Say what's wrong in the item's note or in the notes below.");
    }
    setErr(null);
    const paths: string[] = [];
    for (let i = 0; i < photos.length; i++) {
      setBusy(`Uploading photo ${i + 1} of ${photos.length}…`);
      const up = await api.uploadEvidencePhoto(booking.id, photos[i].file);
      if (!up.ok) {
        setBusy(null);
        setErr(up.error);
        return;
      }
      paths.push(up.data.path);
    }
    setBusy("Saving report…");
    const checklist: ChecklistAnswer[] = items.map((item, i) => ({ item, ok: Boolean(marks[i]?.ok), ...(marks[i]?.note.trim() ? { note: marks[i].note.trim() } : {}) }));
    const r = await api.saveConditionReport(booking.id, stage, checklist, paths, notes.trim() || undefined);
    setBusy(null);
    if (!r.ok) {
      setErr(r.error);
      toast.error("Report not saved", r.error);
      return;
    }
    toast.success(stage === "check_in" ? "Check-in report saved" : "Return report saved");
    onSaved(r.data.reportId);
  };

  return (
    <div className="grid gap-5">
      <div className="paper p-5">
        <p className="text-[12px] font-bold uppercase tracking-[0.1em]">Step {step} · Condition checklist</p>
        <p className="mb-3 mt-1 text-[13px] text-mute">{stage === "check_in" ? "Anything already wrong? Mark it now so it's on record before you start." : "How are you leaving it?"}</p>
        {items.length === 0 ? (
          <p className="text-sm text-mute">This resource has no checklist items. Add a photo below.</p>
        ) : (
          <fieldset className="grid gap-2">
            <legend className="sr-only">Condition checklist</legend>
            {items.map((item, i) => {
              const v = marks[i]?.ok;
              const lid = `${nid}-i${i}`;
              return (
                <div key={item} className="rounded-xl border-[1.5px] border-ink bg-paper px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium" id={lid}>
                      {item}
                    </span>
                    <div className="flex gap-1.5" role="radiogroup" aria-labelledby={lid}>
                      <button type="button" role="radio" aria-checked={v === true} onClick={() => setMarks({ ...marks, [i]: { ok: true, note: marks[i]?.note ?? "" } })} className={cn("h-8 rounded-full border-[1.5px] border-ink px-3 text-[13px] font-semibold", v === true ? "bg-mint" : "bg-white hover:bg-mint/40")}>
                        ✓ OK
                      </button>
                      <button type="button" role="radio" aria-checked={v === false} onClick={() => setMarks({ ...marks, [i]: { ok: false, note: marks[i]?.note ?? "" } })} className={cn("h-8 rounded-full border-[1.5px] border-ink px-3 text-[13px] font-semibold", v === false ? "bg-coral" : "bg-white hover:bg-coral/40")}>
                        ✕ Issue
                      </button>
                    </div>
                  </div>
                  {v === false && (
                    <Input value={marks[i]?.note ?? ""} onChange={(e) => setMarks({ ...marks, [i]: { ok: false, note: e.target.value } })} placeholder="What's wrong?" aria-label={`Note for ${item}`} className="mt-2 h-9" />
                  )}
                </div>
              );
            })}
          </fieldset>
        )}
      </div>
      <div className="paper grid gap-4 p-5">
        <p className="text-[12px] font-bold uppercase tracking-[0.1em]">Step {step + 1} · Photo and notes</p>
        <PhotoUpload value={photos} onChange={setPhotos} demoLabel={`${booking.resource.name} · ${stage === "check_in" ? "check-in" : "return"}`} label={stage === "check_in" ? "Photo as you found it" : "Photo as you're leaving it"} />
        <Field id={nid} label="Notes (optional)">
          <Textarea id={nid} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the next person or the manager should know" />
        </Field>
      </div>
      {issues.length > 0 && stage === "return" && <Notice tone="warn">You marked {issues.length} issue{issues.length > 1 ? "s" : ""}. After returning, you can also report an incident so the manager reviews it.</Notice>}
      {booking.supervisorId && <Notice>Your supervisor, {booking.supervisorName ?? "the supervisor"}, co-signs this report on their phone. Saving it again later clears their signature.</Notice>}
      {err && (
        <p role="alert" className="rounded-xl border-2 border-ink bg-coral px-4 py-2.5 text-sm font-medium">
          {err}
        </p>
      )}
      <Button size="lg" className="w-full" loading={!!busy} onClick={submit}>
        {busy ?? `Save ${stage === "check_in" ? "check-in" : "return"} report`}
      </Button>
    </div>
  );
}
