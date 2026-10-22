// La Rosace: a rose window whose petals fill with stained glass as verses are learned.
const GLASS = ["#2d4f8f", "#b3282d", "#d9a21b", "#2f7d5a", "#6b3f8f", "#c8641b"];

export default function Rosace({ filled, total, size = 220 }: { filled: number; total: number; size?: number }) {
  const n = Math.min(12, Math.max(6, total));
  const lit = Math.min(filled, n);
  return (
    <svg viewBox="-100 -100 200 200" width={size} height={size} role="img" aria-label={`${filled} verses learned`} className="rosace">
      <defs>
        <radialGradient id="glow"><stop offset="0" stopColor="#f6c58a" stopOpacity="0.75" /><stop offset="1" stopColor="#f6c58a" stopOpacity="0" /></radialGradient>
      </defs>
      <circle r="98" fill="url(#glow)" />
      <circle r="92" fill="none" stroke="var(--foreground)" strokeWidth="3" />
      <circle r="86" fill="var(--surface)" opacity="0.5" />
      {Array.from({ length: n }, (_, k) => {
        const on = k < lit;
        return (
          <g key={k} transform={`rotate(${(k * 360) / n})`}>
            <path d="M0 -24 C 20 -42, 22 -70, 0 -82 C -22 -70, -20 -42, 0 -24 Z"
              fill={on ? GLASS[k % GLASS.length] : "none"} fillOpacity={on ? 0.92 : 0}
              stroke="var(--foreground)" strokeWidth="2.4" strokeOpacity={on ? 1 : 0.35} className={on ? "petal-on" : ""} />
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
