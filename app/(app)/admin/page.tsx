import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import FileUpload from "@/components/FileUpload";
import { postAnnouncement, addItineraryItem, addMeeting } from "./actions";

export default async function Admin() {
  const profile = await getProfile();
  if (profile?.role !== "admin") redirect("/");
  const supabase = await createClient();
  const { data: meetings } = await supabase.from("meetings").select("id, title").order("meeting_date", { ascending: false });
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">Admin</h1>

      <form action={postAnnouncement} className="card flex flex-col gap-2">
        <h2 className="font-bold">New announcement</h2>
        <input className="input" name="title" placeholder="Title" required />
        <textarea className="input" name="body" placeholder="Message" rows={4} />
        <label className="text-sm"><input type="checkbox" name="push" defaultChecked /> Send push notification</label>
        <label className="text-sm"><input type="checkbox" name="pinned" /> Pin to top</label>
        <button className="btn">Post</button>
      </form>

      <form action={addMeeting} className="card flex flex-col gap-2">
        <h2 className="font-bold">New prep meeting</h2>
        <input className="input" name="title" placeholder="e.g. Prep meeting 2" required />
        <input className="input" name="meeting_date" type="date" required />
        <button className="btn">Add</button>
      </form>

      <FileUpload meetings={meetings ?? []} />

      <form action={addItineraryItem} className="card flex flex-col gap-2">
        <h2 className="font-bold">New itinerary item</h2>
        <input className="input" name="day" type="date" required />
        <div className="flex gap-2">
          <input className="input" name="start_time" type="time" />
          <input className="input" name="end_time" type="time" />
        </div>
        <input className="input" name="title" placeholder="Title" required />
        <input className="input" name="location" placeholder="Location" />
        <input className="input" name="map_url" placeholder="Map link (optional)" />
        <textarea className="input" name="notes" placeholder="Notes" rows={2} />
        <button className="btn">Add</button>
      </form>
    </div>
  );
}
