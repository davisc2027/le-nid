import { createClient } from "@/lib/supabase/server";
import PushToggle from "@/components/PushToggle";

export default async function Home() {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("announcements").select("*")
    .order("pinned", { ascending: false }).order("created_at", { ascending: false });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">Announcements</h1>
      <PushToggle />
      {items?.length ? items.map((a) => (
        <article key={a.id} className="card">
          <h2 className="font-bold">{a.pinned && "📌 "}{a.title}</h2>
          <p className="whitespace-pre-wrap text-sm">{a.body}</p>
          <p className="mt-2 text-xs text-muted">{new Date(a.created_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</p>
        </article>
      )) : <p className="text-muted">Nothing yet.</p>}
    </div>
  );
}
