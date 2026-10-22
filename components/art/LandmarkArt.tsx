// One small illustration per French unit. Gray until the unit is finished, then it fills with color.
const common = { stroke: "var(--foreground)", strokeWidth: 2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

function Scene({ unit }: { unit: string }) {
  switch (unit) {
    case "u1": // Gare Centrale glass dome + clock
      return (<g {...common}>
        <path d="M6 64V44a34 34 0 0 1 68 0v20Z" fill="#9fc6e0" />
        <path d="M40 10v54M20 18l12 46M60 18L48 64M10 40h60" fill="none" strokeWidth="1.2" />
        <rect x="2" y="62" width="76" height="10" fill="var(--art-stone)" />
        <circle cx="40" cy="28" r="7" fill="#fff6d8" /><path d="M40 28v-4M40 28l3 2" strokeWidth="1.4" />
      </g>);
    case "u2": // tram
      return (<g {...common}>
        <path d="M20 14h40M40 14v10" fill="none" strokeWidth="1.6" />
        <rect x="6" y="24" width="68" height="30" rx="10" fill="#d94a4a" />
        <rect x="12" y="30" width="14" height="12" rx="2" fill="#cfe6f5" /><rect x="30" y="30" width="14" height="12" rx="2" fill="#cfe6f5" /><rect x="48" y="30" width="14" height="12" rx="2" fill="#cfe6f5" />
        <circle cx="20" cy="58" r="5" fill="var(--foreground)" /><circle cx="60" cy="58" r="5" fill="var(--foreground)" />
        <path d="M0 66h80" strokeWidth="2.4" />
      </g>);
    case "u3": // winstub cafe
      return (<g {...common}>
        <rect x="8" y="30" width="64" height="38" fill="var(--art-wall)" />
        <path d="M4 30h72l-6-14H10Z" fill="#b3282d" /><path d="M22 16l-4 14M40 16v14M58 16l4 14" strokeWidth="1.4" />
        <rect x="16" y="38" width="20" height="30" fill="#8a5a3a" /><rect x="44" y="38" width="22" height="16" fill="#cfe6f5" />
        <path d="M52 62h14M55 62v6M63 62v6" /><path d="M56 30c-3-4 3-6 0-10" fill="none" strokeWidth="1.2" />
      </g>);
    default: // cathedral
      return (<g {...common}>
        <path d="M24 70V36h14V70ZM38 36L31 4L24 36Z" fill="var(--art-stone)" transform="translate(8 0)" />
        <rect x="46" y="44" width="22" height="26" fill="var(--art-stone)" /><rect x="10" y="50" width="16" height="20" fill="var(--art-stone)" />
        <circle cx="57" cy="54" r="6" fill="#9fc6e0" /><path d="M57 48v12M51 54h12" strokeWidth="1" />
      </g>);
  }
}

export default function LandmarkArt({ unit, progress, size = 64 }: { unit: string; progress: number; size?: number }) {
  return (
    <svg viewBox="0 0 80 76" width={size} height={size * 0.95} aria-hidden="true" className="shrink-0 transition-[filter,opacity]"
      style={{ filter: `grayscale(${1 - progress})`, opacity: 0.45 + 0.55 * progress }}>
      <Scene unit={unit} />
      {progress >= 1 && <path d="M70 6l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#f0a04b" />}
    </svg>
  );
}
