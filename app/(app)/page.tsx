import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { ChevronRight, Trophy } from "lucide-react";
import PushToggle from "@/components/PushToggle";
import InstallBanner from "@/components/InstallBanner";
import SpireGoal from "@/components/art/SpireGoal";

export default async function Home() {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("announcements").select("*")
    .order("pinned", { ascending: false }).order("created_at", { ascending: false });
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: me }, { data: goal }, { data: total }, { data: board }] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", user!.id).single(),
    supabase.from("trip_goal").select("title, target_xp").single(),
    supabase.rpc("group_xp"),
    supabase.rpc("leaderboard", { p_all_time: false }),
  ]);
  const rows = (board ?? []) as { is_me: boolean; xp: number | string }[];
  const myIndex = rows.findIndex((r) => r.is_me);
  const myRank = myIndex >= 0 ? myIndex + 1 : null;
  const myXp = myIndex >= 0 ? Number(rows[myIndex].xp) : 0;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">Announcements</h1>
      <Link href="/together" className="card flex min-h-16 flex-row items-center gap-3 !border-accent">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-accent text-[#2b2118]"><Trophy size={22} strokeWidth={2.4} aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-extrabold">{myRank ? `You're #${myRank} this week` : "Join the weekly leaderboard"}</span>
          <span className="block text-sm text-muted">{myRank ? `${myXp} XP. See the rankings and your team.` : "Climb the ranks with your team. Opt in from your profile."}</span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-muted" aria-hidden="true" />
      </Link>
      <InstallBanner />
      {!me?.name && <Link href="/me" className="card !border-primary font-bold">Add your name so the group knows who you are →</Link>}
      <PushToggle prompt />
      <Link href="/together" className="card"><SpireGoal xp={Number(total ?? 0)} target={goal?.target_xp ?? 10000} title={goal?.title ?? "Raise the spire"} /></Link>
      {items?.length ? items.map((a) => (
        <article key={a.id} className="card">
          <h2 className="font-bold">{a.pinned && "📌 "}{a.title}</h2>
          <p className="whitespace-pre-wrap text-sm">{a.body}</p>
          <p className="mt-2 text-xs text-muted">{new Date(a.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" })} (Paris time)</p>
        </article>
      )) : <p className="text-muted">Nothing yet.</p>}
    </div>
  );
}
