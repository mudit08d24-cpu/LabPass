// Full illustrated scenes: the pier of lab stations (hero/footer),
// the rod figure that lowers cards, and the pass-desk + ship login scene.

import { cn } from "@/lib/utils";
import { Bird, Bubble, Cat, Cloud, Desk, Dock, Person, Plant, Sign, Stool, Sun } from "./primitives";
import { ResourceArtGroup } from "./resource-art";

function Ship({ x, y, name = "LABPASS" }: { x: number; y: number; name?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M0 0 h230 l-24 42 h-176 z" className="fill-paper ink" />
      <path d="M8 14 h214" className="ink-thin" />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <circle key={i} cx={40 + i * 28} cy={6} r={3} className="fill-ink" />
      ))}
      <text x={115} y={31} textAnchor="middle" className="fill-ink" style={{ font: "800 11px var(--font-display)", letterSpacing: "0.2em" }}>
        {name}
      </text>
      <path d="M110 0 V-150" className="ink" strokeWidth={3} />
      <path d="M110 -146 L190 -20 H110 z" className="fill-paper ink" />
      <path d="M110 -120 L48 -20 H110" className="fill-paper ink" />
      {[-110, -80, -50].map((yy) => (
        <path key={yy} d={`M${110 + (yy + 146) * 0.62} ${yy} H110`} className="ink-thin" />
      ))}
      <path d="M110 -150 l22 6 l-22 6" className="fill-ink" />
      <path d="M110 -150 L0 0 M110 -150 L230 0" className="ink-thin" strokeDasharray="2 4" />
    </g>
  );
}

export function PierScene({ className, variant = "hero" }: { className?: string; variant?: "hero" | "story" }) {
  const deck = 196;
  return (
    <svg viewBox="0 0 1440 270" preserveAspectRatio="xMidYMax slice" className={cn("block h-full w-full", className)} role="img" aria-label="Students using shared lab equipment along a pier: a seminar room, an oscilloscope, a robot arm, a 3D printer, a supervised laser cutter, a camera and a check-in post">
      <Dock w={1440} y={deck} />

      {/* seminar room easel */}
      <g>
        <rect x={74} y={110} width={74} height={50} rx={3} className="fill-paper ink" />
        <path d="M84 148 l12 -14 l10 8 l14 -18 l18 10" className="ink" />
        <path d="M86 120 h24" className="ink-thin" />
        <path d="M84 160 l-10 36 M138 160 l10 36" className="ink" />
        <Person x={50} y={deck} pose="point" shirt="dots" hat="bun" />
        <Sign x={180} y={deck} label="seminar 204" post={30} />
      </g>

      {/* oscilloscope desk */}
      <g>
        <Desk x={262} y={deck} w={96} h={40} />
        <g transform={`translate(${278} ${deck - 40 - 40}) scale(0.4)`}>
          <ResourceArtGroup kind="oscilloscope" />
        </g>
        <Stool x={248} y={deck} />
        <Person x={244} y={deck - 22 + 22} pose="sit" shirt="stripe" hat="hair" />
        <Bubble x={244} y={deck - 80} text="~∿~ clean!" />
        <Sign x={384} y={deck} label="ECE · scope" post={24} />
      </g>

      {/* robot arm */}
      <g>
        <g transform={`translate(${410} ${deck - 92}) scale(0.92)`}>
          <ResourceArtGroup kind="robotics" />
        </g>
        <Person x={560} y={deck} pose="reach" flip shirt="check" hat="cap" />
        <Bubble x={566} y={deck - 86} text="T1 ✓" tail="left" />
      </g>

      {/* 3D printer */}
      <g>
        <Desk x={618} y={deck} w={96} h={26} />
        <g transform={`translate(${624} ${deck - 26 - 62}) scale(0.62)`}>
          <ResourceArtGroup kind="printer" />
        </g>
        <Person x={742} y={deck} pose="carry" flip shirt="plain" hat="beanie">
          <g transform="translate(-16 -48)">
            <circle r={5} className="fill-sun ink" strokeWidth={1.5} />
            <circle r={1.6} className="fill-ink" />
          </g>
        </Person>
        <Bubble x={748} y={deck - 76} text="printed!" />
        <Sign x={666} y={deck} label="3D printer · T2" post={6} />
      </g>

      {/* laser cutter with supervisor */}
      <g>
        <g transform={`translate(${808} ${deck - 74}) scale(0.74)`}>
          <ResourceArtGroup kind="laser" />
        </g>
        <path d="M818 196 v-12 M922 196 v-12" className="ink" />
        <Person x={940} y={deck} pose="stand" shirt="stripe" hat="hair" flip />
        <Person x={972} y={deck} pose="clipboard" shirt="ink" hat="cap" flip />
        <Bubble x={960} y={deck - 84} text="co-sign ✓" />
        <Sign x={870} y={deck} label="laser · supervised" post={10} />
      </g>

      {/* camera + cat */}
      <g>
        <Person x={1050} y={deck} pose="camera" shirt="dots" hat="bucket" />
        <path d="M1080 136 l18 -8 M1082 142 l20 0 M1080 148 l18 8" className="ink-thin" strokeDasharray="3 3" />
        <Cat x={1110} y={deck} />
      </g>

      {/* idle radar board */}
      <g>
        <rect x={1150} y={104} width={96} height={62} rx={3} className="fill-paper ink" />
        {[0.3, 0.6, 0.2, 0.9, 0.45].map((h, i) => (
          <rect key={i} x={1162 + i * 16} y={156 - h * 40} width={10} height={h * 40} className={i === 3 ? "fill-ink" : "fill-sun ink-thin"} />
        ))}
        <path d="M1158 156 h80" className="ink-thin" />
        <path d="M1172 166 l-8 30 M1224 166 l8 30" className="ink" />
        <Person x={1270} y={deck} pose="point" flip shirt="plain" hat="bun" />
        <Bubble x={1258} y={deck - 84} text="idle 4h?" />
      </g>

      {/* check-in QR post */}
      <g>
        <path d="M1356 196 V112" className="ink" strokeWidth={3} />
        <rect x={1336} y={96} width={40} height={40} rx={3} className="fill-paper ink" />
        {[[0, 0], [1, 2], [2, 1], [3, 3], [0, 3], [2, 0], [1, 1], [3, 0], [0, 2]].map(([a, b]) => (
          <rect key={`${a}${b}`} x={1342 + a * 7} y={102 + b * 7} width={6} height={6} className="fill-ink" />
        ))}
        <Person x={1404} y={deck} pose="reach" flip shirt="check" hat="hair">
          <rect x={10} y={-75} width={7} height={11} rx={1.5} className="fill-ink" />
        </Person>
        <Plant x={1318} y={deck} />
      </g>

      {variant === "hero" && (
        <>
          <Bubble x={300} y={64} text="fair queue ✓" />
          <g transform="translate(560 54)">
            <path d="M0 0 q-12 0 -12 -12 q0 -14 14 -14 q14 0 14 14 q0 12 -12 12 v6 h-4 z" className="fill-paper ink" />
            <text x={2} y={-9} textAnchor="middle" style={{ font: "700 9px var(--font-mono)" }}>AI</text>
            {[-40, -70, -100, -130, -160].map((a) => (
              <line key={a} x1={Math.cos((a * Math.PI) / 180) * 20 + 2} y1={Math.sin((a * Math.PI) / 180) * 20 - 12} x2={Math.cos((a * Math.PI) / 180) * 27 + 2} y2={Math.sin((a * Math.PI) / 180) * 27 - 12} className="ink-thin" />
            ))}
          </g>
          <Bird x={820} y={48} />
          <Bird x={846} y={60} />
          <text x={1004} y={70} style={{ font: "700 12px var(--font-hand)" }}>zzz…</text>
        </>
      )}
    </svg>
  );
}

/** Person on a ledge holding a rod; the rod tip is at (270, 14) in this 280 × 140 box. */
export const ROD_BOX = { w: 280, h: 140, tipX: 270, tipY: 14 };

export function RodFigure({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 280 140" className={cn("block", className)} aria-hidden>
      <rect x={-4} y={92} width={122} height={9} className="fill-paper ink" />
      <path d="M6 101 L40 134 M0 134 h52" className="ink" strokeWidth={2.4} />
      <Person x={60} y={124} pose="sit" shirt="stripe" hat="bucket" scale={1.28} />
      <path d="M80 70 L270 14" className="ink" strokeWidth={2.8} />
      <circle cx={92} cy={67} r={5.5} className="fill-paper ink" strokeWidth={1.6} />
      <g transform="translate(104 92)">
        <path d="M0 0 v-10 h14 v10" className="fill-paper ink" strokeWidth={1.6} />
        <path d="M2 -10 q5 -6 10 0" className="ink-thin" />
      </g>
    </svg>
  );
}

export function LoginScene({ className }: { className?: string }) {
  const deck = 330;
  return (
    <svg viewBox="0 0 1440 430" preserveAspectRatio="xMidYMax slice" className={cn("block h-full w-full", className)} aria-hidden>
      <Sun x={1000} y={110} r={22} />
      <Cloud x={300} y={90} s={1.4} />
      <Cloud x={1150} y={190} s={1.1} />
      <Cloud x={980} y={80} s={0.9} />
      <Bird x={420} y={160} />
      <Bird x={440} y={150} />
      <Dock w={1440} y={deck} to={1060} />
      {/* water continues under ship */}
      {[0, 1, 2].map((row) => {
        let d = `M1060 ${deck + 32 + row * 13}`;
        for (let wx = 1060; wx < 1440; wx += 24) d += " q6 -5 12 0 q6 5 12 0";
        return <path key={row} d={d} className="ink-thin" strokeWidth={1.5} />;
      })}
      {/* pass desk */}
      <g>
        <rect x={210} y={deck - 56} width={120} height={56} rx={3} className="fill-paper ink" />
        {[226, 246, 266, 286, 306].map((xx) => (
          <line key={xx} x1={xx} x2={xx} y1={deck - 50} y2={deck - 4} className="ink-thin" />
        ))}
        <path d="M200 270 h140" className="ink" strokeWidth={3} />
        <path d="M270 274 V180" className="ink" />
        <rect x={214} y={160} width={112} height={22} rx={3} className="fill-paper ink" />
        <text x={270} y={175} textAnchor="middle" style={{ font: "800 11px var(--font-mono)", letterSpacing: "0.12em" }}>
          PASS DESK
        </text>
        <Person x={298} y={deck - 56} pose="clipboard" shirt="stripe" hat="bun" flip scale={1.15} />
        <Person x={170} y={deck} pose="reach" shirt="dots" hat="hair" scale={1.15} />
        <Bubble x={146} y={240} text="quiz done ✓" />
        <rect x={232} y={262} width={16} height={10} rx={2} className="fill-ink" />
        <Cat x={350} y={deck} />
      </g>
      <Plant x={380} y={deck} />
      {/* walker + sign */}
      <Person x={820} y={deck} pose="stand" shirt="check" hat="cap" scale={1.15} />
      <Sign x={900} y={deck} label="to the labs →" post={60} w={98} />
      <path d="M1020 330 L1092 318" className="ink" strokeWidth={3} />
      <Ship x={1082} y={318} />
    </svg>
  );
}

export function SkyDoodles({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 1440 200" preserveAspectRatio="xMidYMin slice" className={cn("block h-full w-full", className)} aria-hidden>
      <Sun x={1340} y={70} r={18} />
      <Cloud x={980} y={120} />
      <Cloud x={220} y={150} s={0.8} />
      <Bird x={700} y={60} />
      <Bird x={720} y={52} />
    </svg>
  );
}
