"use client";

import { useId } from "react";
import type { Lang } from "@/lib/gospel";

export type CircleLabels = { design: string; brokenness: string; gospel: string; believe: string; recover: string };

/** Greedy word wrap for text inside a circle. */
function wrap(text: string, max: number) {
  const lines: string[] = [];
  let cur = "";
  for (const w of text.trim().split(/\s+/)) {
    if (cur && (cur + " " + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + " " + w : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

const FIRST: Record<Lang, string> = {
  en: "Nothing drawn yet. The three circles will build up one step at a time.",
  fr: "Rien n'est dessiné pour l'instant. Les trois cercles vont apparaître étape par étape.",
};
function describe(step: number, l: CircleLabels, lang: Lang) {
  if (step <= 0) return FIRST[lang];
  const en = [
    "",
    `One circle: ${l.design}.`,
    `Two circles: ${l.design} at the top and ${l.brokenness}, with cracks, below it, joined by an arrow.`,
    `Three circles: ${l.design}, ${l.brokenness} and ${l.gospel}, which has a cross in it.`,
    `An arrow from ${l.brokenness} to ${l.gospel}, labelled ${l.believe}.`,
    `An arrow from ${l.gospel} back up to ${l.design}, labelled ${l.recover}.`,
  ];
  const fr = [
    "",
    `Un cercle : ${l.design}.`,
    `Deux cercles : ${l.design} en haut, et ${l.brokenness}, avec des fissures, en dessous, reliés par une flèche.`,
    `Trois cercles : ${l.design}, ${l.brokenness} et ${l.gospel}, qui contient une croix.`,
    `Une flèche de ${l.brokenness} vers ${l.gospel}, intitulée ${l.believe}.`,
    `Une flèche de ${l.gospel} qui remonte vers ${l.design}, intitulée ${l.recover}.`,
  ];
  return (lang === "fr" ? fr : en)[Math.min(step, 5)];
}

function Label({ text, x, cy, fill, size = 14 }: { text: string; x: number; cy: number; fill: string; size?: number }) {
  const lines = wrap(text, 11).slice(0, 3);
  const longest = Math.max(...lines.map((s) => s.length), 1);
  const fs = Math.max(9.5, Math.min(size, 108 / (longest * 0.64)));
  const lh = fs * 1.28;
  return (
    <text textAnchor="middle" fontSize={fs} fontWeight={900} fill={fill}>
      {lines.map((s, i) => <tspan key={i} x={x} y={cy + (i - (lines.length - 1) / 2) * lh + fs * 0.35}>{s}</tspan>)}
    </text>
  );
}

/**
 * The Three Circles drawing as inline SVG (works offline, no images). `step` 0..5 builds it up: 0 start, 1 design,
 * 2 brokenness, 3 gospel, 4 repent and believe arrow, 5 recover and pursue arrow. Colours come from the --cc-* tokens
 * so it follows light and dark mode; fades are switched off for reduced motion.
 */
export default function CirclesDiagram({ step, lang, labels, compact = false, className = "" }: {
  step: number; lang: Lang; labels: CircleLabels; compact?: boolean; className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const on = (n: number) => (step >= n ? "cc-part cc-on" : "cc-part");
  const arrowLines = wrap(labels.recover, 11).slice(0, 3);
  return (
    <svg viewBox="0 0 320 350" role="img" aria-label={compact ? labels.design : describe(step, labels, lang)} className={`block h-auto w-full ${className}`} data-step={step}>
      <defs>
        <marker id={`ah-${id}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor" /></marker>
      </defs>
      {/* faint guide so the first step is not an empty box */}
      <g aria-hidden="true" opacity={step === 0 ? 0.35 : 0} className="transition-opacity motion-reduce:transition-none" fill="none" stroke="var(--border)" strokeWidth="3" strokeDasharray="2 7" strokeLinecap="round">
        <circle cx="160" cy="70" r="60" /><circle cx="70" cy="250" r="60" /><circle cx="250" cy="250" r="60" />
      </g>
      <g className={on(1)}>
        <circle cx="160" cy="70" r="60" fill="var(--cc-design-fill)" stroke="var(--cc-design-line)" strokeWidth="3" />
        {!compact && <Label text={labels.design} x={160} cy={70} fill="var(--cc-design-text)" />}
      </g>
      <g className={on(2)}>
        <circle cx="70" cy="250" r="60" fill="var(--cc-broken-fill)" stroke="var(--cc-broken-line)" strokeWidth="3" />
        <path d="M34 214l12 10-8 9 12 7M98 204l-8 14 10 6-8 12" stroke="var(--cc-broken-line)" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".75" />
        {!compact && <Label text={labels.brokenness} x={70} cy={262} fill="var(--cc-broken-text)" />}
      </g>
      <g className={on(2)} style={{ color: "var(--cc-broken-line)" }}>
        <path d="M118 118C98 146 86 168 80 186" stroke="currentColor" strokeWidth="3.5" fill="none" markerEnd={`url(#ah-${id})`} />
      </g>
      <g className={on(3)}>
        <circle cx="250" cy="250" r="60" fill="var(--cc-gospel-fill)" stroke="var(--cc-gospel-line)" strokeWidth="3" />
        <path d="M250 204v30M236 216h28" stroke="var(--cc-gospel-text)" strokeWidth="6" strokeLinecap="round" />
        {!compact && <Label text={labels.gospel} x={250} cy={266} fill="var(--cc-gospel-text)" />}
      </g>
      <g className={on(4)} style={{ color: "var(--cc-believe)" }}>
        <path d="M136 250H184" stroke="currentColor" strokeWidth="4" fill="none" markerEnd={`url(#ah-${id})`} />
        {!compact && (<>
          <path d="M160 262V322" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 4" fill="none" />
          <text x="160" y="340" textAnchor="middle" fontSize="13" fontWeight={900} fill="currentColor">{labels.believe}</text>
        </>)}
      </g>
      <g className={on(5)} style={{ color: "var(--cc-recover)" }}>
        <path d="M252 186C262 150 236 126 210 112" stroke="currentColor" strokeWidth="3.5" fill="none" markerEnd={`url(#ah-${id})`} />
        {!compact && (
          <text textAnchor="middle" fontSize="11.5" fontWeight={900} fill="currentColor">
            {arrowLines.map((s, i) => <tspan key={i} x={280} y={104 + i * 14}>{s}</tspan>)}
          </text>
        )}
      </g>
    </svg>
  );
}
