"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { z } from "zod";
import { MailCheckIcon } from "lucide-react";
import { LogoMark } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/screens";
import { useSession } from "@/lib/screens/session";

const schema = z.object({
  name: z.string().trim().min(2, "Enter your full name"),
  email: z.string().trim().email("Enter a valid email"),
  rollNo: z.string().trim().min(3, "Enter the roll number on your ID card").max(32),
  password: z.string().min(8, "At least 8 characters"),
});

export default function SignupPage() {
  const ids = { name: useId(), email: useId(), roll: useId(), pw: useId() };
  const [v, setV] = useState({ name: "", email: "", rollNo: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { refresh } = useSession();
  const router = useRouter();
  const toast = useToast();
  const set = (k: keyof typeof v) => (e: { target: { value: string } }) => setV({ ...v, [k]: e.target.value });

  if (sentTo) {
    return (
      <div className="paper w-full max-w-md p-6 text-center shadow-pop-lg sm:p-7">
        <span className="mx-auto grid size-14 place-items-center rounded-full border-2 border-ink bg-sun">
          <MailCheckIcon className="size-6" />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold">Check your inbox</h1>
        <p className="mt-2 text-sm text-ink/80">
          We sent a confirmation link to <span className="font-semibold">{sentTo}</span>. Open it on this device to finish your pass.
        </p>
        <p className="mt-3 text-[13px] text-mute">Your department is set by the admin desk after you confirm.</p>
        <Link href="/login" className="mt-5 inline-flex h-10 items-center rounded-full border-2 border-ink bg-paper px-5 text-sm font-semibold hover:bg-white">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="paper w-full max-w-md p-6 shadow-pop-lg sm:p-7">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 font-display text-[13px] font-extrabold tracking-[0.12em]">
          <LogoMark className="h-4" /> LABPASS
        </span>
        <span className="rounded-full bg-ink px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sun">New pass</span>
      </div>
      <h1 className="mt-4 text-3xl font-extrabold">Get your pass</h1>
      <p className="mt-1 text-sm text-mute">We only keep your name, roll number, email, department and badges.</p>
      <form
        className="mt-5 grid gap-4"
        noValidate
        onSubmit={async (e) => {
          e.preventDefault();
          const r = schema.safeParse(v);
          if (!r.success) {
            setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
            return;
          }
          setErrors({});
          setBusy(true);
          const res = await api.signUp({ ...r.data, rollNo: r.data.rollNo.toUpperCase() });
          setBusy(false);
          if (!res.ok) {
            setErrors({ email: res.error });
            return;
          }
          if (res.data.needsConfirmation) {
            setSentTo(r.data.email);
            return;
          }
          await refresh();
          toast.success("Pass created", "Start with a resource you can book today, or take a quiz.");
          router.push("/browse");
        }}
      >
        <Field id={ids.name} label="Full name" error={errors.name}>
          <Input id={ids.name} autoComplete="name" value={v.name} onChange={set("name")} aria-invalid={!!errors.name} />
        </Field>
        <Field id={ids.email} label="College email" error={errors.email}>
          <Input id={ids.email} type="email" autoComplete="email" placeholder="you@college.edu" value={v.email} onChange={set("email")} aria-invalid={!!errors.email} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={ids.roll} label="Roll number" error={errors.rollNo}>
            <Input id={ids.roll} placeholder="CSE21001" value={v.rollNo} onChange={set("rollNo")} aria-invalid={!!errors.rollNo} className="uppercase" />
          </Field>
          <Field id={ids.pw} label="Password" error={errors.password}>
            <Input id={ids.pw} type="password" autoComplete="new-password" value={v.password} onChange={set("password")} aria-invalid={!!errors.password} />
          </Field>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Create my pass
        </Button>
      </form>
      <p className="mt-5 border-t-2 border-dashed border-ink/25 pt-4 text-center text-[13px]">
        Already have one?{" "}
        <Link href="/login" className="font-semibold underline decoration-2 underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  );
}
