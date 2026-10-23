// One small illustration per French unit. Gray until the unit is finished, then it fills with color.
const common = { stroke: "var(--foreground)", strokeWidth: 2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

function Scene({ unit }: { unit: string }) {
  switch (unit) {
    case "u0": // a ringing church bell (first sounds of French)
      return (<g {...common}>
        <path d="M18 8h44" fill="none" strokeWidth="3" /><path d="M36 8h8v7h-8Z" fill="var(--art-beam)" />
        <path d="M20 54c4-4 5-10 5-20 0-11 7-19 15-19s15 8 15 19c0 10 1 16 5 20Z" fill="#e0b04a" />
        <path d="M27 44h26" fill="none" strokeWidth="1.4" /><circle cx="40" cy="60" r="5" fill="var(--art-beam)" />
        <path d="M11 26c-5 7-5 17 0 24M17 30c-3 5-3 11 0 16M69 26c5 7 5 17 0 24M63 30c3 5 3 11 0 16" fill="none" strokeWidth="1.6" />
        <path d="M2 72h76" />
      </g>);
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
    case "u11": // two speech bubbles: a question and an answer (understanding each other)
      return (<g {...common}>
        <path d="M8 10h34a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4H22l-8 7v-7h-6a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4Z" fill="#fff6d8" />
        <path d="M21 17a4 4 0 1 1 5 4v3M26 28v.5" fill="none" strokeWidth="2.2" />
        <path d="M38 38h34a4 4 0 0 1 4 4v14a4 4 0 0 1-4 4h-6v7l-8-7H38a4 4 0 0 1-4-4V42a4 4 0 0 1 4-4Z" fill="#9fc6e0" />
        <path d="M44 46h22M44 52h14" fill="none" strokeWidth="1.6" />
      </g>);
    case "u12": // three friends side by side (who we are)
      return (<g {...common}>
        <circle cx="20" cy="34" r="7" fill="#f2c9a0" /><path d="M9 70c0-13 5-19 11-19s11 6 11 19Z" fill="#e0a458" />
        <circle cx="60" cy="34" r="7" fill="#8a5a3a" /><path d="M49 70c0-13 5-19 11-19s11 6 11 19Z" fill="#7aa6c9" />
        <circle cx="40" cy="28" r="8" fill="#d9a27a" /><path d="M27 70c0-15 6-22 13-22s13 7 13 22Z" fill="#d94a4a" />
        <path d="M2 70h76" />
      </g>);
    case "u13": // open Bible with a ribbon
      return (<g {...common}>
        <path d="M40 22c-8-5-20-6-32-4v44c12-2 24-1 32 4Z" fill="#fff6d8" /><path d="M40 22c8-5 20-6 32-4v44c-12-2-24-1-32 4Z" fill="#fff6d8" />
        <path d="M40 22v44" fill="none" /><path d="M14 30h18M14 38h18M14 46h14M48 30h18M48 38h18M48 46h14" fill="none" strokeWidth="1.2" />
        <path d="M54 18v-8h6v8l-3-2Z" fill="#d94a4a" strokeWidth="1.4" /><path d="M4 70h72" />
      </g>);
    case "u14": // a heart with rays of light (God's love)
      return (<g {...common}>
        <path d="M40 62C22 50 14 41 14 31a12 12 0 0 1 26-6 12 12 0 0 1 26 6c0 10-8 19-26 31Z" fill="#e06a5a" />
        <path d="M40 8v-6M18 14l-4-4M62 14l4-4M8 34H2M72 34h6" fill="none" stroke="#f0a04b" strokeWidth="2.4" />
        <path d="M26 30a7 7 0 0 1 7-7" fill="none" stroke="#fff6d8" strokeWidth="2" /><path d="M2 72h76" />
      </g>);
    case "u15": // a winding path toward a rising sun (my story)
      return (<g {...common}>
        <circle cx="56" cy="24" r="10" fill="#f6c58a" /><path d="M2 40h76" fill="none" strokeWidth="1.4" />
        <path d="M2 40h76v34H2Z" fill="#9fcf8f" />
        <path d="M30 74c4-10 26-12 22-20s-12-6-6-14" fill="none" stroke="var(--art-wall)" strokeWidth="7" />
        <path d="M30 74c4-10 26-12 22-20s-12-6-6-14" fill="none" strokeWidth="1" />
      </g>);
    case "u16": // two coffee cups on a café table (listening first)
      return (<g {...common}>
        <rect x="6" y="46" width="68" height="6" rx="2" fill="var(--art-beam)" /><path d="M40 52v18M28 70h24" />
        <path d="M14 30h16v10a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6Z" fill="#fff6d8" /><path d="M30 33h3a3 3 0 0 1 0 6h-3" fill="none" />
        <path d="M48 30h16v10a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6Z" fill="#9fc6e0" /><path d="M48 33h-3a3 3 0 0 0 0 6h3" fill="none" />
        <path d="M20 24c-2-3 2-5 0-8M56 24c-2-3 2-5 0-8" fill="none" strokeWidth="1.2" />
      </g>);
    case "u17": // an empty cross on a hill at sunrise (saved by grace)
      return (<g {...common}>
        <circle cx="40" cy="44" r="18" fill="#f6c58a" /><path d="M2 60c16-12 60-12 76 0v14H2Z" fill="#9fcf8f" />
        <path d="M37 18h6v12h12v6H43v20h-6V36H25v-6h12Z" fill="var(--art-beam)" />
      </g>);
    case "u18": // a small church with an open, lit door (invitations and prayer)
      return (<g {...common}>
        <rect x="18" y="34" width="44" height="36" fill="var(--art-wall)" /><path d="M14 34L40 14l26 20Z" fill="var(--art-roof)" />
        <path d="M40 14V2M35 6h10" fill="none" strokeWidth="2" />
        <path d="M33 70V54a7 7 0 0 1 14 0v16Z" fill="var(--art-glow)" /><circle cx="40" cy="42" r="4" fill="var(--art-window)" />
        <path d="M2 70h76" />
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
