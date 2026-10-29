"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LoginScene } from "@/components/art/scenes";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[100svh] overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[56vh] min-h-[300px]" aria-hidden>
        <LoginScene />
      </div>
      <Link href="/" className="absolute right-4 top-4 z-20 inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-paper px-3.5 py-1.5 text-[13px] font-semibold hover:bg-white sm:right-6 sm:top-6">
        ← Back to home
      </Link>
      <div className="relative z-10 flex min-h-[100svh] items-start justify-center px-4 pb-[40vh] pt-16 sm:pt-[8vh]">{children}</div>
    </div>
  );
}
