"use client";

// One condition report (check-in or return): photos from the private condition-photos
// bucket (signed URLs via getConditionPhotoUrl), the checklist answers, notes and signatures.

import { ChecklistResult, StoredPhoto } from "@/components/shared";
import { api } from "@/lib/screens";
import type { ConditionReport } from "@/lib/screens/types";
import { useQuery } from "@/lib/screens/use-query";
import { fmtDateTime } from "@/lib/utils";

export function usePhotoUrls(paths: string[]) {
  const key = paths.join("|");
  return useQuery(() => (paths.length ? api.getConditionPhotoUrls(paths) : Promise.resolve({} as Record<string, string>)), [key]).data ?? {};
}

export function PhotoStrip({ paths, alt }: { paths: string[]; alt: string }) {
  const urls = usePhotoUrls(paths);
  if (!paths.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {paths.map((p, i) => (
        <div key={p} className="overflow-hidden rounded-lg border-2 border-ink">
          <StoredPhoto url={urls[p]} alt={`${alt} ${i + 1}`} className="aspect-[4/3]" />
        </div>
      ))}
    </div>
  );
}

export function ReportCard({ title, rep, names = {} }: { title: string; rep?: ConditionReport; names?: Record<string, string> }) {
  const urls = usePhotoUrls(rep?.photoPaths ?? []);
  return (
    <div className="paper-inset p-3">
      <p className="text-[12px] font-bold uppercase tracking-[0.1em]">{title}</p>
      {rep ? (
        <>
          <div className="mt-2 grid grid-cols-1 gap-2">
            {rep.photoPaths.slice(0, 1).map((p) => (
              <div key={p} className="overflow-hidden rounded-lg border-2 border-ink">
                <StoredPhoto url={urls[p]} alt={`${title} photo`} className="aspect-[16/10]" />
              </div>
            ))}
            {rep.photoPaths.length > 1 && (
              <div className="grid grid-cols-3 gap-2">
                {rep.photoPaths.slice(1).map((p, i) => (
                  <div key={p} className="overflow-hidden rounded-md border-[1.5px] border-ink">
                    <StoredPhoto url={urls[p]} alt={`${title} photo ${i + 2}`} className="aspect-square" />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="mt-3">
            <ChecklistResult items={rep.checklist} />
          </div>
          {rep.notes && <p className="mt-2 rounded-lg bg-paper-2 px-2 py-1 text-[13px]">“{rep.notes}”</p>}
          <p className="mt-2 text-[12px] text-mute">
            {fmtDateTime(rep.updatedAt)}
            {rep.signedBy.length > 0 && <> · signed by {rep.signedBy.map((s) => names[s] ?? "Lab staff").join(" + ")}</>}
          </p>
        </>
      ) : (
        <p className="mt-6 pb-4 text-center text-[13px] text-mute">Not recorded yet</p>
      )}
    </div>
  );
}

/** The latest report of each stage. */
export function latestReports(reports: ConditionReport[]) {
  const pick = (s: ConditionReport["stage"]) => reports.filter((r) => r.stage === s).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  return { checkIn: pick("check_in"), ret: pick("return") };
}
