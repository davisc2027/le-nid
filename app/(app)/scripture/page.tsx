import Link from "next/link";
import { createClient, getProfile } from "@/lib/supabase/server";
import { refLabel } from "@/lib/bible/reference";
import ScriptureBackdrop from "@/components/art/ScriptureBackdrop";
import AddVerse from "@/components/scripture/AddVerse";
import AdoptSet from "@/components/scripture/AdoptSet";
import BibleNotice from "@/components/scripture/BibleNotice";
import VerseList, { RosaceLive, type Row } from "@/components/scripture/VerseList";

export default async function Scripture() {
  const supabase = await createClient();
  const [profile, withProgress, { data: sets }, { data: items }] = await Promise.all([
    getProfile(),
    supabase.from("srs_cards").select("ref, learned_at, due, progress").order("created_at"),
    supabase.from("verse_sets").select("id, title, description").order("created_at"),
    supabase.from("verse_set_items").select("set_id, ref, position").order("position"),
  ]);
  // srs_cards.progress arrives with migration 0011; until then read without it (progress then lives on the device).
  const { data: cards } = withProgress.error ? await supabase.from("srs_cards").select("ref, learned_at, due").order("created_at") : withProgress;
  const mine = (cards ?? []) as Row[];
  const due = mine.filter((c) => c.learned_at && c.due && new Date(c.due) <= new Date()).length;
  const have = new Set(mine.map((c) => c.ref));

  return (
    <div className="flex flex-col gap-5">
      <ScriptureBackdrop />
      <RosaceLive rows={mine} />

      <BibleNotice leader={profile?.role === "admin"} />

      {due > 0 && <Link href="/scripture/review" className="btn">Review {due} due {due === 1 ? "verse" : "verses"}</Link>}

      <VerseList rows={mine} />

      <AddVerse />

      {sets?.map((s) => {
        const refs = (items ?? []).filter((i) => i.set_id === s.id).map((i) => i.ref);
        return (
          <section key={s.id} className="card gap-2">
            <h2 className="font-extrabold">{s.title}</h2>
            {s.description && <p className="text-sm text-muted">{s.description}</p>}
            <p className="verse-text text-base">{refs.map(refLabel).join(" · ")}</p>
            {refs.some((r) => !have.has(r)) ? <AdoptSet refs={refs} /> : <p className="text-sm text-good">All in your verses.</p>}
          </section>
        );
      })}
    </div>
  );
}
