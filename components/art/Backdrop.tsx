// Stylized Strasbourg skyline behind a screen: half-timbered houses, the cathedral spire, the Ill river.
// Colors come from --art-* tokens in globals.css so it follows light and dark.
function House({ x, w, h, roof = "var(--art-roof)" }: { x: number; w: number; h: number; roof?: string }) {
  const y = 300 - h;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="var(--art-wall)" />
      <path d={`M${x - 4} ${y} L${x + w / 2} ${y - w * 0.55} L${x + w + 4} ${y} Z`} fill={roof} />
      <path d={`M${x} ${y + h * 0.4}H${x + w}M${x} ${y + h * 0.75}H${x + w}M${x + w / 2} ${y}V300M${x} ${y + h * 0.4}L${x + w / 2} ${y + h * 0.75}L${x + w} ${y + h * 0.4}`} stroke="var(--art-beam)" strokeWidth="2" fill="none" />
      <rect x={x + w * 0.2} y={y + h * 0.12} width={w * 0.16} height={h * 0.16} fill="var(--art-window)" />
      <rect x={x + w * 0.64} y={y + h * 0.12} width={w * 0.16} height={h * 0.16} fill="var(--art-window)" />
    </g>
  );
}

export default function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 -z-10 h-[46vh] max-h-[420px] opacity-90">
      <svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" className="h-full w-full">
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--background)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--art-glow)" stopOpacity="0.55" />
          </linearGradient>
        </defs>
        <rect width="400" height="300" fill="url(#sky)" />
        <circle cx="70" cy="110" r="26" fill="var(--art-glow)" opacity="0.5" />
        {/* cathedral: asymmetrical single spire */}
        <g fill="var(--art-stone)">
          <path d="M268 300V170h26V300Z" />
          <path d="M270 170 L281 20 L292 170 Z" />
          <path d="M281 20V6" stroke="var(--art-stone)" strokeWidth="2" />
          <rect x="296" y="190" width="32" height="110" />
          <rect x="250" y="200" width="20" height="100" />
        </g>
        <g stroke="var(--art-wall)" strokeWidth="1.6" fill="none" opacity="0.7">
          <path d="M281 60V160M274 90H288M273 120H289M272 150H290" />
          <path d="M276 200v-18a5 5 0 0 1 10 0v18" />
        </g>
        <House x={8} w={54} h={110} />
        <House x={66} w={46} h={86} roof="var(--art-roof-2)" />
        <House x={116} w={58} h={124} />
        <House x={178} w={48} h={92} roof="var(--art-roof-2)" />
        <House x={332} w={56} h={104} />
        {/* the Ill */}
        <path d="M0 262 Q50 250 100 262 T200 262 T300 262 T400 262 V300 H0 Z" fill="var(--art-water)" />
        <path d="M0 278 Q50 268 100 278 T200 278 T300 278 T400 278" stroke="var(--art-glow)" strokeWidth="2" fill="none" opacity="0.6" />
      </svg>
    </div>
  );
}
