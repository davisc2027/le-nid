import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import FileUpload from "@/components/FileUpload";
import { postAnnouncement, addItineraryItem, addMeeting, addTodo, assignMissing } from "./actions";

export default async function Admin() {
  const profile = await getProfile();
  if (profile?.role !== "admin") redirect("/");
  const supabase = await createClient();
  const { data: meetings } = await supabase.from("meetings").select("id, title").order("meeting_date", { ascending: false });
  const [{ data: todos }, { data: assignments }, { data: people }] = await Promise.all([
    supabase.from("todos").select("id, title, due_date, requires_upload").order("due_date"),
    supabase.from("todo_assignments").select("todo_id, user_id, completed_at"),
    supabase.from("profiles").select("id, name, email"),
  ]);
  const who = new Map(people?.map((p) => [p.id, p.name || p.email]));
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-extrabold">Admin</h1>

      <form action={addTodo} className="card flex flex-col gap-2">
        <h2 className="font-bold">New to-do (assigned to all members)</h2>
        <input className="input" name="title" placeholder="e.g. Submit passport copy" required />
        <textarea className="input" name="description" placeholder="Details" rows={2} />
        <input className="input" name="due_date" type="date" required />
        <label className="text-sm"><input type="checkbox" name="requires_upload" /> Requires a file upload</label>
        <button className="btn">Create and notify</button>
        <p className="text-xs text-muted">Reminders go out automatically 5 days, 1 day, and 0 days before the due date.</p>
      </form>

      {todos?.map((t) => {
        const mine = assignments?.filter((a) => a.todo_id === t.id) ?? [];
        const open = mine.filter((a) => !a.completed_at);
        return (
          <div key={t.id} className="card">
            <p className="font-bold">{t.title} <span className="text-xs font-normal text-muted">due {t.due_date}</span></p>
            <p className="text-sm">{mine.length - open.length}/{mine.length} done</p>
            {open.length > 0 && <p className="text-sm text-muted">Waiting on: {open.map((a) => who.get(a.user_id)).join(", ")}</p>}
          </div>
        );
      })}
      <form action={assignMissing}><button className="text-sm text-muted underline">Assign existing to-dos to new members</button></form>

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
