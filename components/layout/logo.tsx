import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 24" className={cn("h-5 w-auto", className)} aria-hidden>
      <rect x={2} y={4} width={22} height={16} rx={3.5} className="fill-paper ink" />
      <circle cx={9} cy={12} r={3} className="fill-ink" />
      <path d="M15 10h6M15 14h4" className="ink" strokeWidth={1.8} />
      <path d="M24 12h6" className="ink" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 font-display text-[17px] font-extrabold tracking-[0.06em]", className)} aria-label="LabPass home">
      <LogoMark />
      LABPASS
    </Link>
  );
}
