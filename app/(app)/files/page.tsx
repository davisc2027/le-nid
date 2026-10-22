import { createClient } from "@/lib/supabase/server";

export default async function Files() {
  const supabase = await createClient();
  const [{ data: meetings }, { data: files }] = await Promise.all([
    supabase.from("meetings").select("*").order("meeting_date", { ascending: false }),
    supabase.from("files").select("*").order("created_at", { ascending: false }),
  ]);
  const groups = [
    ...(meetings ?? []).map((m) => ({ key: m.id, title: `${m.title} · ${m.meeting_date}`, items: (files ?? []).filter((f) => f.meeting_id === m.id) })),
    { key: "other", title: "Other", items: (files ?? []).filter((f) => !f.meeting_id) },
  ].filter((g) => g.items.length);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">Files</h1>
      {groups.length === 0 && <p className="text-muted">No files yet.</p>}
      {groups.map((g) => (
        <section key={g.key} className="flex flex-col gap-2">
          <h2 className="font-bold text-primary">{g.title}</h2>
          {g.items.map((f) => (
            <a key={f.id} className="card flex justify-between" href={`/files/${f.id}`} target="_blank" rel="noreferrer">
              <span>{f.title}</span>
              <span className="text-xs uppercase text-muted">{f.kind}</span>
            </a>
          ))}
        </section>
      ))}
    </div>
  );
}
