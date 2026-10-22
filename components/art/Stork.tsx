// Odile the stork. Plain SVG with hex colors so it also renders in ImageResponse (app icon).
// Animation lives in globals.css via the class names below; static renderers ignore them.
export type Mood = "happy" | "cheer" | "sulk" | "sleepy" | "think";

const LINE = "#3a2a20", WHITE = "#ffffff", BLACK = "#2b2118", BEAK = "#e8532b", LEG = "#e0553a";
const HEAD_TILT: Record<Mood, number> = { happy: 0, cheer: -4, sulk: 20, sleepy: 26, think: -10 };
const WING_LIFT: Record<Mood, number> = { happy: 0, cheer: -38, sulk: 6, sleepy: 4, think: 0 };

function Eye({ mood }: { mood: Mood }) {
  const arc = { fill: "none", stroke: BLACK, strokeWidth: 2.6, strokeLinecap: "round" as const };
  if (mood === "happy" || mood === "cheer") return <path d="M91 26 Q96 19 101 26" {...arc} />;
  if (mood === "sleepy") return <path d="M91 24 Q96 29 101 24" {...arc} />;
  const look = mood === "think" ? { x: 1.5, y: -1.5 } : mood === "sulk" ? { x: 1.5, y: 1.5 } : { x: 0, y: 0 };
  return (
    <g>
      <g className="stork-eye">
        <circle cx={96 + look.x} cy={25 + look.y} r="3.4" fill={BLACK} />
        <circle cx={97 + look.x} cy={24 + look.y} r="1.1" fill={WHITE} />
      </g>
      {mood === "sulk" && <path d="M90 20 L101 24" {...arc} strokeWidth="2" />}
    </g>
  );
}

export default function Stork({ mood = "happy", size = 120, label = "" }: { mood?: Mood; size?: number; label?: string }) {
  const cheeky = mood === "happy" || mood === "cheer";
  return (
    <svg viewBox="0 0 150 150" width={size} height={(size * 150) / 150} role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true} className={`stork stork-${mood}`}>
      <g className="stork-bob">
        {/* legs: one standing, one tucked */}
        <path d="M62 98 L60 140 M60 140 L51 144 M60 140 L69 144" stroke={LEG} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M72 98 L80 114 L66 114" stroke={LEG} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        {/* tail, body, wing */}
        <path d="M36 78 L12 72 L14 92 L38 94 Z" fill={BLACK} stroke={LINE} strokeWidth="1.5" strokeLinejoin="round" />
        <ellipse cx="64" cy="80" rx="33" ry="22" fill={WHITE} stroke={LINE} strokeWidth="2" />
        <g transform={`rotate(${WING_LIFT[mood]} 62 72)`}>
          <g className="stork-wing">
            <path d="M34 78 Q62 60 92 78 Q72 106 30 94 Z" fill={WHITE} stroke={LINE} strokeWidth="2" strokeLinejoin="round" />
            <path d="M30 94 Q72 106 92 78 Q72 92 46 92 Z" fill={BLACK} />
          </g>
        </g>
        {/* neck and head */}
        <g transform={`rotate(${HEAD_TILT[mood]} 82 70)`}>
          <g className="stork-head">
            <path d="M82 70 C94 56 84 44 93 32" stroke={LINE} strokeWidth="14" strokeLinecap="round" fill="none" />
            <path d="M82 70 C94 56 84 44 93 32" stroke={WHITE} strokeWidth="10" strokeLinecap="round" fill="none" />
            <circle cx="94" cy="27" r="11.5" fill={WHITE} stroke={LINE} strokeWidth="2" />
            <path d="M104 22 L146 32 L104 36 Z" fill={BEAK} stroke={LINE} strokeWidth="1.6" strokeLinejoin="round" />
            <path d="M104 30 L142 33" stroke="#a63a1c" strokeWidth="1.2" strokeLinecap="round" />
            {cheeky && <circle cx="92" cy="33" r="3.4" fill="#f4a89a" opacity="0.8" />}
            {Eye({ mood })}
            {mood === "sulk" && <path d="M99 36 Q97 41 99.5 43 Q102 41 99 36 Z" fill="#6ab0e8" />}
          </g>
        </g>
        {mood === "sleepy" && <path d="M112 8 h8 l-8 9 h8 M126 -2 h6 l-6 7 h6" transform="translate(0 6)" stroke={LINE} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        {mood === "think" && <path d="M118 8 q0-8 8-8 q8 0 8 7 q0 5 -6 7 v3 M126 24 v1" stroke={LINE} strokeWidth="2.4" fill="none" strokeLinecap="round" />}
        {mood === "cheer" && <path d="M18 40 l4 8 l8 4 l-8 4 l-4 8 l-4 -8 l-8 -4 l8 -4 Z" fill="#f0a04b" />}
      </g>
    </svg>
  );
}
