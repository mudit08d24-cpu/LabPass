// Hand-drawn line-art building blocks (black ink on yellow, paper fills),
// matching the reference site's illustration style.

import type { ReactNode } from "react";

type Pose = "stand" | "sit" | "reach" | "carry" | "wave" | "point" | "camera" | "clipboard" | "lean";
type Shirt = "stripe" | "plain" | "dots" | "check" | "ink";
type Hat = "none" | "cap" | "bucket" | "bun" | "hair" | "beanie";

export function Person({ x, y, pose = "stand", shirt = "plain", hat = "hair", flip = false, scale = 1, children }: { x: number; y: number; pose?: Pose; shirt?: Shirt; hat?: Hat; flip?: boolean; scale?: number; children?: ReactNode }) {
  const sit = pose === "sit";
  const torsoY = sit ? -44 : -52;
  const headY = torsoY - 9;
  const id = `p${Math.round(x)}${Math.round(y)}`;
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -scale : scale} ${scale})`}>
      {/* legs */}
      {sit ? (
        <>
          <path d={`M-3 ${torsoY + 22} L10 ${torsoY + 23} L11 0`} className="ink" strokeWidth={3.2} />
          <path d={`M3 ${torsoY + 22} L15 ${torsoY + 22} L16 0`} className="ink" strokeWidth={3.2} />
          <path d="M9 0 h6 M14 0 h6" className="ink" strokeWidth={2.4} />
        </>
      ) : pose === "lean" ? (
        <>
          <path d={`M-3 ${torsoY + 22} L-8 0`} className="ink" strokeWidth={3.2} />
          <path d={`M3 ${torsoY + 22} L7 0`} className="ink" strokeWidth={3.2} />
          <path d="M-12 0 h6 M5 0 h6" className="ink" strokeWidth={2.4} />
        </>
      ) : (
        <>
          <path d={`M-3 ${torsoY + 22} L-4 0`} className="ink" strokeWidth={3.2} />
          <path d={`M3 ${torsoY + 22} L5 0`} className="ink" strokeWidth={3.2} />
          <path d="M-8 0 h5 M4 0 h6" className="ink" strokeWidth={2.4} />
        </>
      )}
      {/* torso */}
      <defs>
        <clipPath id={`${id}c`}>
          <rect x={-7.5} y={torsoY} width={15} height={23} rx={4.5} />
        </clipPath>
      </defs>
      <rect x={-7.5} y={torsoY} width={15} height={23} rx={4.5} className={shirt === "ink" ? "fill-ink" : "fill-paper"} />
      <g clipPath={`url(#${id}c)`}>
        {shirt === "stripe" && [4, 8.5, 13, 17.5].map((d) => <line key={d} x1={-8} x2={8} y1={torsoY + d} y2={torsoY + d} className="ink-thin" strokeWidth={2} />)}
        {shirt === "dots" && [[-3, 5], [3, 9], [-2, 14], [4, 18]].map(([a, b]) => <circle key={`${a}${b}`} cx={a} cy={torsoY + b} r={1.2} className="fill-ink" />)}
        {shirt === "check" && (
          <>
            {[-3, 2].map((d) => <line key={d} x1={d} x2={d} y1={torsoY} y2={torsoY + 23} className="ink-thin" />)}
            {[6, 12, 18].map((d) => <line key={d} x1={-8} x2={8} y1={torsoY + d} y2={torsoY + d} className="ink-thin" />)}
          </>
        )}
      </g>
      <rect x={-7.5} y={torsoY} width={15} height={23} rx={4.5} className="ink" />
      {/* back arm */}
      <path d={`M-6 ${torsoY + 4} Q-10 ${torsoY + 12} -8 ${torsoY + 19}`} className="ink" strokeWidth={2.4} />
      {/* front arm by pose */}
      {pose === "reach" && <path d={`M5 ${torsoY + 4} Q12 ${torsoY - 4} 14 ${torsoY - 16}`} className="ink" strokeWidth={2.4} />}
      {pose === "wave" && <path d={`M5 ${torsoY + 4} L13 ${torsoY - 3} L15 ${torsoY - 13}`} className="ink" strokeWidth={2.4} />}
      {pose === "point" && <path d={`M5 ${torsoY + 5} L20 ${torsoY + 2}`} className="ink" strokeWidth={2.4} />}
      {(pose === "carry" || pose === "clipboard") && <path d={`M5 ${torsoY + 5} Q12 ${torsoY + 12} 15 ${torsoY + 8}`} className="ink" strokeWidth={2.4} />}
      {pose === "camera" && <path d={`M5 ${torsoY + 5} L13 ${torsoY - 1}`} className="ink" strokeWidth={2.4} />}
      {(pose === "stand" || pose === "lean") && <path d={`M6 ${torsoY + 4} Q9 ${torsoY + 12} 7 ${torsoY + 19}`} className="ink" strokeWidth={2.4} />}
      {pose === "sit" && <path d={`M5 ${torsoY + 5} Q12 ${torsoY + 10} 18 ${torsoY + 9}`} className="ink" strokeWidth={2.4} />}
      {pose === "clipboard" && (
        <g transform={`translate(13 ${torsoY - 2}) rotate(10)`}>
          <rect width={11} height={14} rx={1.5} className="fill-paper ink" strokeWidth={1.6} />
          <path d="M3 5h5M3 8h5M3 11h3" className="ink-thin" strokeWidth={1.2} />
        </g>
      )}
      {pose === "camera" && (
        <g transform={`translate(10 ${torsoY - 9})`}>
          <rect width={13} height={9} rx={2} className="fill-ink" />
          <circle cx={9} cy={4.5} r={3} className="fill-paper" />
          <rect x={2} y={-2} width={4} height={2.5} className="fill-ink" />
        </g>
      )}
      {/* head */}
      <circle cx={0} cy={headY - 2} r={7.5} className="fill-paper ink" />
      <circle cx={3} cy={headY - 2.5} r={0.9} className="fill-ink" />
      <path d={`M2 ${headY + 1.5} q2 1 3.5 -0.5`} className="ink-thin" />
      {hat === "cap" && <path d={`M-7.5 ${headY - 4} q7.5 -9 15 0 h5`} className="fill-ink ink" strokeWidth={1.6} />}
      {hat === "bucket" && (
        <>
          <path d={`M-6 ${headY - 6} q6 -8 12 0 z`} className="fill-paper ink" strokeWidth={1.8} />
          <path d={`M-10 ${headY - 5.5} h20`} className="ink" strokeWidth={2.2} />
        </>
      )}
      {hat === "beanie" && <path d={`M-7 ${headY - 4} q7 -11 14 0 z`} className="fill-ink" />}
      {hat === "bun" && (
        <>
          <path d={`M-7.5 ${headY - 2} q1 -8 8 -8 q6 0 7 6`} className="fill-ink" />
          <circle cx={-3} cy={headY - 12} r={3.4} className="fill-ink" />
        </>
      )}
      {hat === "hair" && <path d={`M-7.5 ${headY - 1} q1 -9 8 -8.5 q6 0.5 7 5 q-6 -2 -8 1`} className="fill-ink" />}
      {children}
    </g>
  );
}

export function Sign({ x, y, w, label, post = 26, tilt = 0 }: { x: number; y: number; w?: number; label: string; post?: number; tilt?: number }) {
  const width = w ?? Math.max(44, label.length * 6.2 + 16);
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
      <line x1={0} y1={0} x2={0} y2={-post} className="ink" />
      <rect x={-width / 2} y={-post - 17} width={width} height={17} rx={3} className="fill-paper ink" strokeWidth={1.6} />
      <text x={0} y={-post - 5.2} textAnchor="middle" className="fill-ink" style={{ font: "600 9.5px var(--font-mono)" }}>
        {label}
      </text>
    </g>
  );
}

export function Bubble({ x, y, text, w, tail = "left" }: { x: number; y: number; text: string; w?: number; tail?: "left" | "right" }) {
  const width = w ?? Math.max(26, text.length * 6 + 14);
  const tx = tail === "left" ? 8 : width - 8;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={0} y={-16} width={width} height={16} rx={5} className="fill-paper ink" strokeWidth={1.5} />
      <path d={`M${tx - 3} 0 l${tail === "left" ? -2 : 2} 6 l5 -6`} className="fill-paper ink" strokeWidth={1.5} />
      <line x1={tx - 3} x2={tx + 2} y1={0} y2={0} stroke="var(--color-paper)" strokeWidth={2} />
      <text x={width / 2} y={-4.6} textAnchor="middle" className="fill-ink" style={{ font: "700 9.5px var(--font-hand)" }}>
        {text}
      </text>
    </g>
  );
}

export function Sun({ x, y, r = 16 }: { x: number; y: number; r?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="origin-center animate-[spin_40s_linear_infinite]" style={{ transformBox: "fill-box" }}>
        {Array.from({ length: 12 }, (_, i) => {
          const a = (i * Math.PI) / 6;
          return <line key={i} x1={Math.cos(a) * (r + 5)} y1={Math.sin(a) * (r + 5)} x2={Math.cos(a) * (r + 11)} y2={Math.sin(a) * (r + 11)} className="ink" strokeWidth={1.8} />;
        })}
      </g>
      <circle r={r} className="fill-paper ink" />
      {[-0.1, 0.25, 0.6].map((d) => (
        <line key={d} x1={-r * Math.sqrt(1 - d * d) + 1} x2={r * Math.sqrt(1 - d * d) - 1} y1={d * r} y2={d * r} className="ink-thin" strokeWidth={1.6} />
      ))}
    </g>
  );
}

export function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 10 q0 -8 8 -7 q3 -8 12 -5 q7 -5 12 2 q8 -1 8 7 z"
      className="fill-paper ink"
      strokeWidth={1.6}
    />
  );
}

export function Bird({ x, y }: { x: number; y: number }) {
  return <path transform={`translate(${x} ${y})`} d="M0 0 q4 -4 7 0 q3 -4 7 0" className="ink-thin" strokeWidth={1.5} />;
}

/** Planked pier with posts and wavy water, spanning width w from y. */
export function Dock({ w, y, from = 0, to }: { w: number; y: number; from?: number; to?: number }) {
  const end = to ?? w;
  const posts: number[] = [];
  for (let px = from + 18; px < end; px += 64) posts.push(px);
  const waves: string[] = [];
  for (let row = 0; row < 3; row++) {
    const wy = y + 32 + row * 13;
    let d = `M${from} ${wy}`;
    for (let wx = from; wx < end; wx += 24) d += ` q6 -5 12 0 q6 5 12 0`;
    waves.push(d);
  }
  return (
    <g>
      {waves.map((d, i) => (
        <path key={i} d={d} className="ink-thin" strokeWidth={1.5} />
      ))}
      {posts.map((px) => (
        <rect key={px} x={px - 3} y={y + 8} width={6} height={58} className="fill-ink" />
      ))}
      <rect x={from} y={y} width={end - from} height={12} className="fill-paper ink" />
      {posts.map((px) => (
        <line key={`t${px}`} x1={px + 30} x2={px + 30} y1={y} y2={y + 12} className="ink-thin" />
      ))}
    </g>
  );
}

export function Cat({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${flip ? -1 : 1} 1)`}>
      <path d="M-9 0 q-1 -12 7 -13 l2 -6 l3 5 l3 -5 l2 6 q5 2 4 13 z" className="fill-paper ink" strokeWidth={1.6} />
      <path d="M-9 -2 q-9 -2 -8 -12" className="ink" strokeWidth={1.6} />
      <circle cx={2} cy={-11} r={0.9} className="fill-ink" />
      <circle cx={6} cy={-11} r={0.9} className="fill-ink" />
    </g>
  );
}

export function Plant({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-6 0 l-1.5 -10 h15 l-1.5 10 z" className="fill-paper ink" strokeWidth={1.6} />
      <path d="M0 -10 q-8 -6 -6 -16 M0 -10 q1 -10 7 -14 M0 -10 q-1 -8 0 -18" className="ink" strokeWidth={1.6} />
    </g>
  );
}

export function Stool({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M-9 -22 h18 M-6 -22 l-3 22 M6 -22 l3 22 M-7 -9 h14" className="ink" />
    </g>
  );
}

export function Desk({ x, y, w = 70, h = 30 }: { x: number; y: number; w?: number; h?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d={`M0 ${-h} h${w}`} className="ink" strokeWidth={3} />
      <path d={`M4 ${-h} v${h} M${w - 4} ${-h} v${h}`} className="ink" />
    </g>
  );
}
