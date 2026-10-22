import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SpireGoal from "@/components/art/SpireGoal";

type Team = { team: string; xp: number | string };
type Row = { name: string; xp: number | string; is_me: boolean };

export default async function Together() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: goal }, { data: total }, { data: teams }, { data: week }, { data: all }, { data: me }] = await Promise.all([
    supabase.from("trip_goal").select("title, target_xp").single(),
    supabase.rpc("group_xp"),
    supabase.rpc("team_totals"),
    supabase.rpc("leaderboard", { p_all_time: false }),
    supabase.rpc("leaderboard", { p_all_time: true }),
    supabase.from("profiles").select("leaderboard_opt_in").eq("id", user!.id).single(),
  ]);
  const topTeam = Math.max(1, ...((teams ?? []) as Team[]).map((t) => Number(t.xp)));
  const board = (rows: Row[] | null) => (
    <ol className="flex flex-col gap-1.5">
      {(rows ?? []).map((r, i) => (
        <li key={i} className={`card flex-row justify-between !py-2 ${r.is_me ? "!border-primary" : ""}`}>
          <span><b className="text-muted">{i + 1}</b> {r.name}{r.is_me && " (you)"}</span>
          <span className="font-bold tabular-nums">{Number(r.xp)} XP</span>
        </li>
      ))}
      {!rows?.length && <p className="text-sm text-muted">Nobody has joined yet.</p>}
    </ol>
  );
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-extrabold">Together</h1>
      <div className="card"><SpireGoal xp={Number(total ?? 0)} target={goal?.target_xp ?? 10000} title={goal?.title ?? "Raise the spire"} /></div>

      {!!teams?.length && (
        <section className="flex flex-col gap-2">
          <h2 className="label">Teams</h2>
          {(teams as Team[]).map((t) => (
            <div key={t.team} className="card gap-1">
              <div className="flex justify-between"><b>{t.team}</b><span className="tabular-nums">{Number(t.xp)} XP</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-accent" style={{ width: `${(Number(t.xp) / topTeam) * 100}%` }} /></div>
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="label">This week</h2>
        {me?.leaderboard_opt_in ? board(week as Row[] | null) : <p className="card text-sm">The individual leaderboard is opt-in. <Link href="/me" className="font-bold text-primary underline">Join from your profile</Link> to see and appear on it.</p>}
      </section>
      {me?.leaderboard_opt_in && <section className="flex flex-col gap-2"><h2 className="label">All time</h2>{board(all as Row[] | null)}</section>}
    </div>
  );
}
