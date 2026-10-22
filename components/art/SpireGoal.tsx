// The group goal: everyone's XP raises the cathedral spire (142 m). Stone below the line, gold above it fills as XP grows.
const SPIRE_M = 142;

export default function SpireGoal({ xp, target, title }: { xp: number; target: number; title: string }) {
  const ratio = Math.min(1, xp / target);
  const reached = ratio >= 1;
  const h = 150, top = 8;
  const fillY = top + h * (1 - ratio);
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 80 170" width="76" height="162" role="img" aria-label={`${Math.round(ratio * SPIRE_M)} of ${SPIRE_M} meters raised`}>
        <defs>
          <clipPath id="spire"><path d="M30 158V86L40 8L50 86V158Z" /></clipPath>
          <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6c04a" /><stop offset="1" stopColor="#d9694f" /></linearGradient>
        </defs>
        {reached && <circle cx="40" cy="60" r="44" fill="#f6c58a" opacity="0.4" className="petal-on" />}
        <path d="M30 158V86L40 8L50 86V158Z" fill="var(--border)" stroke="var(--foreground)" strokeWidth="2" strokeLinejoin="round" />
        <rect x="0" y={fillY} width="80" height={top + h - fillY + 10} fill="url(#gold)" clipPath="url(#spire)" />
        <path d="M30 158V86L40 8L50 86V158Z" fill="none" stroke="var(--foreground)" strokeWidth="2" strokeLinejoin="round" />
        <path d="M40 22V150M34 70H46M33 100H47M32 128H48" stroke="var(--foreground)" strokeOpacity="0.25" strokeWidth="1" />
        <rect x="14" y="158" width="52" height="8" rx="2" fill="var(--art-stone)" stroke="var(--foreground)" strokeWidth="2" />
      </svg>
      <div className="min-w-0">
        <p className="label">{title}</p>
        <p className="text-3xl font-extrabold text-primary">{Math.round(ratio * SPIRE_M)} <span className="text-base text-muted">of {SPIRE_M} m</span></p>
        <p className="text-sm text-muted">{xp.toLocaleString()} of {target.toLocaleString()} XP, all of us together</p>
        {reached && <p className="mt-1 font-bold text-good">Goal reached. Bravo, tout le monde !</p>}
      </div>
    </div>
  );
}
