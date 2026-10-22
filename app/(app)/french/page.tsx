import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { UNITS } from "@/lib/french/content";
import Backdrop from "@/components/art/Backdrop";
import LandmarkArt from "@/components/art/LandmarkArt";
import OdileSays from "@/components/art/OdileSays";
import GentleToggle from "@/components/french/GentleToggle";
import type { Mood } from "@/components/art/Stork";
import type { Topic } from "@/lib/odile";

const dayParis = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(d);

export default async function French() {
  const supabase = await createClient();
  const [{ data: done }, { data: streak }, { data: xp }] = await Promise.all([
    supabase.from("lesson_progress").select("lesson_id"),
    supabase.from("streaks").select("current, last_day").maybeSingle(),
    supabase.from("xp_events").select("amount"),
  ]);
  const finished = new Set(done?.map((d) => d.lesson_id));
  const total = xp?.reduce((n, e) => n + e.amount, 0) ?? 0;

  const today = dayParis();
  const yesterday = dayParis(new Date(Date.now() - 86_400_000));
  let topic: Topic = "welcome", mood: Mood = "happy";
  if (streak?.last_day === today) { topic = "idle"; mood = "cheer"; }
  else if (streak?.last_day === yesterday) { topic = "streakRisk"; mood = "think"; }
  else if (streak?.last_day) { topic = "missed"; mood = "sulk"; }

  let unlocked = true; // a lesson opens once the one before it is finished
  return (
    <div className="flex flex-col gap-5">
      <Backdrop />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">French</h1>
        <p className="text-sm font-bold text-primary">🔥 {streak?.current ?? 0} · {total} XP</p>
      </div>
      <OdileSays topic={topic} mood={mood} />
      {UNITS.map((u) => (
        <section key={u.id} className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <LandmarkArt unit={u.id} progress={u.lessons.filter((l) => finished.has(l.id)).length / u.lessons.length} />
            <div>
              <h2 className="font-extrabold text-primary">{u.title}</h2>
              <p className="text-sm text-muted">{u.blurb}</p>
            </div>
          </div>
          {u.lessons.map((l) => {
            const isDone = finished.has(l.id);
            const open = unlocked;
            if (!isDone) unlocked = false;
            const body = (
              <>
                <span className={`grid size-10 shrink-0 place-items-center rounded-full border-2 font-extrabold ${isDone ? "border-good bg-good text-surface" : open ? "border-accent text-accent" : "border-border text-muted"}`}>
                  {isDone ? "✓" : open ? "▶" : "🔒"}
                </span>
                <span className="font-bold">{l.title}</span>
              </>
            );
            return open ? (
              <Link key={l.id} href={`/french/${l.id}`} className="card flex items-center gap-3">{body}</Link>
            ) : (
              <div key={l.id} className="card flex items-center gap-3 opacity-60">{body}</div>
            );
          })}
        </section>
      ))}
      <GentleToggle />
    </div>
  );
}
