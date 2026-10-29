// Line-art drawings of each demo resource. Used as listing photos,
// condition-photo placeholders and scene props. Drawn in a 160 × 100 box.

import type { ArtKind as ResourceArtKind } from "@/lib/screens/types";
import { cn } from "@/lib/utils";

export function ResourceArtGroup({ kind, damaged = false }: { kind: ResourceArtKind; damaged?: boolean }) {
  switch (kind) {
    case "seminar":
      return (
        <g>
          <rect x={22} y={14} width={86} height={50} rx={3} className="fill-paper ink" />
          <path d="M32 50 l12 -12 l10 7 l14 -16 l14 10 l10 -8" className="ink" />
          <path d="M32 24 h28 M32 30 h18" className="ink-thin" />
          <path d="M65 64 v8 M45 72 h40" className="ink" />
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${30 + i * 34} 78)`}>
              <path d="M0 0 h18 M3 0 v14 M15 0 v14 M15 0 v-10" className="ink" />
            </g>
          ))}
          <path d="M120 22 l14 -6 v16 z" className="fill-ink" />
          <path d="M120 24 L108 34 M120 28 L108 52" className="ink-thin" strokeDasharray="3 3" />
          {damaged && <Mark cx={64} cy={40} />}
        </g>
      );
    case "oscilloscope":
      return (
        <g>
          <rect x={20} y={20} width={110} height={64} rx={6} className="fill-paper ink" />
          <rect x={28} y={28} width={62} height={44} rx={3} className="fill-ink" />
          <path d="M31 50 q7 -16 14 0 t14 0 t14 0 t14 0" fill="none" stroke="var(--color-sun)" strokeWidth={2} />
          <path d="M28 50 h62 M59 28 v44" stroke="var(--color-sun)" strokeOpacity={0.25} strokeWidth={1} />
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx={104 + (i % 2) * 14} cy={36 + Math.floor(i / 2) * 16} r={5} className="fill-paper ink" strokeWidth={1.6} />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <circle key={`p${i}`} cx={32 + i * 16} cy={78} r={2.4} className="fill-ink" />
          ))}
          <path d="M32 80 q-10 14 6 16 q30 3 44 -6" className="ink-thin" />
          <path d="M130 70 q16 6 14 24" className="ink" />
          {damaged && <Mark cx={58} cy={50} />}
        </g>
      );
    case "robotics":
      return (
        <g>
          <rect x={40} y={82} width={44} height={10} rx={2} className="fill-ink" />
          <path d="M62 82 v-14" className="ink" strokeWidth={3} />
          <circle cx={62} cy={66} r={6} className="fill-paper ink" />
          <path d="M62 66 L88 38" className="ink" strokeWidth={6} />
          <path d="M62 66 L88 38" stroke="var(--color-paper)" strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={88} cy={38} r={5} className="fill-paper ink" />
          <path d="M88 38 L118 46" className="ink" strokeWidth={5} />
          <path d="M88 38 L118 46" stroke="var(--color-paper)" strokeWidth={2} strokeLinecap="round" />
          <path d="M118 46 l8 -6 M118 46 l9 4" className="ink" strokeWidth={2.4} />
          {Array.from({ length: 6 }, (_, i) => (
            <path key={i} d={`M${18 + i * 5} 92 q2.5 -6 5 0`} className="ink-thin" />
          ))}
          <path d="M14 92 h130" className="ink" />
          <rect x={126} y={70} width={14} height={14} className="fill-paper ink" />
          {damaged && <Mark cx={88} cy={38} />}
        </g>
      );
    case "dslr":
      return (
        <g>
          <path d="M34 34 h22 l6 -8 h26 l6 8 h30 a6 6 0 0 1 6 6 v40 a6 6 0 0 1 -6 6 h-90 a6 6 0 0 1 -6 -6 v-40 a6 6 0 0 1 6 -6 z" className="fill-paper ink" />
          <circle cx={78} cy={58} r={20} className="fill-ink" />
          <circle cx={78} cy={58} r={13} className="fill-paper ink" />
          <circle cx={78} cy={58} r={6} className="fill-ink" />
          <circle cx={74} cy={54} r={2} className="fill-paper" />
          <rect x={110} y={40} width={12} height={7} rx={1.5} className="fill-ink" />
          <path d="M28 44 q-14 30 10 52 M128 44 q14 30 -10 52" className="ink-thin" strokeDasharray="4 3" />
          {damaged && <Mark cx={78} cy={58} />}
        </g>
      );
    case "printer":
      return (
        <g>
          <path d="M30 92 V18 h80 V92" className="ink" strokeWidth={2.6} />
          <path d="M30 18 h80" className="ink" strokeWidth={4} />
          <path d="M30 40 h80" className="ink" />
          <rect x={60} y={34} width={16} height={12} rx={2} className="fill-ink" />
          <path d="M68 46 l-3 6 h6 z" className="fill-ink" />
          <rect x={38} y={80} width={64} height={6} className="fill-paper ink" />
          <path d="M58 80 v-12 q10 -8 20 0 v12" className="fill-sun ink" />
          <path d="M60 74 h16 M60 70 h16" className="ink-thin" />
          <path d="M20 92 h108" className="ink" />
          <circle cx={128} cy={34} r={12} className="fill-paper ink" />
          <circle cx={128} cy={34} r={4} className="fill-ink" />
          <path d="M118 40 Q96 50 76 42" className="ink-thin" />
          {damaged && (
            <>
              <path d="M44 83 l6 -2 l4 3 l6 -3" className="ink" stroke="var(--color-red-ink)" strokeWidth={2} />
              <Mark cx={52} cy={83} />
            </>
          )}
        </g>
      );
    case "laser":
      return (
        <g>
          <rect x={18} y={36} width={124} height={50} rx={5} className="fill-paper ink" />
          <path d="M18 36 L30 18 h100 l12 18" className="fill-paper ink" />
          <rect x={40} y={22} width={80} height={11} rx={2} className="fill-ink" opacity={0.85} />
          <rect x={30} y={70} width={100} height={8} className="fill-paper ink" />
          <path d="M56 46 v24" stroke="var(--color-red-ink)" strokeWidth={1.6} strokeDasharray="3 2" />
          <rect x={48} y={42} width={16} height={6} rx={1} className="fill-ink" />
          <path d="M120 46 l7 12 h-14 z" className="fill-sun ink" strokeWidth={1.5} />
          <path d="M120 51 v3" className="ink" strokeWidth={1.5} />
          <circle cx={30} cy={48} r={3} className="fill-ink" />
          <path d="M142 50 q14 0 14 -24" className="ink" strokeWidth={4} />
          <path d="M142 50 q14 0 14 -24" stroke="var(--color-paper)" strokeWidth={1.5} />
          {damaged && <Mark cx={56} cy={45} />}
        </g>
      );
  }
}

function Mark({ cx, cy }: { cx: number; cy: number }) {
  return <circle cx={cx} cy={cy} r={13} fill="none" stroke="var(--color-red-ink)" strokeWidth={2.4} strokeDasharray="5 3" />;
}

export function ResourceArt({ kind, damaged, className, bg = "paper", label }: { kind: ResourceArtKind; damaged?: boolean; className?: string; bg?: "paper" | "sun" | "none"; label?: string }) {
  return (
    <svg viewBox="0 0 160 100" role="img" aria-label={label ?? `${kind} illustration`} className={cn("block h-auto w-full", bg === "sun" && "bg-sun-soft", bg === "paper" && "bg-paper-2", className)}>
      <ResourceArtGroup kind={kind} damaged={damaged} />
    </svg>
  );
}

/** Resolves our photo URLs: "art:printer:damaged" → drawing; blob/http → <img>. */
export function PhotoView({ src, className, alt }: { src: string; className?: string; alt: string }) {
  if (src.startsWith("art:")) {
    const [, kind, flag] = src.split(":");
    return <ResourceArt kind={kind as ResourceArtKind} damaged={flag === "damaged"} className={className} label={alt} />;
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={cn("block h-auto w-full object-cover", className)} />;
}
