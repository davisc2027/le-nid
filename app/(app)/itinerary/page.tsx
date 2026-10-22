import { createClient } from "@/lib/supabase/server";

const mapHref = (url: string | null, location: string | null) => {
  const u = url?.trim();
  if (u) return /^https?:\/\//i.test(u) ? u : `https://${u}`;
  return location ? `https://maps.apple.com/?q=${encodeURIComponent(location)}` : null;
};

export default async function Itinerary() {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from("itinerary_items").select("*").order("day").order("start_time");
  const days = new Map<string, NonNullable<typeof items>>();
  items?.forEach((i) => days.set(i.day, [...(days.get(i.day) ?? []), i]));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">Itinerary</h1>
      {days.size === 0 && <p className="text-muted">Schedule coming soon.</p>}
      {[...days].map(([day, list]) => (
        <section key={day} className="flex flex-col gap-2">
          <h2 className="font-bold text-primary">
            {new Date(day + "T12:00:00Z").toLocaleDateString("en-GB", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" })}
          </h2>
          {list.map((i) => (
            <div key={i.id} className="card">
              <p className="text-xs text-muted">{i.start_time?.slice(0, 5)}{i.end_time && `–${i.end_time.slice(0, 5)}`}</p>
              <p className="font-bold">{i.title}</p>
              {i.location && (
                <p className="text-sm">
                  <a className="inline-block min-h-11 py-2 underline" href={mapHref(i.map_url, i.location)!} target="_blank" rel="noreferrer">{i.location}</a>
                </p>
              )}
              {i.notes && <p className="whitespace-pre-wrap text-sm text-muted">{i.notes}</p>}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
