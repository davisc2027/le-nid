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
    case "u5": // clock tower (numbers and time)
      return (<g {...common}>
        <rect x="26" y="20" width="28" height="50" fill="var(--art-stone)" /><path d="M22 20L40 4l18 16Z" fill="var(--art-roof)" />
        <circle cx="40" cy="36" r="10" fill="#fff6d8" /><path d="M40 36v-7M40 36l5 3" strokeWidth="1.6" />
        <rect x="34" y="54" width="12" height="16" rx="6" fill="var(--art-beam)" /><path d="M2 70h76" />
      </g>);
    case "u6": // market stall with pretzel
      return (<g {...common}>
        <path d="M6 30h68l-6-16H12Z" fill="#f4f1ea" /><path d="M24 14l-4 16M40 14v16M56 14l4 16" stroke="#c0392b" strokeWidth="5" />
        <path d="M6 30h68l-6-16H12Z" fill="none" /><path d="M12 30v38M68 30v38" />
        <rect x="8" y="48" width="64" height="20" fill="var(--art-beam)" />
        <path d="M30 44c-8 0-8-10 0-10s10 10 10 10 2-10 10-10 8 10 0 10M32 44l16-6M48 44L32 38" fill="none" stroke="#b5733a" strokeWidth="2.6" />
      </g>);
    case "u7": // hostel facade with lit windows
      return (<g {...common}>
        <rect x="14" y="16" width="52" height="54" fill="var(--art-wall)" /><path d="M10 16h60l-6-10H16Z" fill="var(--art-roof-2)" />
        <rect x="20" y="24" width="12" height="10" fill="var(--art-window)" /><rect x="48" y="24" width="12" height="10" fill="var(--art-glow)" />
        <rect x="20" y="40" width="12" height="10" fill="var(--art-glow)" /><rect x="48" y="40" width="12" height="10" fill="var(--art-window)" />
        <rect x="34" y="52" width="12" height="18" fill="var(--art-beam)" /><path d="M36 22h8M40 22v8" strokeWidth="1.6" />
      </g>);
    case "u8": // pharmacy green cross sign
      return (<g {...common}>
        <path d="M40 4v10" fill="none" /><rect x="10" y="44" width="60" height="26" fill="var(--art-wall)" />
        <path d="M32 14h16v10h10v16H48v10H32V40H22V24h10Z" fill="#3fa35b" transform="translate(0 -4) scale(1 0.9)" />
        <rect x="16" y="52" width="20" height="18" fill="var(--art-window)" /><rect x="44" y="52" width="20" height="18" fill="var(--art-window)" />
      </g>);
    case "u9": // two friends talking
      return (<g {...common}>
        <circle cx="24" cy="38" r="8" fill="#f2c9a0" /><path d="M12 70c0-14 6-20 12-20s12 6 12 20Z" fill="#7aa6c9" />
        <circle cx="56" cy="38" r="8" fill="#d9a27a" /><path d="M44 70c0-14 6-20 12-20s12 6 12 20Z" fill="#e0a458" />
        <path d="M30 8h22a4 4 0 0 1 4 4v8a4 4 0 0 1-4 4H40l-6 5v-5h-4a4 4 0 0 1-4-4v-8a4 4 0 0 1 4-4Z" fill="#fff6d8" />
        <path d="M34 16h14" strokeWidth="1.4" />
      </g>);
    case "u10": // Petite France half-timbered house on the canal
      return (<g {...common}>
        <rect x="18" y="26" width="44" height="36" fill="var(--art-wall)" /><path d="M14 26L40 4l26 22Z" fill="var(--art-roof)" />
        <path d="M18 38h44M18 50h44M30 26v36M50 26v36M18 26l12 12M62 26L50 38" fill="none" stroke="var(--art-beam)" strokeWidth="2" />
        <rect x="35" y="42" width="10" height="8" fill="var(--art-window)" /><rect x="36" y="16" width="8" height="6" fill="var(--art-window)" />
        <path d="M0 62h80v14H0Z" fill="var(--art-water)" /><path d="M10 68h10M44 70h12" fill="none" strokeWidth="1.2" />
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
