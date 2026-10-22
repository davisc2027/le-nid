// Stained-glass wash behind the scripture screens: soft colored light from above on a parchment ground.
export default function ScriptureBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10"
      style={{ background: "radial-gradient(60% 40% at 20% 0%, color-mix(in srgb, var(--glass-blue) 28%, transparent), transparent 70%), radial-gradient(55% 38% at 85% 8%, color-mix(in srgb, var(--glass-red) 24%, transparent), transparent 70%), radial-gradient(50% 30% at 50% 0%, color-mix(in srgb, var(--glass-gold) 30%, transparent), transparent 70%), var(--parch)" }}>
      <svg className="h-full w-full opacity-[0.07]"><filter id="paper"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" /></filter><rect width="100%" height="100%" filter="url(#paper)" /></svg>
    </div>
  );
}
