// Odile the stork. Plain SVG with hex colors so it also renders in ImageResponse (app icon).
// Animation lives in globals.css ("Odile motion") via the class names below; static renderers ignore them.
// `live` adds the extra parts the animated companion needs (second leg pose, overflow for effects);
// without it the markup is the original static drawing, so the logo and icons stay unchanged.
import type { CSSProperties } from "react";

export type Mood = "happy" | "cheer" | "sulk" | "sleepy" | "think" | "oops" | "dizzy" | "fly";
/** One-shot effects drawn around Odile during a reaction. Decorative only. */
export type Fx = "sparkle" | "hearts" | "stars" | "sweat" | "feather" | "confetti";

const LINE = "#3a2a20", WHITE = "#ffffff", BLACK = "#2b2118", BEAK = "#e8532b", LEG = "#e0553a";
const GOLD = "#f0a04b", BLUE = "#6ab0e8", PINK = "#e8607a";
const HEAD_TILT: Record<Mood, number> = { happy: 0, cheer: -4, sulk: 20, sleepy: 26, think: -10, oops: 8, dizzy: 12, fly: 34 };
const WING_LIFT: Record<Mood, number> = { happy: 0, cheer: -38, sulk: 6, sleepy: 4, think: 0, oops: -14, dizzy: 4, fly: -46 };
const STAR = "M0 -8 L2.2 -2.2 L8 0 L2.2 2.2 L0 8 L-2.2 2.2 L-8 0 L-2.2 -2.2 Z";
const HEART = "M0 4 C-7 -2 -4 -9 0 -4.5 C4 -9 7 -2 0 4 Z";
const legProps = { stroke: LEG, strokeWidth: 3.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };

function Eye({ mood }: { mood: Mood }) {
  const arc = { fill: "none", stroke: BLACK, strokeWidth: 2.6, strokeLinecap: "round" as const };
  if (mood === "happy" || mood === "cheer") return <path d="M91 26 Q96 19 101 26" {...arc} />;
  if (mood === "sleepy") return <path d="M91 24 Q96 29 101 24" {...arc} />;
  if (mood === "fly") return <path d="M91 25 Q96 21 101 25" {...arc} />;
  if (mood === "dizzy") return <path d="M96 25 m-4 0 a4 4 0 1 1 4 4 a2.6 2.6 0 1 1 -2.6 -2.6 a1.2 1.2 0 1 1 1.2 1.2" {...arc} strokeWidth="1.8" />;
  if (mood === "oops") return (
    <g>
      <g className="stork-eye">
        <circle cx="96" cy="25" r="4.6" fill={WHITE} stroke={BLACK} strokeWidth="1.6" />
        <circle cx="96.6" cy="25.4" r="2.2" fill={BLACK} />
      </g>
      <path d="M90 17 Q95 13 101 16" {...arc} strokeWidth="2" />
    </g>
  );
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

/** Effect bits. Each bit animates on its own (see .odile-fx in globals.css); delays come from --i. */
function Effect({ fx }: { fx: Fx }) {
  const bit = (i: number) => ({ className: "odile-fx-bit", style: { "--i": i } as CSSProperties });
  if (fx === "sparkle") return (
    <g className="odile-fx odile-fx-sparkle" fill={GOLD}>
      <g transform="translate(20 40)"><path d={STAR} {...bit(0)} /></g>
      <g transform="translate(132 60) scale(.8)"><path d={STAR} {...bit(1)} /></g>
      <g transform="translate(44 10) scale(.65)"><path d={STAR} {...bit(2)} /></g>
    </g>
  );
  if (fx === "hearts") return (
    <g className="odile-fx odile-fx-rise" fill={PINK}>
      <g transform="translate(116 14) scale(1.5)"><path d={HEART} {...bit(0)} /></g>
      <g transform="translate(76 4) scale(1.1)"><path d={HEART} {...bit(1)} /></g>
      <g transform="translate(132 -6) scale(.9)"><path d={HEART} {...bit(2)} /></g>
    </g>
  );
  if (fx === "stars") return (
    <g className="odile-fx odile-fx-stars" transform="translate(92 -4)">
      <g className="odile-fx-orbit" fill={GOLD} stroke={LINE} strokeWidth="1">
        <path d={STAR} transform="translate(16 0) scale(.85)" />
        <path d={STAR} transform="translate(-8 14) scale(.85)" />
        <path d={STAR} transform="translate(-8 -14) scale(.85)" />
      </g>
    </g>
  );
  if (fx === "sweat") return (
    <g className="odile-fx odile-fx-drip" fill={BLUE} stroke={LINE} strokeWidth="1">
      <g transform="translate(84 14)"><path d="M0 -6 Q5 1 0 5 Q-5 1 0 -6 Z" {...bit(0)} /></g>
    </g>
  );
  if (fx === "feather") return (
    <g className="odile-fx odile-fx-fall">
      <g transform="translate(50 76) scale(1.5)">
        <g {...bit(0)}>
          <path d="M0 0 Q7 -9 0 -20 Q-7 -9 0 0 Z" fill={WHITE} stroke={LINE} strokeWidth="1.4" />
          <path d="M0 2 L0 -18" stroke={LINE} strokeWidth="1" />
        </g>
      </g>
    </g>
  );
  const colors = [GOLD, "#a8412e", "#2d4f8f", PINK, "#3f7d4e"];
  return (
    <g className="odile-fx odile-fx-burst">
      {Array.from({ length: 10 }, (_, i) => (
        <g key={i} transform={`rotate(${i * 36} 72 64)`}>
          <rect x="70" y="10" width="5" height="8" rx="1.5" fill={colors[i % colors.length]} {...bit(i % 3)} />
        </g>
      ))}
    </g>
  );
}

export default function Stork({ mood = "happy", size = 120, label = "", live = false, fx, className = "", style }: { mood?: Mood; size?: number; label?: string; live?: boolean; fx?: Fx | null; className?: string; style?: CSSProperties }) {
  const cheeky = mood === "happy" || mood === "cheer";
  const flying = mood === "fly";
  return (
    <svg viewBox="0 0 150 150" width={size} height={(size * 150) / 150} role={label ? "img" : undefined} aria-label={label || undefined} aria-hidden={label ? undefined : true}
      className={`stork stork-${mood}${live ? " stork-live" : ""}${className ? ` ${className}` : ""}`} style={style} overflow={live ? "visible" : undefined}>
      <g className="stork-bob">
        {flying ? (
          /* legs trail behind in flight */
          <path d="M58 96 L24 104 M68 98 L30 110" {...legProps} />
        ) : (
          <g className="stork-legs-a">
            {/* legs: one standing, one tucked */}
            <path d="M62 98 L60 140 M60 140 L51 144 M60 140 L69 144" {...legProps} />
            <path d="M72 98 L80 114 L66 114" {...legProps} />
          </g>
        )}
        {live && !flying && (
          /* the other leg's turn; shown only by the "legs" idle */
          <g className="stork-legs-b" opacity="0">
            <path d="M70 98 L72 140 M72 140 L63 144 M72 140 L81 144" {...legProps} />
            <path d="M60 98 L66 114 L52 113" {...legProps} />
          </g>
        )}
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
            {(cheeky || mood === "oops") && <circle cx="92" cy="33" r="3.4" fill="#f4a89a" opacity="0.8" />}
            {Eye({ mood })}
            {mood === "sulk" && <path className="stork-tear" d="M99 36 Q97 41 99.5 43 Q102 41 99 36 Z" fill={BLUE} />}
          </g>
        </g>
        {mood === "sleepy" && <path className="stork-zzz" d="M112 8 h8 l-8 9 h8 M126 -2 h6 l-6 7 h6" transform="translate(0 6)" stroke={LINE} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        {mood === "think" && <path d="M118 8 q0-8 8-8 q8 0 8 7 q0 5 -6 7 v3 M126 24 v1" stroke={LINE} strokeWidth="2.4" fill="none" strokeLinecap="round" />}
        {mood === "cheer" && <path d="M18 40 l4 8 l8 4 l-8 4 l-4 8 l-4 -8 l-8 -4 l8 -4 Z" fill={GOLD} />}
      </g>
      {fx && Effect({ fx })}
    </svg>
  );
}

/** Small twig nest Odile sits in beside the lesson progress bar. Drawn in front of her so it hides her legs. */
export function Nest({ width = 40 }: { width?: number }) {
  return (
    <svg viewBox="0 0 60 24" width={width} height={(width * 24) / 60} aria-hidden="true" className="odile-nest">
      <path d="M3 8 Q30 2 57 8 Q55 21 30 22 Q5 21 3 8 Z" fill="#a5774c" stroke={LINE} strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M7 10 Q30 15 53 9 M9 14 Q30 19 50 13 M14 6 L22 17 M28 5 L34 18 M44 6 L38 17" stroke={LINE} strokeWidth="1" fill="none" strokeLinecap="round" opacity=".55" />
      <path d="M2 8 Q30 13 58 8" stroke="#7a4f38" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  );
}
