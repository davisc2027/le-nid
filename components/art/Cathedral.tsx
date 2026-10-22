"use client";

import { useEffect, useId, useLayoutEffect, useState, type CSSProperties, type ReactNode } from "react";
import Stork from "./Stork";
import { useOdileIdle } from "./OdileActor";
import { MILESTONES, SPIRE_M, yAt } from "./cathedralPlan";

// Notre-Dame de Strasbourg, built course by course as the group earns XP.
// The finished drawing is split into horizontal parts; whatever lies below the build line is stone,
// the rest is a faint blueprint. New growth since this device last looked drops in as stone slabs
// (CSS transform/opacity only), the crane lifts, and milestone moments play once.

const KEY = "lenid:cathedral-seen";
const NX = 54; // north tower / spire axis
const S = "var(--cath-stone)", HI = "var(--cath-stone-hi)", LO = "var(--cath-stone-lo)", LN = "var(--cath-line)", REC = "var(--cath-recess)";
const GOLD = "var(--cath-gold)", HOLE = "var(--cath-hole)";
const GLASS = ["var(--glass-blue)", "var(--glass-red)", "var(--glass-gold)", "var(--glass-blue)", "var(--cath-glass-green)", "var(--glass-red)", "var(--glass-blue)", "var(--glass-gold)"];
const n1 = (n: number) => Math.round(n * 10) / 10;
const hw = (y: number) => 2 + (15 * (y - 38)) / 90; // spire half width

// ---------- geometry helpers ----------
function arch(x1: number, x2: number, ys: number, yb: number, close = true) {
  const w = x2 - x1, cx = (x1 + x2) / 2, ya = ys - w * 0.866;
  return `M${n1(x1)} ${n1(yb)}V${n1(ys)}A${n1(w)} ${n1(w)} 0 0 1 ${n1(cx)} ${n1(ya)}A${n1(w)} ${n1(w)} 0 0 1 ${n1(x2)} ${n1(ys)}V${n1(yb)}${close ? "Z" : ""}`;
}
const lines = (n: number, f: (i: number) => string) => Array.from({ length: n }, (_, i) => f(i)).join("");
const courses = (x1: number, x2: number, y1: number, y2: number, step = 6) => lines(Math.floor((y2 - y1) / step) + 1, (i) => `M${x1} ${n1(y1 + i * step)}H${x2}`);
const strings = (x1: number, x2: number, y1: number, y2: number, step = 3) => lines(Math.floor((x2 - x1) / step) + 1, (i) => `M${n1(x1 + i * step)} ${y1}V${y2}`);
const arcade = (x1: number, x2: number, ys: number, yb: number, w: number, gap: number) => lines(Math.floor((x2 - x1 + gap) / (w + gap)), (i) => arch(x1 + i * (w + gap), x1 + i * (w + gap) + w, ys, yb));

function Pinnacle({ x, base, h, w = 3 }: { x: number; base: number; h: number; w?: number }) {
  const top = base - h * 0.42, tip = base - h, e = w / 2 + 0.6;
  const dots = [0.35, 0.68].flatMap((t) => [[x - e * (1 - t) - 0.6, top + (tip - top) * t], [x + e * (1 - t) + 0.6, top + (tip - top) * t]]);
  return (
    <g>
      <rect x={x - w / 2} y={top} width={w} height={base - top} fill={HI} stroke={LN} strokeWidth=".55" />
      <path d={`M${x - e} ${top}L${x} ${tip}L${x + e} ${top}Z`} fill={S} stroke={LN} strokeWidth=".55" strokeLinejoin="round" />
      {dots.map(([cx, cy], i) => <circle key={i} cx={n1(cx)} cy={n1(cy)} r=".65" fill={HI} stroke={LN} strokeWidth=".35" />)}
      <circle cx={x} cy={tip - 0.7} r=".85" fill={HI} stroke={LN} strokeWidth=".4" />
    </g>
  );
}

function Gable({ cx, base, apex, half }: { cx: number; base: number; apex: number; half: number }) {
  const h = base - apex, L = Math.hypot(h, half);
  const crockets = [0.18, 0.36, 0.54, 0.72].flatMap((t) => {
    const lx = cx - half + half * t, y = base - h * t, rx = cx + half - half * t;
    return [[lx - (h / L) * 1.3, y - (half / L) * 1.3], [rx + (h / L) * 1.3, y - (half / L) * 1.3]];
  });
  return (
    <g>
      <path d={`M${cx - half} ${base}L${cx} ${apex}L${cx + half} ${base}Z`} fill={HI} stroke={LN} strokeWidth=".8" strokeLinejoin="round" />
      <path d={`M${cx - half + 4} ${base - 1.5}L${cx} ${apex + 6}L${cx + half - 4} ${base - 1.5}Z`} fill={S} stroke={LN} strokeWidth=".45" />
      <circle cx={cx} cy={n1(base - h * 0.45)} r={n1(half * 0.22)} fill={REC} stroke={LN} strokeWidth=".5" />
      <path d={`M${cx} ${n1(base - h * 0.45 - half * 0.22)}V${n1(base - h * 0.45 + half * 0.22)}M${n1(cx - half * 0.22)} ${n1(base - h * 0.45)}H${n1(cx + half * 0.22)}`} stroke={HI} strokeWidth=".5" />
      {crockets.map(([x, y], i) => <circle key={i} cx={n1(x)} cy={n1(y)} r=".9" fill={HI} stroke={LN} strokeWidth=".4" />)}
      <path d={`M${cx} ${apex}v-4M${cx - 1.6} ${apex - 2.6}h3.2`} stroke={LN} strokeWidth=".9" strokeLinecap="round" />
    </g>
  );
}

const PORTALS = [{ x1: 83, x2: 117, ys: 340 }, { x1: 44, x2: 64, ys: 348 }, { x1: 136, x2: 156, ys: 348 }];
const YB = 369;
const doorBox = (p: (typeof PORTALS)[number]) => { const i = (p.x2 - p.x1) * 0.26; return { x: p.x1 + i, w: p.x2 - p.x1 - 2 * i, y: p.ys + 4 }; };

function Portal({ x1, x2, ys }: { x1: number; x2: number; ys: number }) {
  const w = x2 - x1, i = w * 0.26, d = doorBox({ x1, x2, ys });
  return (
    <g>
      <path d={arch(x1, x2, ys, YB)} fill={LO} stroke={LN} strokeWidth=".9" />
      {[0.07, 0.14, 0.21].map((k, j) => <path key={k} d={arch(x1 + w * k, x2 - w * k, ys, YB, false)} fill="none" stroke={j === 1 ? HI : LN} strokeWidth={j === 1 ? 1.4 : 0.5} strokeDasharray={j === 1 ? "1 1" : undefined} />)}
      <path d={arch(x1 + i, x2 - i, ys, YB)} fill={HI} stroke={LN} strokeWidth=".6" />
      <circle cx={(x1 + x2) / 2} cy={n1(ys - (w - 2 * i) * 0.35)} r={n1(w * 0.07)} fill={S} stroke={LN} strokeWidth=".4" />
      <rect x={d.x} y={d.y - 2} width={d.w} height="2" fill={S} stroke={LN} strokeWidth=".4" />
      <rect x={d.x} y={d.y} width={d.w} height={YB - d.y} fill="var(--cath-door)" />
      <path d={`M${n1(d.x + d.w / 2)} ${d.y}V${YB}`} stroke={HI} strokeWidth={w > 30 ? 1.6 : 1} />
      <path d={`M${n1(d.x + 1.5)} ${d.y + 3}V${YB - 2}M${n1(d.x + d.w - 1.5)} ${d.y + 3}V${YB - 2}`} stroke={LN} strokeWidth=".4" opacity=".6" />
    </g>
  );
}

function petal(cx: number, cy: number, a: number, r0: number, r1: number, wd: number) {
  const P = (u: number, v: number) => `${n1(cx + u * Math.cos(a) - v * Math.sin(a))} ${n1(cy + u * Math.sin(a) + v * Math.cos(a))}`;
  const m = r1 - r0;
  return `M${P(r0, 0)}C${P(r0 + m * 0.3, wd)} ${P(r1 - m * 0.18, wd * 0.8)} ${P(r1, 0)}C${P(r1 - m * 0.18, -wd * 0.8)} ${P(r0 + m * 0.3, -wd)} ${P(r0, 0)}Z`;
}
const RX = 100, RY = 262;
const ROSE_N = 16;
const roseTracery = (() => {
  let d = "";
  for (let k = 0; k < ROSE_N; k++) {
    const a = (k / ROSE_N) * Math.PI * 2 - Math.PI / 2;
    d += petal(RX, RY, a, 6.5, 17.6, 2.1);
    const b = a + Math.PI / ROSE_N;
    d += `M${n1(RX + 6.2 * Math.cos(b))} ${n1(RY + 6.2 * Math.sin(b))}L${n1(RX + 18.4 * Math.cos(b))} ${n1(RY + 18.4 * Math.sin(b))}`;
  }
  return d;
})();
const roseInner = lines(8, (k) => petal(RX, RY, (k / 8) * Math.PI * 2 - Math.PI / 2, 2.6, 6.2, 1.5));

// Bells: [cx, top, scale]
const BELLS: [number, number, number][] = [[88.5, 205, 0.8], [100, 203.5, 1.1], [111.5, 205, 0.8], [NX, 161, 1]];
const bellPath = (cx: number, t: number, s: number) =>
  `M${n1(cx - 2.8 * s)} ${n1(t + 6.4 * s)}C${n1(cx - 2.8 * s)} ${n1(t + 1.6 * s)} ${n1(cx - 2 * s)} ${t} ${cx} ${t}C${n1(cx + 2 * s)} ${t} ${n1(cx + 2.8 * s)} ${n1(t + 1.6 * s)} ${n1(cx + 2.8 * s)} ${n1(t + 6.4 * s)}L${n1(cx + 3.8 * s)} ${n1(t + 7.8 * s)}H${n1(cx - 3.8 * s)}Z`;
const BELL_SLOTS: [number, number, number, number][] = [[84, 93, 202, 221], [95.5, 104.5, 202, 221], [107, 116, 202, 221], [50, 58, 154, 180]];

const Buttress = ({ x, y0, y1, w }: { x: number; y0: number; y1: number; w: number }) => (
  <g>
    <rect x={x - w / 2} y={y0} width={w} height={y1 - y0} fill={HI} stroke={LN} strokeWidth=".6" />
    <path d={`M${x - w / 2 - 0.5} ${y0 + 0.5}L${x} ${y0 - 3}L${x + w / 2 + 0.5} ${y0 + 0.5}Z`} fill={S} stroke={LN} strokeWidth=".5" strokeLinejoin="round" />
    <path d={`M${x} ${y0 + 4}V${y1 - 2}`} stroke={LO} strokeWidth=".5" />
  </g>
);
const BUTT = [33, 75, 125, 167];
const Gargoyle = ({ x, y, dir }: { x: number; y: number; dir: 1 | -1 }) => (
  <path d={`M${x} ${y}l${dir * 6} -1.6l${dir * 1.4} -1.4l${dir * 0.6} 1.6l${-dir * 0.8} 1.2l${dir * 0.8} 1.2l${-dir * 1.8} .4l${-dir * 6.2} 1.4Z`} fill={LO} stroke={LN} strokeWidth=".5" strokeLinejoin="round" />
);

// ---------- the finished cathedral, as parts with vertical extents ----------
type Part = { y0: number; y1: number; node: ReactNode };
const PARTS: Part[] = [
  // foundation, portals, gables
  {
    y0: 284, y1: 384, node: (
      <g key="t0">
        <rect x="33" y="296" width="134" height="74" fill={S} />
        <path d={courses(33, 167, 302, 368)} stroke={LO} strokeWidth=".4" opacity=".55" />
        {BUTT.map((x) => <Buttress key={x} x={x} y0={300} y1={370} w={8} />)}
        {PORTALS.map((p) => <Portal key={p.x1} {...p} />)}
        <Gable cx={100} base={326} apex={288} half={22} />
        <Gable cx={54} base={334} apex={308} half={14} />
        <Gable cx={146} base={334} apex={308} half={14} />
        <Pinnacle x={75} base={338} h={42} w={3.4} />
        <Pinnacle x={125} base={338} h={42} w={3.4} />
        <Pinnacle x={33} base={340} h={34} w={3} />
        <Pinnacle x={167} base={340} h={34} w={3} />
        <path d="M26 384V374H174V384Z" fill={LO} stroke={LN} strokeWidth=".9" />
        <path d="M29 374V369H171V374Z" fill={HI} stroke={LN} strokeWidth=".6" />
        <rect x="30" y="296" width="140" height="4.5" fill={HI} stroke={LN} strokeWidth=".6" />
        <path d={lines(34, (i) => `M${31 + i * 4.2} 297.2v2`)} stroke={LN} strokeWidth=".4" opacity=".6" />
        <Gargoyle x={29} y={302} dir={-1} />
        <Gargoyle x={171} y={302} dir={1} />
      </g>
    ),
  },
  // facade storey: tower lancets, harp strings, rose window, apostles' gallery
  {
    y0: 222, y1: 297, node: (
      <g key="t1">
        <rect x="33" y="224" width="134" height="72" fill={S} />
        <path d={courses(33, 167, 238, 294)} stroke={LO} strokeWidth=".4" opacity=".5" />
        {[NX, 146].map((cx) => (
          <g key={cx}>
            <path d={arch(cx - 14, cx + 14, 266, 292, false)} fill="none" stroke={LN} strokeWidth=".7" />
            <path d={arch(cx - 11, cx - 3, 266, 291) + arch(cx + 3, cx + 11, 266, 291)} fill={REC} stroke={LN} strokeWidth=".5" />
            <circle cx={cx} cy="252" r="3.6" fill={REC} stroke={LN} strokeWidth=".5" />
            <path d={`M${cx - 7} 262V291M${cx + 7} 262V291`} stroke={HI} strokeWidth=".6" />
            <path d={strings(cx - 15, cx + 15, 240, 293)} stroke={HI} strokeWidth=".55" opacity=".85" />
          </g>
        ))}
        <path d={arcade(81, 119, 288, 295, 4.2, 1.2)} fill={REC} stroke={LN} strokeWidth=".35" />
        <path d={strings(81, 119, 284, 295, 2.7)} stroke={HI} strokeWidth=".45" opacity=".7" />
        <rect x="79" y="240" width="42" height="44" fill="none" stroke={LN} strokeWidth=".5" />
        {[[82, 243], [118, 243], [82, 281], [118, 281]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.8" fill={REC} stroke={LN} strokeWidth=".4" />)}
        <circle cx={RX} cy={RY} r="21.2" fill={HI} stroke={LN} strokeWidth=".9" />
        <path d={lines(24, (k) => { const a = (k / 24) * Math.PI * 2; return `M${n1(RX + 20.2 * Math.cos(a))} ${n1(RY + 20.2 * Math.sin(a))}h.01`; })} stroke={LN} strokeWidth="1.1" strokeLinecap="round" opacity=".6" />
        <circle cx={RX} cy={RY} r="18.6" fill={REC} stroke={LN} strokeWidth=".5" />
        <path d={roseTracery + roseInner} fill="none" stroke={HI} strokeWidth=".7" strokeLinejoin="round" />
        <circle cx={RX} cy={RY} r="6.4" fill="none" stroke={HI} strokeWidth=".8" />
        <circle cx={RX} cy={RY} r="2.4" fill={HI} stroke={LN} strokeWidth=".4" />
        {BUTT.map((x) => <Buttress key={x} x={x} y0={238} y1={296} w={7} />)}
        <rect x="31" y="224" width="138" height="13" fill={S} stroke={LN} strokeWidth=".6" />
        <path d={arcade(34, 166, 229.5, 236, 3.4, 1.4)} fill={REC} />
        <path d={lines(28, (i) => `M${n1(35.7 + i * 4.8)} 232.4h.01`)} stroke={HI} strokeWidth="1.5" strokeLinecap="round" />
        <rect x="30" y="223" width="140" height="2.6" fill={HI} stroke={LN} strokeWidth=".5" />
        <Gargoyle x={29.5} y={242} dir={-1} />
        <Gargoyle x={170.5} y={242} dir={1} />
      </g>
    ),
  },
  // belfry storey, bells, platform with balustrade
  {
    y0: 178, y1: 225, node: (
      <g key="t2">
        <rect x="33" y="186" width="134" height="38" fill={S} />
        <path d={courses(33, 167, 190, 222)} stroke={LO} strokeWidth=".4" opacity=".5" />
        {[NX, 146].map((cx) => (
          <g key={cx}>
            <path d={arch(cx - 11, cx - 2, 203, 221) + arch(cx + 2, cx + 11, 203, 221)} fill={REC} stroke={LN} strokeWidth=".5" />
            <path d={lines(6, (i) => `M${cx - 11} ${206 + i * 2.6}h9M${cx + 2} ${206 + i * 2.6}h9`)} stroke={LO} strokeWidth=".6" />
            <path d={strings(cx - 14, cx + 14, 194, 222)} stroke={HI} strokeWidth=".5" opacity=".75" />
          </g>
        ))}
        {BELL_SLOTS.slice(0, 3).map(([x1, x2, ys, yb]) => <path key={x1} d={arch(x1, x2, ys, yb)} fill={REC} stroke={LN} strokeWidth=".5" />)}
        <path d="M84 202H116" stroke={LN} strokeWidth=".5" opacity=".5" />
        {BELLS.slice(0, 3).map(([cx, t, s]) => <path key={cx} d={bellPath(cx, t, s)} fill="var(--cath-bronze)" stroke={LN} strokeWidth=".45" />)}
        {BUTT.map((x) => <Buttress key={x} x={x} y0={192} y1={224} w={6} />)}
        <rect x="30" y="185" width="140" height="4" fill={HI} stroke={LN} strokeWidth=".6" />
        <path d="M78 185V179H122V185M127 185V179H169V185" fill="none" stroke={LN} strokeWidth=".6" />
        <path d="M78 179H122M127 179H169" stroke={HI} strokeWidth="1.2" />
        <path d={lines(10, (i) => `M${n1(81 + i * 4.3)} 182.2h.01`) + lines(10, (i) => `M${n1(130 + i * 4.1)} 182.2h.01`)} stroke={LN} strokeWidth="1.6" strokeLinecap="round" opacity=".55" />
        <Gargoyle x={30} y={196} dir={-1} />
        <Gargoyle x={170} y={196} dir={1} />
      </g>
    ),
  },
  // south tower top: corner pinnacles and the watchman's house
  {
    y0: 158, y1: 185, node: (
      <g key="south">
        <rect x="139" y="172" width="15" height="12" fill={HI} stroke={LN} strokeWidth=".6" />
        <path d="M137 172.5L146.5 163L156 172.5Z" fill="var(--art-roof)" stroke={LN} strokeWidth=".6" strokeLinejoin="round" />
        <rect x="145" y="177" width="3" height="7" fill={REC} />
        <rect x="141" y="175" width="2.4" height="2.4" fill="var(--cath-door-lit)" opacity=".8" />
        <Pinnacle x={125} base={185} h={20} w={3.2} />
        <Pinnacle x={167} base={185} h={20} w={3.2} />
        <Pinnacle x={79} base={185} h={12} w={2.4} />
        <Pinnacle x={121} base={185} h={12} w={2.4} />
      </g>
    ),
  },
  // north tower octagon with four open stair turrets
  {
    y0: 118, y1: 186, node: (
      <g key="oct">
        <rect x="41" y="132" width="5" height="53" fill={LO} stroke={LN} strokeWidth=".5" />
        <rect x="62" y="132" width="5" height="53" fill={LO} stroke={LN} strokeWidth=".5" />
        <rect x="46" y="132" width="16" height="53" fill={S} stroke={LN} strokeWidth=".7" />
        <path d={courses(46, 62, 136, 182, 5)} stroke={LO} strokeWidth=".35" opacity=".5" />
        <path d={arch(50, 58, 154, 180)} fill={REC} stroke={LN} strokeWidth=".5" />
        <path d={bellPath(NX, 161, 1)} fill="var(--cath-bronze)" stroke={LN} strokeWidth=".45" />
        <circle cx={NX} cy="143" r="2.6" fill={REC} stroke={LN} strokeWidth=".45" />
        <path d={arch(42.2, 44.8, 150, 178) + arch(63.2, 65.8, 150, 178)} fill={REC} />
        {[37, 71].map((x) => (
          <g key={x}>
            <rect x={x - 3} y="136" width="6" height="49" fill={HOLE} stroke={LN} strokeWidth=".6" />
            <path d={lines(8, (i) => `M${x - 3} ${139 + i * 6}L${x + 3} ${142 + i * 6}`)} stroke={LN} strokeWidth=".55" />
            <path d={`M${x - 3} 136V185M${x + 3} 136V185`} stroke={S} strokeWidth="1.3" />
            <Pinnacle x={x} base={137} h={18} w={4.4} />
          </g>
        ))}
        <rect x="39" y="128" width="30" height="4.5" fill={HI} stroke={LN} strokeWidth=".6" />
        <path d={lines(7, (i) => `M${41 + i * 4.2} 130.3h.01`)} stroke={LN} strokeWidth="1.4" strokeLinecap="round" opacity=".55" />
      </g>
    ),
  },
  // openwork spire: five stepped tiers of little stair turrets, then lantern and crown
  ...[128, 116, 104, 92, 80].map((yb, k): Part => {
    const yt = yb - 12, b = hw(yb), t = hw(yt), holes = [4, 3, 3, 2, 2][k];
    const inner = 2 * t - 3, hwid = inner / holes;
    return {
      y0: yt - 6, y1: yb + 1, node: (
        <g key={`sp${k}`}>
          <path d={`M${n1(NX - b)} ${yb}L${n1(NX - t)} ${yt}H${n1(NX + t)}L${n1(NX + b)} ${yb}Z`} fill={S} stroke={LN} strokeWidth=".7" strokeLinejoin="round" />
          <path d={lines(holes, (i) => arch(NX - t + 1.5 + i * hwid + 0.5, NX - t + 1.5 + (i + 1) * hwid - 0.5, yt + 3 + hwid * 0.9, yb - 2))} fill={HOLE} stroke={LN} strokeWidth=".4" />
          <path d={`M${n1(NX - t)} ${yt + 1}H${n1(NX + t)}`} stroke={HI} strokeWidth="1.2" />
          {[-1, 1].map((s) => <Pinnacle key={s} x={n1(NX + s * (t + 0.6))} base={yt + 5} h={10} w={2.2} />)}
        </g>
      ),
    };
  }),
  {
    y0: 36, y1: 69, node: (
      <g key="crown">
        <rect x={NX - 5} y="55" width="10" height="13" fill={S} stroke={LN} strokeWidth=".6" />
        <path d={arch(NX - 3.6, NX - 0.6, 59, 66) + arch(NX + 0.6, NX + 3.6, 59, 66)} fill={HOLE} stroke={LN} strokeWidth=".35" />
        <rect x={NX - 6} y="53.5" width="12" height="2.5" fill={HI} stroke={LN} strokeWidth=".5" />
        <path d={`M${NX - 4.5} 53.5L${NX} 38L${NX + 4.5} 53.5Z`} fill={S} stroke={LN} strokeWidth=".6" strokeLinejoin="round" />
        <path d={`M${NX - 3.2} 47H${NX + 3.2}`} stroke={HI} strokeWidth="1" />
        {[44, 48, 51].flatMap((y) => [-1, 1].map((s) => <circle key={`${y}${s}`} cx={n1(NX + s * (4.5 * (y - 38) / 15.5 + 0.7))} cy={y} r=".6" fill={HI} stroke={LN} strokeWidth=".3" />))}
        <Pinnacle x={NX - 6} base={55} h={8} w={1.8} />
        <Pinnacle x={NX + 6} base={55} h={8} w={1.8} />
      </g>
    ),
  },
];

// Blueprint: every outline of the finished church, drawn faint and dashed.
const BLUEPRINT = [
  "M29 384V185H171V384M75 185V384M125 185V384M29 296H171M29 224H171",
  ...PORTALS.map((p) => arch(p.x1, p.x2, p.ys, YB)),
  "M78 326L100 288L122 326M40 334L54 308L68 334M132 334L146 308L160 334",
  arch(NX - 14, NX + 14, 266, 292, false), arch(132, 160, 266, 292, false),
  arch(NX - 11, NX - 2, 203, 221, false), arch(NX + 2, NX + 11, 203, 221, false), arch(135, 144, 203, 221, false), arch(148, 157, 203, 221, false),
  ...BELL_SLOTS.slice(0, 3).map(([x1, x2, ys, yb]) => arch(x1, x2, ys, yb, false)),
  "M139 184V172H154V184M137 172.5L146.5 163L156 172.5",
  "M41 185V128H67V185M46 132V185M62 132V185M34 185V136H40V185M68 185V136H74V185M34 136L37 119L40 136M68 136L71 119L74 136",
  `M${NX - 17} 128L${NX - 5} 68H${NX + 5}L${NX + 17} 128Z`,
  ...[116, 104, 92, 80].map((y) => `M${n1(NX - hw(y))} ${y}H${n1(NX + hw(y))}`),
  `M${NX - 5} 68V55H${NX + 5}V68M${NX - 4.5} 54L${NX} 38L${NX + 4.5} 54M${NX} 38V18M${NX - 4} 24H${NX + 4}`,
].join("");

const Sparkle = ({ x, y, s = 1, d = 0 }: { x: number; y: number; s?: number; d?: number }) => (
  <path className="cath-sparkle" style={{ animationDelay: `${d}s` }} d={`M${x} ${n1(y - 4 * s)}L${n1(x + s)} ${n1(y - s)}L${n1(x + 4 * s)} ${y}L${n1(x + s)} ${n1(y + s)}L${x} ${n1(y + 4 * s)}L${n1(x - s)} ${n1(y + s)}L${n1(x - 4 * s)} ${y}L${n1(x - s)} ${n1(y - s)}Z`} fill={GOLD} />
);

// Lattice path for the crane (drawn with its jib at local y = 0).
const MAST = `M206 -2V420M212 -2V420${lines(70, (i) => `M206 ${i * 6}L212 ${i * 6 + 6}`)}`;
const JIB = `M38 0H236M38 4H212${lines(29, (i) => `M${40 + i * 6} 4L${43 + i * 6} 0L${46 + i * 6} 4`)}`;

type Anim = { from: number; run: boolean };
const START = 350, DUR = 560;

export default function Cathedral({ ratio, hero = false, className = "" }: { ratio: number; hero?: boolean; className?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const [anim, setAnim] = useState<Anim | null>(null);
  const [settled, setSettled] = useState(false);
  const r = Math.max(0, Math.min(1, ratio || 0));

  // Decide (before first paint after hydration) whether to replay growth since this device last looked.
  useLayoutEffect(() => {
    let last: number | null;
    try {
      const v = localStorage.getItem(KEY);
      last = v === null ? 0 : Number(v);
      localStorage.setItem(KEY, String(r));
    } catch { last = null; }
    if (last === null || !Number.isFinite(last) || last >= r - 1e-6) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    // Intentional: last-seen height lives in localStorage (external, device-only), unknown during SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setAnim({ from: Math.max(0, last), run: false });
  }, [r]);

  // Bands of new stone, bottom to top, cut at every 2.5% so each lands as its own slab.
  const from = anim?.from ?? r;
  const edges = [from];
  for (let k = Math.floor(from * 40) + 1; k / 40 < r - 1e-9; k++) edges.push(k / 40);
  edges.push(r);
  const bands = anim ? edges.slice(1).map((hi, i) => ({ lo: edges[i], hi })) : [];
  const stagger = Math.max(45, Math.min(120, 2600 / Math.max(1, bands.length)));
  const total = START + Math.max(0, bands.length - 1) * stagger + DUR;
  const doneAt = (m: number) => {
    const i = bands.findIndex((b) => b.hi >= m - 1e-9);
    return START + Math.max(0, i) * stagger + DUR;
  };

  useEffect(() => {
    if (!anim) return;
    if (!anim.run) {
      let id2 = 0;
      const id = requestAnimationFrame(() => { id2 = requestAnimationFrame(() => setAnim((a) => (a ? { ...a, run: true } : a))); });
      return () => { cancelAnimationFrame(id); cancelAnimationFrame(id2); };
    }
    const t = setTimeout(() => { setAnim(null); setSettled(true); }, total + 2200);
    return () => clearTimeout(t);
  }, [anim, total]);

  const running = !!anim?.run;
  // Odile in her nest on the finished spire: cheers while landing, then idles quietly
  const nestIdle = useOdileIdle(r >= 1 && !running ? "perch" : null);
  const shownR = anim && !anim.run ? anim.from : r; // what the crane/base show right now
  const baseY = yAt(anim ? anim.from : r);
  const builtY = yAt(r);
  // Milestone state: off, static (already seen), or animating (crossed in this replay).
  const ms = (m: number): { on: boolean; cls: string; style?: CSSProperties } => {
    if (r < m - 1e-9) return { on: false, cls: "" };
    if (anim && anim.from < m - 1e-9) return anim.run ? { on: true, cls: "is-new", style: { animationDelay: `${doneAt(m)}ms` } } : { on: false, cls: "" };
    return { on: true, cls: "" };
  };
  const m25 = ms(0.25), m50 = ms(0.5), m75 = ms(0.75), m100 = ms(1);

  const partsIn = (y0: number, y1: number) => PARTS.filter((p) => p.y1 > y0 && p.y0 < y1).map((p) => p.node);
  const silhouette = (y: number): [number, number] => (y > 186 ? [29, 171] : y > 128 ? [33, 75] : [NX - hw(y) - 2, NX + hw(y) + 2]);

  // Crane: block on the hook sits on the build line; trolley over the facade, then over the north tower.
  const craneY = Math.min(yAt(shownR) - 30, 330);
  const hookX = yAt(shownR) > 186 ? 100 : NX;
  const showCrane = r < 1 || running;
  const craneMs = running ? Math.max(600, total - START) : 0;
  const craneStyle = (t: string): CSSProperties => ({ transform: t, transition: running ? `transform ${craneMs}ms cubic-bezier(.45,.05,.35,1) ${START}ms` : undefined });

  const meters = Math.round(r * SPIRE_M);
  const gained = anim ? meters - Math.round(anim.from * SPIRE_M) : 0;
  const label = r >= 1
    ? `Strasbourg Cathedral, complete: ${SPIRE_M} of ${SPIRE_M} metres built. Odile the stork is on top.`
    : `Strasbourg Cathedral under construction: ${meters} of ${SPIRE_M} metres built, ${Math.round(r * 100)}% of the group goal.`;

  // Scaffolding around the course being built (rest state only).
  const scaffold = (() => {
    if (r >= 1 || anim) return null;
    const [x1, x2] = silhouette(builtY - 1);
    const top = Math.max(20, builtY - 22), bot = builtY + 6;
    const xs = [x1 - 3, ...Array.from({ length: Math.max(1, Math.round((x2 - x1) / 24)) - 1 }, (_, i) => x1 + ((i + 1) * (x2 - x1)) / Math.max(1, Math.round((x2 - x1) / 24))), x2 + 3];
    let d = xs.map((x) => `M${n1(x)} ${n1(top)}V${n1(bot)}`).join("");
    for (let y = bot - 4; y > top; y -= 9) d += `M${n1(x1 - 5)} ${n1(y)}H${n1(x2 + 5)}`;
    for (let i = 0; i < xs.length - 1; i++) d += `M${n1(xs[i])} ${n1(bot - 4)}L${n1(xs[i + 1])} ${n1(Math.max(top, bot - 13))}`;
    return <path className={settled ? "cath-fade-in" : ""} d={d} stroke="var(--cath-scaffold)" strokeWidth=".9" strokeLinecap="round" fill="none" />;
  })();

  return (
    <div className={`cath relative ${className}`}>
      <svg viewBox="0 0 240 400" className="block h-auto w-full" role="img" aria-label={label}>
        <defs>
          <clipPath id={`${uid}-base`}><rect x="0" y={n1(baseY)} width="240" height={n1(400 - baseY)} /></clipPath>
          {bands.map((b, i) => <clipPath key={i} id={`${uid}-b${i}`}><rect x="0" y={n1(yAt(b.hi))} width="240" height={n1(yAt(b.lo) - yAt(b.hi) + 0.3)} /></clipPath>)}
          <radialGradient id={`${uid}-halo`}><stop offset="0" stopColor={GOLD} stopOpacity=".6" /><stop offset=".55" stopColor={GOLD} stopOpacity=".18" /><stop offset="1" stopColor={GOLD} stopOpacity="0" /></radialGradient>
        </defs>

        {/* blueprint of the whole church */}
        <path d={lines(14, (i) => `M18 ${28 + i * 26}H182`) + lines(7, (i) => `M${22 + i * 26} 14V384`)} stroke="var(--cath-blueprint)" strokeWidth=".4" opacity=".14" />
        <path d={BLUEPRINT} fill="none" stroke="var(--cath-blueprint)" strokeWidth=".7" strokeDasharray="2.2 1.6" opacity=".7" />
        <path d={`M${NX} 384V14`} stroke="var(--cath-blueprint)" strokeWidth=".4" strokeDasharray=".8 2" opacity=".5" />

        {m100.on && <circle className={m100.cls && "cath-halo-in"} style={m100.style} cx="72" cy="104" r="80" fill={`url(#${uid}-halo)`} />}

        {/* built stone */}
        <g clipPath={`url(#${uid}-base)`}>{partsIn(baseY, 400)}</g>
        {running && bands.map((b, i) => {
          const y0 = yAt(b.hi), y1 = yAt(b.lo);
          const [sx1, sx2] = silhouette(y1 - 0.5);
          return (
            <g key={i} className="cath-band" style={{ animationDelay: `${START + i * stagger}ms` }}>
              <g clipPath={`url(#${uid}-b${i})`}>{partsIn(y0, y1)}</g>
              <rect className="cath-seam" style={{ animationDelay: `${START + i * stagger}ms` }} x={n1(sx1)} y={n1(y1 - 1.2)} width={n1(sx2 - sx1)} height="2.4" rx="1.2" fill={GOLD} />
            </g>
          );
        })}

        {/* 25%: portals open, warm light inside */}
        {m25.on && (
          <g className={m25.cls && "cath-glow-in"} style={m25.style}>
            {PORTALS.map((p) => { const d = doorBox(p); return (
              <g key={p.x1}>
                <rect x={n1(d.x)} y={d.y} width={n1(d.w)} height={YB - d.y} fill="var(--cath-door-lit)" />
                <path d={`M${n1(d.x)} ${d.y}l2 1.5V${YB}h-2ZM${n1(d.x + d.w)} ${d.y}l-2 1.5V${YB}h2Z`} fill="var(--cath-door)" />
              </g>
            ); })}
            <ellipse cx="100" cy="376" rx="34" ry="3" fill="var(--cath-door-lit)" opacity=".45" />
          </g>
        )}

        {/* 50%: the rose window lights up in stained glass */}
        {m50.on && (
          <g>
            <g className={m50.cls && "cath-rose-in"} style={m50.style}>
              <circle cx={RX} cy={RY} r="18.6" fill="var(--glass-blue)" opacity=".85" />
              {Array.from({ length: ROSE_N }, (_, k) => <path key={k} d={petal(RX, RY, (k / ROSE_N) * Math.PI * 2 - Math.PI / 2, 6.5, 17.6, 2.1)} fill={GLASS[k % GLASS.length]} />)}
              <path d={roseInner} fill="var(--glass-gold)" />
              <path d={roseTracery + roseInner} fill="none" stroke={HI} strokeWidth=".7" strokeLinejoin="round" />
              <circle cx={RX} cy={RY} r="6.4" fill="none" stroke={HI} strokeWidth=".8" />
              <circle cx={RX} cy={RY} r="2.4" fill={GOLD} stroke={LN} strokeWidth=".4" />
              <path d={`M${RX - 9} ${RY - 12}q4 -3 8 -3`} stroke="#fff" strokeOpacity=".55" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            </g>
            {m50.cls && <circle className="cath-burst" style={m50.style} cx={RX} cy={RY} r="20" fill="none" stroke={GOLD} strokeWidth="2" />}
          </g>
        )}

        {/* 75%: bells ring */}
        {m75.on && (
          <g>
            {BELL_SLOTS.map(([x1, x2, ys, yb]) => <path key={x1} d={arch(x1, x2, ys, yb)} fill={REC} />)}
            <path d={lines(6, (i) => `M${NX - 11} ${206 + i * 2.6}h9M${NX + 2} ${206 + i * 2.6}h9M135 ${206 + i * 2.6}h9M148 ${206 + i * 2.6}h9`)} stroke={LO} strokeWidth=".6" />
            {BELLS.map(([cx, t, s], i) => (
              <g key={i}>
                <circle className={m75.cls && "cath-glow-in"} style={m75.style} cx={cx} cy={t + 4.5 * s} r={6 * s} fill={GOLD} opacity=".35" />
                <g className={`cath-bell ${m75.cls && "cath-ring"}`} style={m75.cls ? { animationDelay: `${doneAt(0.75) + i * 120}ms` } : undefined}>
                  <path d={bellPath(cx, t, s)} fill={GOLD} stroke={LN} strokeWidth=".45" />
                  <circle cx={cx} cy={n1(t + 8.3 * s)} r={n1(0.9 * s)} fill={LN} />
                </g>
              </g>
            ))}
            <g className={m75.cls && "cath-glow-in"} style={m75.style} fill="none" stroke={GOLD} strokeWidth=".9" strokeLinecap="round">
              <path d="M79 205q-3 5 0 10M76 203q-4.5 7 0 14M121 205q3 5 0 10M124 203q4.5 7 0 14" />
              <path d={`M${NX - 13} 159q-3 5 0 10M${NX + 13} 159q3 5 0 10`} />
            </g>
          </g>
        )}

        {/* 100%: cross, Odile in her nest, sparkles */}
        {m100.on && (
          <g>
            <g className={m100.cls && "cath-drop-in"} style={m100.style}>
              <circle cx={NX} cy="37.5" r="1.8" fill={GOLD} stroke={LN} strokeWidth=".4" />
              <path d={`M${NX - 0.9} 36V17.5h1.8V36ZM${NX - 4.5} 22.4h9v1.8h-9Z`} fill={GOLD} stroke={LN} strokeWidth=".4" />
            </g>
            <g className={m100.cls && "cath-land"} style={m100.cls ? { animationDelay: `${doneAt(1) + 350}ms` } : undefined}>
              <ellipse cx="146.5" cy="163.2" rx="10" ry="3.2" fill="var(--art-beam)" stroke={LN} strokeWidth=".4" />
              <path d="M137.5 162.5l18 1.4M138 164.2l17-1.6M140 161.6l14 3" stroke={LN} strokeWidth=".4" opacity=".6" />
              <g transform="translate(130.5 125.6) scale(.26)"><Stork mood={running ? "cheer" : "happy"} size={150} live className={nestIdle.className} style={nestIdle.style} /></g>
            </g>
            <g className={m100.cls && "cath-glow-in"} style={m100.style}>
              <Sparkle x={NX - 13} y={28} s={1.1} d={0} />
              <Sparkle x={NX + 14} y={20} s={1.4} d={0.6} />
              <Sparkle x={NX + 22} y={52} s={0.9} d={1.2} />
              <Sparkle x={NX - 20} y={66} s={1} d={1.7} />
              <Sparkle x={128} y={124} s={1.1} d={0.9} />
              <Sparkle x={170} y={140} s={0.9} d={1.5} />
              <Sparkle x={100} y={232} s={0.8} d={2} />
            </g>
            {m100.cls && Array.from({ length: 14 }, (_, i) => (
              <g key={i} transform={`rotate(${i * (360 / 14)} ${NX} 28)`}>
                <rect className={`cath-confetti ${i % 2 ? "far" : ""}`} style={{ animationDelay: `${doneAt(1) + 150 + (i % 3) * 60}ms` }} x={NX - 1} y="26" width="2" height="3.4" rx=".5" fill={["var(--glass-red)", "var(--glass-blue)", GOLD, "var(--accent)"][i % 4]} />
              </g>
            ))}
          </g>
        )}

        {scaffold}

        {/* crane */}
        {showCrane && (
          <g className={running && r >= 1 ? "cath-crane-leave" : ""} style={running && r >= 1 ? { animationDelay: `${total + 300}ms` } : undefined}>
            <g style={craneStyle(`translateY(${n1(craneY)}px)`)}>
              <path d={MAST} stroke="var(--cath-crane)" strokeWidth=".8" fill="none" />
              <path d={JIB} stroke="var(--cath-crane)" strokeWidth=".8" fill="none" strokeLinejoin="round" />
              <path d="M209 -14L206 -2M209 -14L212 -2M209 -14L40 0M209 -14L236 0" stroke="var(--cath-crane)" strokeWidth=".55" fill="none" />
              <rect x="212" y="4" width="8" height="7" rx="1" fill="var(--cath-crane)" stroke={LN} strokeWidth=".4" />
              <rect x="214" y="5.5" width="4" height="3" fill="var(--cath-door-lit)" />
              <rect x="226" y="1.5" width="10" height="8" fill="var(--cath-stone-lo)" stroke={LN} strokeWidth=".4" />
              <g style={craneStyle(`translateX(${hookX}px)`)}>
                <rect x="-3.5" y="3.5" width="7" height="3" rx=".8" fill="var(--cath-crane)" stroke={LN} strokeWidth=".4" />
                <g className="cath-hook">
                  <path d="M0 6.5V20M-4 24L0 20.5L4 24" stroke={LN} strokeWidth=".55" fill="none" />
                  <rect x="-5" y="24" width="10" height="6" fill={S} stroke={LN} strokeWidth=".6" />
                  <path d="M-5 27H5M0 24V27" stroke={LO} strokeWidth=".4" />
                </g>
              </g>
            </g>
          </g>
        )}

        {/* ground */}
        <rect x="0" y="384" width="240" height="16" fill="var(--cath-ground)" />
        <path d="M0 384.3H240" stroke={LN} strokeWidth=".6" opacity=".5" />
        <path d={lines(16, (i) => `M${6 + i * 15} 390h6M${12 + i * 15} 395h5`)} stroke={LN} strokeWidth=".5" opacity=".18" />
        {r < 1 && (
          <g>
            <rect x="182" y="378" width="9" height="6" fill={S} stroke={LN} strokeWidth=".5" />
            <rect x="191" y="378" width="9" height="6" fill={HI} stroke={LN} strokeWidth=".5" />
            <rect x="186.5" y="372" width="9" height="6" fill={S} stroke={LN} strokeWidth=".5" />
          </g>
        )}

        {/* milestone ticks (hero only) */}
        {hero && MILESTONES.map((m) => {
          const y = n1(m.at >= 1 ? 22 : yAt(m.at)), got = r >= m.at - 1e-9;
          return (
            <g key={m.at}>
              <path d={`M15 ${y}H27`} stroke={got ? GOLD : "var(--cath-blueprint)"} strokeWidth="1" strokeDasharray={got ? undefined : "1.5 1.2"} />
              <circle cx="12" cy={y} r="3.2" fill={got ? GOLD : "var(--surface)"} stroke={got ? LN : "var(--cath-blueprint)"} strokeWidth=".6" />
              {got && <path d={`M10.4 ${y}l1.1 1.2l2.2-2.4`} stroke={LN} strokeWidth=".8" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
              <text x="12" y={y - 5.5} textAnchor="middle" fontSize="6.5" fontWeight="800" fill={got ? "var(--foreground)" : "var(--muted)"}>{Math.round(m.at * 100)}%</text>
            </g>
          );
        })}
      </svg>
      {running && gained > 0 && (
        <span aria-hidden="true" className="cath-badge pointer-events-none absolute right-1 top-1 rounded-full bg-accent px-2 py-0.5 text-xs font-extrabold text-[#2b2118] shadow-sm" style={{ animationDelay: `${START}ms` }}>
          +{gained} m
        </span>
      )}
    </div>
  );
}
