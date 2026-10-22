import Stork from "./Stork";

/** Stork + wordmark. `stacked` is for splash and login screens. */
export default function Logo({ stacked = false, size = 40 }: { stacked?: boolean; size?: number }) {
  return (
    <div className={`flex items-center gap-2 ${stacked ? "flex-col" : ""}`}>
      <Stork mood="happy" size={size} />
      <span className="font-extrabold leading-none tracking-tight text-primary" style={{ fontSize: size * 0.6 }}>Le Nid</span>
    </div>
  );
}
