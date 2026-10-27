import { createClient } from "@/lib/supabase/server";
import { isOpen, nowMs, toTally, type Poll, type ResultRow, type Tally } from "@/lib/polls";
import PollCard from "./PollCard";

const RECENT_CLOSED_MS = 14 * 86_400_000;

/**
 * Polls for the Home page. Any error (for example migration 0014 not run yet) renders nothing at all.
 * Open polls show until answered; closed polls disappear unless they share results and the member voted (last 14 days).
 */
async function load() {
  try {
    const supabase = await createClient();
    const [{ data: polls, error }, { data: votes, error: vErr }] = await Promise.all([
      supabase.from("polls").select("id, question, options, multiple, anonymous, show_results, closes_at, closed, created_at")
        .order("created_at", { ascending: false }).limit(20),
      supabase.from("poll_votes").select("poll_id, option_idx"),
    ]);
    if (error || vErr || !polls?.length) return null;
    const now = nowMs();
    const mine = new Map<string, number[]>();
    for (const v of votes ?? []) mine.set(v.poll_id, [...(mine.get(v.poll_id) ?? []), v.option_idx].sort((a, b) => a - b));
    const shown = (polls as Poll[]).map((p) => ({ p, open: isOpen(p, now), mine: mine.get(p.id) ?? [] }))
      .filter(({ p, open, mine: m }) => open || (p.show_results && m.length > 0 && now - Date.parse(p.created_at) < RECENT_CLOSED_MS));
    if (!shown.length) return null;
    const cards = await Promise.all(shown.map(async ({ p, open, mine: m }) => {
      let tally: Tally | null = null;
      if (p.show_results && m.length > 0) {
        const r = await supabase.rpc("poll_results", { p_poll: p.id });
        if (!r.error) tally = toTally(r.data as ResultRow[], p.options.length);
      }
      return { p, open, mine: m, tally };
    }));
    return cards;
  } catch {
    return null;
  }
}

export default async function PollsSection() {
  const cards = await load();
  if (!cards?.length) return null;
  return (
    <section aria-label="Polls" className="flex flex-col gap-4">
      {cards.map(({ p, open, mine, tally }) => <PollCard key={p.id} poll={p} mine={mine} tally={tally} open={open} />)}
    </section>
  );
}
