"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { z } from "zod";
import { LogoMark } from "@/components/layout/logo";
import { Notice } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { api, USE_MOCKS } from "@/lib/screens";
import { DEMO_ACCOUNTS, mockSignInAs } from "@/lib/screens/mock";
import { homeFor, useSession } from "@/lib/screens/session";
import type { Me } from "@/lib/screens/types";

const schema = z.object({
  email: z.string().trim().email("Enter your college email"),
  password: z.string().min(1, "Enter your password"),
});

/** Optional shared password for A's demo accounts, so the demo buttons sign straight in on the live site. */
const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "";

/** Only follow ?next= inside the app. */
function safeNext(v: string | null) {
  return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
}

export default function LoginPage() {
  const { refresh } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [confirmFailed, setConfirmFailed] = useState(false);
  const eid = useId();
  const pid = useId();

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setNext(safeNext(q.get("next")));
    setConfirmFailed(q.get("error") === "confirm");
  }, []);

  const welcome = (me: Me) => {
    toast.success(`Welcome, ${me.name.replace(/^(Mr|Dr|Ms|Mrs)\.?\s/, "").split(" ")[0]}`);
    router.push(next ?? homeFor(me));
  };

  const signIn = async (mail: string, pass: string, key: string) => {
    setBusy(key);
    const res = await api.signIn(mail, pass);
    if (!res.ok) {
      setBusy(null);
      setErrors({ email: res.error });
      return;
    }
    await refresh();
    welcome(res.data);
  };

  const demo = async (a: (typeof DEMO_ACCOUNTS)[number]) => {
    if (USE_MOCKS) {
      setBusy(a.id);
      mockSignInAs(a.id);
      const me = await refresh();
      if (me) welcome(me);
      else setBusy(null);
      return;
    }
    setEmail(a.email);
    setErrors({});
    if (DEMO_PASSWORD) await signIn(a.email, DEMO_PASSWORD, a.id);
    else document.getElementById(pid)?.focus();
  };

  return (
    <div className="w-full max-w-md">
      <div className="paper relative p-6 shadow-pop-lg sm:p-7">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 font-display text-[13px] font-extrabold tracking-[0.12em]">
            <LogoMark className="h-4" /> LABPASS
          </span>
          <span className="rounded-full bg-ink px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-sun">Lab pass</span>
        </div>
        <h1 className="mt-4 text-3xl font-extrabold">Welcome back</h1>
        <p className="mt-1 text-sm text-mute">Show your pass to get to the labs.</p>
        {confirmFailed && (
          <div className="mt-4">
            <Notice tone="warn">That confirmation link didn&apos;t work or has expired. Sign in below, or sign up again to get a new link.</Notice>
          </div>
        )}
        <form
          className="mt-5 grid gap-4"
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            const r = schema.safeParse({ email, password });
            if (!r.success) {
              setErrors(Object.fromEntries(r.error.issues.map((i) => [String(i.path[0]), i.message])));
              return;
            }
            setErrors({});
            await signIn(r.data.email, r.data.password, "form");
          }}
        >
          <Field id={eid} label="College email" error={errors.email}>
            <Input id={eid} type="email" autoComplete="email" placeholder="you@college.edu" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!errors.email} />
          </Field>
          <Field id={pid} label="Password" error={errors.password} aside={<span className="text-[12px] text-mute">Forgot it? Ask the admin desk</span>}>
            <Input id={pid} type="password" autoComplete="current-password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!errors.password} />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy === "form"}>
            Sign in
          </Button>
        </form>
        <div className="mt-5 flex items-center justify-between border-t-2 border-dashed border-ink/25 pt-4 text-[13px]">
          <span className="text-mute">New to LabPass?</span>
          <Link href="/signup" className="font-semibold underline decoration-2 underline-offset-4">
            Get your pass →
          </Link>
        </div>
      </div>

      <div className="paper mt-4 p-4 sm:p-5">
        <p className="text-[12px] font-bold uppercase tracking-[0.1em]">Demo accounts · {USE_MOCKS || DEMO_PASSWORD ? "one click" : "fills the email"}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => demo(a)}
              disabled={!!busy}
              className="rounded-xl border-2 border-ink bg-white px-3 py-2 text-left transition-transform hover:-translate-y-0.5 hover:bg-sun-soft disabled:opacity-60"
            >
              <span className="block text-sm font-bold">{busy === a.id ? "Signing in…" : a.label}</span>
              <span className="block text-[11px] leading-tight text-mute">{a.role}</span>
            </button>
          ))}
        </div>
        {!USE_MOCKS && !DEMO_PASSWORD && <p className="mt-3 text-[12px] text-mute">Enter the demo password from the team doc, then sign in.</p>}
      </div>
    </div>
  );
}
