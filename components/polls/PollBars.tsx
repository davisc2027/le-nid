import { percentages } from "@/lib/polls";

/** Percentage bars for a poll. Plain markup (no hooks) so both server and client components can render it. */
export default function PollBars({ options, counts, voters, multiple, mine = [], showCounts = false }: {
  options: string[]; counts: number[]; voters: number; multiple: boolean; mine?: number[]; showCounts?: boolean;
}) {
  const pct = percentages(counts, voters, multiple);
  return (
    <ul className="flex flex-col gap-2">
      {options.map((o, i) => (
        <li key={i}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 break-words font-semibold">{o}{mine.includes(i) && <span className="ml-1.5 text-xs font-bold text-primary">(your answer)</span>}</span>
            <span className="shrink-0 tabular-nums">{pct[i]}%{showCounts && <span className="text-muted"> ({counts[i]})</span>}</span>
          </div>
          <div className="mt-1 h-3 overflow-hidden rounded-full bg-border" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct[i]} aria-label={`${o}: ${pct[i]} percent`}>
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct[i]}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
