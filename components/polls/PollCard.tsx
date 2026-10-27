"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toTally, type Poll, type ResultRow, type Tally } from "@/lib/polls";
import PollBars from "./PollBars";

/** One poll for a member: tappable options, then a thank-you (with percentages when the admin allows it). */
export default function PollCard({ poll, mine, tally: initialTally, open }: {
  poll: Poll; mine: number[]; tally: Tally | null; open: boolean;
}) {
  const router = useRouter();
  const [voted, setVoted] = useState<number[]>(mine);        // what the server has recorded for me
  const [tally, setTally] = useState<Tally | null>(initialTally);
  const [picked, setPicked] = useState<number[]>(mine);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const answered = voted.length > 0;
  const form = open && (!answered || editing);

  function toggle(i: number) {
    setPicked((cur) => poll.multiple ? (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort((a, b) => a - b)) : [i]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !picked.length) return;
    setBusy(true); setError("");
    const supabase = createClient();
    // Nothing is shown as saved until the server says so.
    const { error: err } = await supabase.rpc("cast_vote", { p_poll: poll.id, p_options: picked });
    if (err) {
      setBusy(false);
      setError(/closed/i.test(err.message) ? "This poll has just closed." : "Could not save your answer. Please try again.");
      if (/closed/i.test(err.message)) router.refresh();
      return;
    }
    setVoted(picked); setEditing(false);
    if (poll.show_results) {
      const r = await supabase.rpc("poll_results", { p_poll: poll.id });
      if (!r.error) setTally(toTally(r.data as ResultRow[], poll.options.length));
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <article className="card flex flex-col gap-3">
      <span className="label">Poll</span>
      {form ? (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <fieldset className="flex flex-col gap-2" disabled={busy}>
            <legend className="mb-2 font-bold">{poll.question}</legend>
            {poll.multiple && <p className="-mt-1 mb-1 text-xs text-muted">Pick as many as you like.</p>}
            {poll.options.map((o, i) => {
              const on = picked.includes(i);
              return (
                <label key={i} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 px-3 py-2 text-base ${on ? "border-primary bg-tint" : "border-border bg-surface"}`}>
                  <input type={poll.multiple ? "checkbox" : "radio"} name={`poll-${poll.id}`} checked={on} onChange={() => toggle(i)} className="size-5 shrink-0 accent-[var(--primary)]" />
                  <span className="min-w-0 break-words">{o}</span>
                </label>
              );
            })}
          </fieldset>
          <div className="flex gap-2">
            <button className="btn flex-1" disabled={busy || !picked.length}>{busy ? "Sending…" : answered ? "Save answer" : "Submit"}</button>
            {editing && <button type="button" className="btn ghost" onClick={() => { setEditing(false); setPicked(voted); setError(""); }}>Cancel</button>}
          </div>
          {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <h2 className="font-bold">{poll.question}</h2>
          <div aria-live="polite" className="flex flex-col gap-3">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-good"><Check size={18} aria-hidden="true" />Thanks, your answer is in</p>
            {poll.show_results && tally && tally.voters > 0 && (
              <>
                <PollBars options={poll.options} counts={tally.counts} voters={tally.voters} multiple={poll.multiple} mine={voted} />
                <p className="text-xs text-muted">{tally.voters} {tally.voters === 1 ? "person has" : "people have"} answered{poll.multiple ? ". Several answers were allowed, so the bars can add up to more than 100%." : "."}</p>
              </>
            )}
          </div>
          {open && <button type="button" className="min-h-11 self-start px-1 text-sm text-primary underline" onClick={() => { setPicked(voted); setEditing(true); }}>Change answer</button>}
          {!open && <p className="text-xs text-muted">This poll is closed.</p>}
        </div>
      )}
    </article>
  );
}
