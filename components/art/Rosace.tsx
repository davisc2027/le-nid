// La Rosace: a rose window whose petals fill with stained glass as verses are learned.
const GLASS = ["#2d4f8f", "#b3282d", "#d9a21b", "#2f7d5a", "#6b3f8f", "#c8641b"];
const PETAL = "M0 -24 C 20 -42, 22 -70, 0 -82 C -22 -70, -20 -42, 0 -24 Z";

/**
 * `growing` (0..1) is how far the verse being learned has come: the next petal grows from its base as the learner
 * moves along the mastery path, and becomes a full petal once the verse is learned.
 */
export default function Rosace({ filled, total, size = 220, growing = 0 }: { filled: number; total: number; size?: number; growing?: number }) {
  const n = Math.min(12, Math.max(6, total));
  const lit = Math.min(filled, n);
  const g = Math.max(0, Math.min(1, growing));
  return (
    <svg viewBox="-100 -100 200 200" width={size} height={size} role="img"
      aria-label={`${filled} verses learned${g > 0 && lit < n ? `, next verse ${Math.round(g * 100)}% of the way` : ""}`} className="rosace">
      <defs>
        <radialGradient id="glow"><stop offset="0" stopColor="#f6c58a" stopOpacity="0.75" /><stop offset="1" stopColor="#f6c58a" stopOpacity="0" /></radialGradient>
      </defs>
      <circle r="98" fill="url(#glow)" />
      <circle r="92" fill="none" stroke="var(--foreground)" strokeWidth="3" />
      <circle r="86" fill="var(--surface)" opacity="0.5" />
      {Array.from({ length: n }, (_, k) => {
        const on = k < lit;
        const grow = !on && k === lit && g > 0;
        return (
          <g key={k} transform={`rotate(${(k * 360) / n})`}>
            {grow && (
              <path d={PETAL} fill={GLASS[k % GLASS.length]} fillOpacity={0.55}
                transform={`translate(0 -24) scale(${0.2 + 0.8 * g}) translate(0 24)`} style={{ transition: "transform .6s ease-out" }} className="motion-reduce:!transition-none" />
            )}
            <path d={PETAL}
              fill={on ? GLASS[k % GLASS.length] : "none"} fillOpacity={on ? 0.92 : 0}
              stroke="var(--foreground)" strokeWidth="2.4" strokeOpacity={on || grow ? 1 : 0.35} className={on ? "petal-on" : ""} />
            {on && <path d="M0 -34 C 8 -46, 9 -60, 0 -70" stroke="#fff" strokeOpacity="0.45" strokeWidth="2" fill="none" strokeLinecap="round" />}
            <circle cx="0" cy="-90" r="2.6" fill="var(--foreground)" opacity={on ? 0.9 : 0.3} transform={`rotate(${180 / n})`} />
          </g>
        );
      })}
      <circle r="18" fill="#d9a21b" stroke="var(--foreground)" strokeWidth="2.6" />
      <path d="M0 -10 L3 -3 L10 0 L3 3 L0 10 L-3 3 L-10 0 L-3 -3 Z" fill="#fff6d8" opacity="0.85" />
    </svg>
  );
}

/** One Rosace petal that fills from its base as `value` (0..1) grows; full glass with a highlight once mastered. */
export function PetalMeter({ value, size = 32, color = 0, mastered = false, label }: { value: number; size?: number; color?: number; mastered?: boolean; label?: string }) {
  const v = mastered ? 1 : Math.max(0, Math.min(1, value));
  const glass = GLASS[color % GLASS.length];
  return (
    <svg viewBox="-26 -86 52 66" width={size * (52 / 66)} height={size} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="shrink-0">
      {v > 0 && (
        <path d={PETAL} fill={glass} fillOpacity={mastered ? 0.95 : 0.4 + 0.5 * v}
          transform={`translate(0 -24) scale(${0.15 + 0.85 * v}) translate(0 24)`} style={{ transition: "transform .6s ease-out" }} className="motion-reduce:!transition-none" />
      )}
      <path d={PETAL} fill="none" stroke="var(--foreground)" strokeWidth="3" strokeOpacity={v > 0 ? 0.9 : 0.4} />
      {mastered && <path d="M0 -34 C 8 -46, 9 -60, 0 -70" stroke="#fff" strokeOpacity="0.6" strokeWidth="3" fill="none" strokeLinecap="round" />}
    </svg>
  );
}
