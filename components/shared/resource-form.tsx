"use client";

import { useId, useRef, useState } from "react";
import { z } from "zod";
import { ImagePlusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { ResourceArt } from "@/components/art/resource-art";
import { PHOTO_ACCEPT, Section } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/screens";
import { artFor } from "@/lib/screens/format";
import type { Department, ResourceDraft } from "@/lib/screens/types";
import { cn, WEEKDAYS } from "@/lib/utils";

const TIERS = [
  { n: 0, name: "Tier 0", need: "Any verified student" },
  { n: 1, name: "Tier 1", need: "Pass the 5-question safety quiz" },
  { n: 2, name: "Tier 2", need: "Certificate + manager sign-off, or graduate from Tier 3" },
  { n: 3, name: "Tier 3", need: "Supervised use only (staff or peer supervisor)" },
];

const schema = z
  .object({
    name: z.string().trim().min(1, "Give it a name students will recognise").max(160),
    location: z.string().trim().min(3, "Where is it? Building, room, bench"),
    departmentId: z.string().min(1, "Pick a department"),
    managerId: z.string().min(1, "Pick the lab manager who approves requests"),
    maxHours: z.number().positive("Must be more than 0").max(24),
    weeklyCapHours: z.number().positive("Must be more than 0"),
    depositAmount: z.number().min(0),
    checklist: z.array(z.string().trim().min(2)).min(1, "Add at least one checklist item"),
    slots: z.array(z.object({ weekday: z.number(), start: z.string(), end: z.string() })).min(1, "Open at least one day"),
  })
  .refine((v) => v.weeklyCapHours >= v.maxHours, { message: "Weekly cap must be at least the max per booking", path: ["weeklyCapHours"] })
  .refine((v) => v.slots.every((s) => s.end > s.start), { message: "Each day's closing time must be after opening", path: ["slots"] });

export function ResourceForm({ initial, departments, managers, onSubmit, submitLabel, photoUrl }: { initial: ResourceDraft; departments: Department[]; managers: { id: string; name: string }[]; onSubmit: (v: ResourceDraft) => Promise<void>; submitLabel: string; photoUrl?: string | null }) {
  const [v, setV] = useState<ResourceDraft>(initial);
  const [newItem, setNewItem] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(photoUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const id = useId();
  const f = (k: string) => `${id}-${k}`;
  const set = <K extends keyof ResourceDraft>(k: K, val: ResourceDraft[K]) => setV({ ...v, [k]: val });

  const toggleDay = (wd: number) => {
    const has = v.slots.find((s) => s.weekday === wd);
    set("slots", has ? v.slots.filter((s) => s.weekday !== wd) : [...v.slots, { weekday: wd, start: "08:00", end: "20:00" }].sort((a, b) => a.weekday - b.weekday));
  };
  const addItem = () => {
    if (newItem.trim()) {
      set("checklist", [...v.checklist, newItem.trim()]);
      setNewItem("");
    }
  };

  return (
    <form
      noValidate
      className="grid gap-6 lg:grid-cols-[1.4fr_1fr]"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = schema.safeParse(v);
        if (!r.success) {
          setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
          return;
        }
        setErrors({});
        setBusy(true);
        await onSubmit(v);
        setBusy(false);
      }}
    >
      <div className="grid content-start gap-6">
        <Section title="Basics">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={f("name")} label="Name" error={errors.name} className="sm:col-span-2">
              <Input id={f("name")} value={v.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Oscilloscope" aria-invalid={!!errors.name} />
            </Field>
            <Field id={f("type")} label="Type">
              <Select id={f("type")} value={v.type} onChange={(e) => set("type", e.target.value as ResourceDraft["type"])}>
                <option value="space">Space (room, lab)</option>
                <option value="equipment">Equipment</option>
                <option value="specialised">Specialised machine</option>
              </Select>
            </Field>
            <Field id={f("dept")} label="Department" error={errors.departmentId}>
              <Select id={f("dept")} value={v.departmentId} onChange={(e) => set("departmentId", e.target.value)} aria-invalid={!!errors.departmentId}>
                <option value="">Choose…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id={f("mgr")} label="Lab manager" hint="Approves requests and confirms returns" error={errors.managerId} className="sm:col-span-2">
              <Select id={f("mgr")} value={v.managerId} onChange={(e) => set("managerId", e.target.value)} aria-invalid={!!errors.managerId}>
                <option value="">Choose…</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id={f("loc")} label="Location" error={errors.location} className="sm:col-span-2">
              <Input id={f("loc")} value={v.location} onChange={(e) => set("location", e.target.value)} placeholder="Building, room, bench number" aria-invalid={!!errors.location} />
            </Field>
          </div>
        </Section>

        <Section title="Who can use it">
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Tier">
            {TIERS.map((t) => (
              <button key={t.n} type="button" role="radio" aria-checked={v.tier === t.n} onClick={() => set("tier", t.n)} className={cn("rounded-xl border-2 border-ink px-3 py-2.5 text-left", v.tier === t.n ? "bg-ink text-paper" : "bg-white hover:bg-sun-soft")}>
                <span className="block font-display font-bold">{t.name}</span>
                <span className={cn("block text-[12px]", v.tier === t.n ? "text-paper/70" : "text-mute")}>{t.need}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <Field id={f("max")} label="Max hours / booking" error={errors.maxHours}>
              <Input id={f("max")} type="number" min={0.5} step={0.5} max={24} value={v.maxHours} onChange={(e) => set("maxHours", +e.target.value)} />
            </Field>
            <Field id={f("cap")} label="Weekly cap (hours)" hint="Per student" error={errors.weeklyCapHours}>
              <Input id={f("cap")} type="number" min={1} value={v.weeklyCapHours} onChange={(e) => set("weeklyCapHours", +e.target.value)} aria-invalid={!!errors.weeklyCapHours} />
            </Field>
            <Field id={f("dep")} label="Deposit ₹ (simulated)" hint="Shown, never charged">
              <Input id={f("dep")} type="number" min={0} step={100} value={v.depositAmount} onChange={(e) => set("depositAmount", +e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title="Open hours (India time)" aside={errors.slots && <span className="text-[13px] font-medium text-red-ink">{errors.slots}</span>}>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((d, i) => {
              const on = v.slots.some((s) => s.weekday === i);
              return (
                <button key={d} type="button" aria-pressed={on} onClick={() => toggleDay(i)} className={cn("h-9 w-12 rounded-full border-2 border-ink text-[13px] font-semibold", on ? "bg-ink text-sun" : "bg-white")}>
                  {d}
                </button>
              );
            })}
          </div>
          <ul className="mt-4 grid gap-2">
            {v.slots.map((s, i) => (
              <li key={`${s.weekday}-${i}`} className="flex flex-wrap items-center gap-2">
                <span className="w-12 text-sm font-semibold">{WEEKDAYS[s.weekday]}</span>
                <Input type="time" value={s.start} onChange={(e) => set("slots", v.slots.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} className="h-9 w-32" aria-label={`${WEEKDAYS[s.weekday]} opens`} />
                <span>to</span>
                <Input type="time" value={s.end} onChange={(e) => set("slots", v.slots.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} className="h-9 w-32" aria-label={`${WEEKDAYS[s.weekday]} closes`} />
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <div className="grid content-start gap-6">
        <Section title="Photo">
          <div className="overflow-hidden rounded-xl border-2 border-ink">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt={v.name || "Resource photo"} className="aspect-[16/10] w-full object-cover" />
            ) : (
              <ResourceArt kind={artFor(v.name, v.type)} bg="sun" label="Listing illustration" />
            )}
          </div>
          {v.id ? (
            <>
              <Button type="button" variant="outline" size="sm" className="mt-3" loading={uploading} onClick={() => fileRef.current?.click()}>
                <ImagePlusIcon /> Upload a photo
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept={PHOTO_ACCEPT}
                className="sr-only"
                aria-label="Resource photo"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  const r = await api.uploadResourcePhoto(v.id!, file);
                  setUploading(false);
                  if (!r.ok) toast.error("Photo not uploaded", r.error);
                  else {
                    setPhoto(r.data.url);
                    toast.success("Photo added");
                  }
                }}
              />
            </>
          ) : (
            <p className="mt-3 text-[13px] text-mute">Save the listing first, then add photos. Until then students see this drawing.</p>
          )}
        </Section>
        <Section title="Handover checklist" aside={errors.checklist && <span className="text-[13px] font-medium text-red-ink">{errors.checklist}</span>}>
          <p className="mb-3 text-[13px] text-mute">Students tick these at check-in and return.</p>
          <ul className="grid gap-2">
            {v.checklist.map((c, i) => (
              <li key={c + i} className="flex items-center gap-2 rounded-xl border-[1.5px] border-ink bg-white px-3 py-1.5">
                <span className="flex-1 text-sm">{c}</span>
                <button type="button" onClick={() => set("checklist", v.checklist.filter((_, j) => j !== i))} className="grid size-7 place-items-center rounded-full hover:bg-coral" aria-label={`Remove ${c}`}>
                  <Trash2Icon className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <Input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="e.g. Four probes in the tray"
              aria-label="New checklist item"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addItem();
                }
              }}
            />
            <Button type="button" variant="outline" size="icon" aria-label="Add item" onClick={addItem}>
              <PlusIcon />
            </Button>
          </div>
        </Section>
        <Button type="submit" size="lg" loading={busy}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
