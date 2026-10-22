// The group goal: everyone's XP builds Strasbourg Cathedral up to the tip of its 142 m spire.
import Cathedral from "./Cathedral";
import { Check } from "lucide-react";
import { MILESTONES, SPIRE_M, toRatio } from "./cathedralPlan";

export default function SpireGoal({ xp, target, title, size = "compact" }: { xp: number; target: number; title: string; size?: "compact" | "hero" }) {
  const ratio = toRatio(xp, target);
  const reached = ratio >= 1;
  const meters = Math.round(ratio * SPIRE_M);
  const next = MILESTONES.find((m) => ratio < m.at);
  const toGo = next ? Math.max(1, Math.ceil(next.at * target - xp)) : 0;
  const nextLine = next && <p className="mt-1 text-xs font-bold text-accent">Next: {next.label.toLowerCase()} at {Math.round(next.at * 100)}% · {toGo.toLocaleString()} XP to go</p>;

  if (size === "hero") {
    return (
      <div className="flex flex-col items-center gap-3">
        <Cathedral ratio={ratio} hero className="w-full max-w-[300px]" />
        <div className="text-center">
          <p className="label">{title}</p>
          <p className="text-4xl font-extrabold text-primary">{meters} <span className="text-base text-muted">of {SPIRE_M} m</span></p>
          <p className="text-sm text-muted">{xp.toLocaleString()} of {target.toLocaleString()} XP, all of us together</p>
          {reached && <p className="mt-1 font-bold text-good">Goal reached. Bravo, tout le monde !</p>}
          {nextLine}
        </div>
        <ol className="grid w-full grid-cols-2 gap-2" aria-label="Milestones">
          {MILESTONES.map((m) => {
            const got = ratio >= m.at;
            return (
              <li key={m.at} className={`rounded-xl border px-3 py-2 text-sm ${got ? "border-transparent bg-tint" : "border-dashed border-border text-muted"}`}>
                <span className={`block text-xs font-extrabold ${got ? "text-primary" : ""}`}>{got ? <Check size={12} className="mr-0.5 inline -mt-0.5" aria-label="Reached" /> : null}{Math.round(m.at * 100)}%</span>
                <span className="font-bold">{m.label}</span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Cathedral ratio={ratio} className="w-[150px] shrink-0" />
      <div className="min-w-0">
        <p className="label">{title}</p>
        <p className="text-3xl font-extrabold text-primary">{meters} <span className="text-base text-muted">of {SPIRE_M} m</span></p>
        <p className="text-sm text-muted">{xp.toLocaleString()} of {target.toLocaleString()} XP, all of us together</p>
        {reached && <p className="mt-1 font-bold text-good">Goal reached. Bravo, tout le monde !</p>}
        {nextLine}
      </div>
    </div>
  );
}
