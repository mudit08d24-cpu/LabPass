import Link from "next/link";
import { LogoMark } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <main className="grid min-h-[100svh] place-items-center px-4">
      <div className="paper w-full max-w-md p-7 text-center shadow-pop-lg">
        <span className="inline-flex items-center gap-2 font-display text-[13px] font-extrabold tracking-[0.12em]">
          <LogoMark className="h-4" /> LABPASS
        </span>
        <svg viewBox="0 0 160 70" className="mx-auto mt-4 h-20 w-auto" aria-hidden>
          <path d="M6 64h148" className="ink" />
          <rect x={52} y={22} width={56} height={42} rx={4} className="fill-paper ink" />
          <path d="M80 22v42M60 36h12M88 36h12" className="ink" />
          <path d="M70 14l10-8 10 8" className="ink" />
          <text x={80} y={58} textAnchor="middle" style={{ font: "800 12px var(--font-display)" }} className="fill-ink">
            404
          </text>
        </svg>
        <h1 className="mt-3 text-2xl font-extrabold">This room doesn&apos;t exist</h1>
        <p className="mt-2 text-sm text-mute">The link may be old, or the booking or resource was removed.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/browse" className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-semibold text-paper">
            Browse resources
          </Link>
          <Link href="/" className="inline-flex h-10 items-center rounded-full border-2 border-ink bg-paper px-5 text-sm font-semibold hover:bg-white">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
