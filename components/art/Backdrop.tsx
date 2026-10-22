"use client";

import { useEffect, useState } from "react";

// Stylized Strasbourg behind a screen: cathedral and half-timbered houses on the Ill, a stork nest
// on a chimney, drifting clouds, and a sky that follows the viewer's local time of day.
// Colors come from --art-* tokens in globals.css so it follows light and dark.
type Phase = "dawn" | "day" | "dusk" | "night";
const SKY: Record<Phase, { glow: string; sun: number; star: number; lamp: number; sunY: number }> = {
  dawn: { glow: "#f7b58f", sun: 1, star: 0.2, lamp: 0.5, sunY: 190 },
  day: { glow: "#f6d9a0", sun: 1, star: 0, lamp: 0, sunY: 95 },
  dusk: { glow: "#f08a6a", sun: 1, star: 0.3, lamp: 0.8, sunY: 200 },
  night: { glow: "#33466e", sun: 0, star: 1, lamp: 1, sunY: 95 },
};
const phaseOf = (h: number): Phase => (h >= 5 && h < 8 ? "dawn" : h >= 8 && h < 17 ? "day" : h >= 17 && h < 20 ? "dusk" : "night");

function House({ x, w, h, roof = "var(--art-roof)", nest = false }: { x: number; w: number; h: number; roof?: string; nest?: boolean }) {
  const y = 300 - h;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="var(--art-wall)" />
      <path d={`M${x - 4} ${y} L${x + w / 2} ${y - w * 0.55} L${x + w + 4} ${y} Z`} fill={roof} />
      <rect x={x + w * 0.72} y={y - w * 0.5} width="6" height="14" fill="var(--art-beam)" />
      <path d={`M${x} ${y + h * 0.4}H${x + w}M${x} ${y + h * 0.75}H${x + w}M${x + w / 2} ${y}V300M${x} ${y + h * 0.4}L${x + w / 2} ${y + h * 0.75}L${x + w} ${y + h * 0.4}`} stroke="var(--art-beam)" strokeWidth="2" fill="none" />
      {[0.2, 0.64].map((f) => (
        <g key={f}>
          <rect x={x + w * f} y={y + h * 0.12} width={w * 0.16} height={h * 0.16} fill="var(--art-window)" />
          <rect x={x + w * f - 1} y={y + h * 0.28} width={w * 0.16 + 2} height="4" fill="var(--art-beam)" />
          <circle cx={x + w * f + 2} cy={y + h * 0.27} r="2" fill="#d94a4a" /><circle cx={x + w * f + w * 0.08} cy={y + h * 0.26} r="2" fill="#f08a9a" /><circle cx={x + w * f + w * 0.14} cy={y + h * 0.27} r="2" fill="#d94a4a" />
        </g>
      ))}
      {nest && (
        <g>
          <ellipse cx={x + w * 0.75 + 3} cy={y - w * 0.5 - 1} rx="11" ry="4" fill="var(--art-beam)" />
          <path d={`M${x + w * 0.75} ${y - w * 0.5 - 3} q-2 -8 3 -12 q3 -3 4 2 l8 -3 l-8 6 q0 5 -3 7 z`} fill="#fff" stroke="var(--art-beam)" strokeWidth="0.8" />
        </g>
      )}
    </g>
  );
}

export default function Backdrop() {
  const [phase, setPhase] = useState<Phase>("day");
  useEffect(() => setPhase(phaseOf(new Date().getHours())), []);
  const s = SKY[phase];
  return (
    <div aria-hidden="true" className="art pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[52vh] max-h-[460px]"
      style={{ ["--sun-o" as string]: s.sun, ["--star-o" as string]: s.star }}>
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" className="h-full w-full">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--background)" stopOpacity="0" />
            <stop offset="1" stopColor={s.glow} stopOpacity="0.6" />
          </linearGradient>
          <radialGradient id="sun"><stop offset="0" stopColor={s.glow} stopOpacity="0.95" /><stop offset="1" stopColor={s.glow} stopOpacity="0" /></radialGradient>
        </defs>
        <rect width="400" height="300" fill="url(#sky)" />
        <g className="art-stars" fill="#fff">
          {[[30, 40], [80, 20], [140, 60], [200, 25], [250, 50], [320, 30], [370, 70], [110, 95], [350, 120]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 1 : 1.6} />)}
        </g>
        <g className="art-sun"><circle cx="70" cy={s.sunY} r="46" fill="url(#sun)" /><circle cx="70" cy={s.sunY} r="17" fill={s.glow} /></g>
        {phase === "night" && <path d="M310 70 a18 18 0 1 0 14 28 a14 14 0 1 1 -14 -28 z" fill="#f4ebdd" opacity="0.9" />}
        <g className="art-cloud art-cloud-a" fill="#fff" opacity="0.55"><ellipse cx="60" cy="70" rx="30" ry="9" /><ellipse cx="82" cy="64" rx="20" ry="9" /></g>
        <g className="art-cloud art-cloud-b" fill="#fff" opacity="0.4"><ellipse cx="260" cy="100" rx="36" ry="10" /><ellipse cx="282" cy="93" rx="22" ry="9" /></g>
        <g className="art-fly" fill="none" stroke="var(--art-beam)" strokeWidth="1.6" strokeLinecap="round">
          <path d="M0 0 q5 -5 10 0 q5 -5 10 0" /><path d="M26 6 q4 -4 8 0 q4 -4 8 0" />
        </g>

        {/* cathedral: single asymmetrical spire, rose window, buttresses */}
        <g fill="var(--art-stone)">
          <path d="M262 300V176h30V300Z" />
          <path d="M264 176 L277 24 L290 176 Z" />
          <rect x="296" y="196" width="34" height="104" />
          <rect x="246" y="206" width="18" height="94" />
          <path d="M330 220l12 80h-12zM246 220l-10 80h10z" />
        </g>
        <path d="M277 24V8" stroke="var(--art-stone)" strokeWidth="2" />
        <g stroke="var(--art-wall)" strokeWidth="1.6" fill="none" opacity="0.75">
          <path d="M277 60V168M270 92H284M269 124H285M268 152H286" />
          <path d="M270 300v-26a7 7 0 0 1 14 0v26" /><path d="M300 300v-16a6 6 0 0 1 12 0v16" />
        </g>
        <circle cx="313" cy="222" r="11" fill="var(--art-window)" stroke="var(--art-wall)" strokeWidth="1.6" opacity="0.9" />
        <path d="M313 211v22M302 222h22M305 214l16 16M321 214l-16 16" stroke="var(--art-wall)" strokeWidth="1" opacity="0.8" />

        <House x={8} w={54} h={112} nest />
        <House x={66} w={46} h={86} roof="var(--art-roof-2)" />
        <House x={116} w={58} h={126} />
        <House x={178} w={48} h={94} roof="var(--art-roof-2)" />
        <House x={346} w={52} h={102} />

        {/* lamps */}
        {[[232, 258], [338, 256], [120, 262]].map(([x, y]) => (
          <g key={x}>
            <path d={`M${x} ${y}V${y + 42}`} stroke="var(--art-beam)" strokeWidth="2" />
            <circle cx={x} cy={y - 2} r="9" fill="#ffd27a" opacity={s.lamp * 0.35} />
            <circle cx={x} cy={y - 2} r="3.4" fill="#ffd27a" opacity={0.4 + s.lamp * 0.6} />
          </g>
        ))}

        {/* the Ill, a stone bridge, and a boat */}
        <path d="M0 262 Q50 250 100 262 T200 262 T300 262 T400 262 V300 H0 Z" fill="var(--art-water)" />
        <path d="M150 262 q30 -26 60 0" stroke="var(--art-stone)" strokeWidth="5" fill="none" />
        <path d="M150 262h60" stroke="var(--art-stone)" strokeWidth="6" />
        <g className="art-boat"><path d="M30 268 h34 l-5 9 h-24 z" fill="var(--art-roof)" /><rect x="40" y="258" width="14" height="10" fill="var(--art-wall)" /></g>
        <path className="art-ripple" d="M-40 280 Q10 270 60 280 T160 280 T260 280 T360 280 T460 280" stroke="var(--art-glow)" strokeWidth="2" fill="none" opacity="0.6" />
      </svg>
    </div>
  );
}
