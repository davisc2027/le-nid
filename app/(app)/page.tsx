import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import PushToggle from "@/components/PushToggle";
import InstallBanner from "@/components/InstallBanner";
import { StreakCount } from "@/components/art/OdileSays";
import { ALL_LESSONS } from "@/lib/french/content";
import SpireGoal from "@/components/art/SpireGoal";

export default async function Home() {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("announcements").select("*")
    .order("pinned", { ascending: false }).order("created_at", { ascending: false });
  const { data: { user } } = await supabase.auth.getUser();
  const [{ data: me }, { data: goal }, { data: total }, { data: done }, { data: streak }] = await Promise.all([
    supabase.from("profiles").select("name").eq("id", user!.id).single(),
    supabase.from("trip_goal").select("title, target_xp").single(),
    supabase.rpc("group_xp"),
    supabase.from("lesson_progress").select("lesson_id"),
    supabase.from("streaks").select("current, last_day").maybeSingle(),
  ]);
  const finished = new Set(done?.map((d) => d.lesson_id));
  const next = ALL_LESSONS.find((l) => !finished.has(l.id));
  return (
    <div className="flex flex-col gap-4">
      <Link href={next ? `/french/${next.id}` : "/learn"} className="card !border-primary flex-row items-center justify-between gap-3">
        <div>
          <p className="label">🔥 <StreakCount current={streak?.current} lastDay={streak?.last_day} /> day streak</p>
          <p className="text-lg font-extrabold">{next ? `Continue: ${next.title}` : "Review your verses"}</p>
        </div>
        <span className="btn shrink-0">Go</span>
      </Link>
      <InstallBanner />
      <h1 className="text-2xl font-extrabold">Announcements</h1>
      {!me?.name && <Link href="/me" className="card !border-primary font-bold">Add your name so the group knows who you are →</Link>}
      <PushToggle />
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
