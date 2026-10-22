/** "…" placeholder for a sentence that is still being transcribed or translated. Pulses unless reduced motion. */
export default function Dots({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 py-1" role="img" aria-label={label}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="size-2 rounded-full bg-current opacity-60 motion-safe:animate-pulse" style={{ animationDelay: `${i * 180}ms` }} />
      ))}
    </span>
  );
}
