import Link from "next/link";
import { createClient, getProfile } from "@/lib/supabase/server";
import { refLabel } from "@/lib/bible/reference";
import Rosace from "@/components/art/Rosace";
import ScriptureBackdrop from "@/components/art/ScriptureBackdrop";
import AddVerse from "@/components/scripture/AddVerse";
import AdoptSet from "@/components/scripture/AdoptSet";
import BibleNotice from "@/components/scripture/BibleNotice";

export default async function Scripture() {
  const supabase = await createClient();
  const [profile, { data: cards }, { data: sets }, { data: items }] = await Promise.all([
    getProfile(),
    supabase.from("srs_cards").select("ref, learned_at, due").order("created_at"),
    supabase.from("verse_sets").select("id, title, description").order("created_at"),
    supabase.from("verse_set_items").select("set_id, ref, position").order("position"),
  ]);
  const mine = cards ?? [];
  const learned = mine.filter((c) => c.learned_at).length;
  const due = mine.filter((c) => c.learned_at && c.due && new Date(c.due) <= new Date()).length;
  const have = new Set(mine.map((c) => c.ref));

  return (
    <div className="flex flex-col gap-5">
      <ScriptureBackdrop />
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-2xl font-extrabold">La Rosace</h1>
        <Rosace filled={learned} total={mine.length || 6} size={210} />
        <p className="verse-text">{learned} of {mine.length} verses learned</p>
      </div>

      <BibleNotice leader={profile?.role === "admin"} />

      {due > 0 && <Link href="/scripture/review" className="btn">Review {due} due {due === 1 ? "verse" : "verses"}</Link>}

      <section className="flex flex-col gap-2">
        <h2 className="label">My verses</h2>
        {mine.length === 0 && <p className="text-sm text-muted">Add a verse below, or take a set from the leaders.</p>}
        {mine.map((c) => (
          <Link key={c.ref} href={`/scripture/learn?ref=${encodeURIComponent(c.ref)}`} className="card flex-row items-center justify-between">
            <span className="verse-text">{refLabel(c.ref)}</span>
            <span className="tag">{!c.learned_at ? "Learn" : new Date(c.due!) <= new Date() ? "Due" : "Learned"}</span>
          </Link>
        ))}
      </section>

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
