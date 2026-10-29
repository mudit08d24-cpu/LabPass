"use client";

// Any screen that crashes lands here instead of Next's default error page.

import Link from "next/link";
import { useEffect } from "react";
import { LogoMark } from "@/components/layout/logo";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="grid min-h-[70svh] place-items-center px-4">
      <div className="paper w-full max-w-md p-7 text-center shadow-pop-lg" role="alert">
        <span className="inline-flex items-center gap-2 font-display text-[13px] font-extrabold tracking-[0.12em]">
          <LogoMark className="h-4" /> LABPASS
        </span>
        <h1 className="mt-4 text-2xl font-extrabold">Something went wrong</h1>
        <p className="mt-2 text-sm text-mute">Nothing you did was lost. Try again, and if it keeps happening, tell the lab desk what you were doing.</p>
        {error.digest && <p className="mt-2 font-mono text-[11px] text-mute">Ref {error.digest}</p>}
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={reset} className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-semibold text-paper">
            Try again
          </button>
          <Link href="/" className="inline-flex h-10 items-center rounded-full border-2 border-ink bg-paper px-5 text-sm font-semibold hover:bg-white">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
