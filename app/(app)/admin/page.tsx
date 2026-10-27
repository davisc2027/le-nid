import { redirect } from "next/navigation";
import { Star } from "lucide-react";
import { createClient, getProfile } from "@/lib/supabase/server";
import FileUpload from "@/components/FileUpload";
import AssignPicker from "@/components/admin/AssignPicker";
import AdminTabs from "@/components/admin/AdminTabs";
import ActionForm from "@/components/admin/ActionForm";
import Section from "@/components/admin/Section";
import UploadLink from "@/components/admin/UploadLink";
import {
  postAnnouncement, updateAnnouncement, deleteAnnouncement,
  addItineraryItem, updateItineraryItem, deleteItineraryItem,
  addMeeting, updateMeeting, deleteMeeting, updateFile, deleteFile,
  addTodo, updateTodo, deleteTodo, assignMissing,
  addVerseSet, updateVerseSet, deleteVerseSet, setTeam, deletePerson, updateGoal,
  addAllowedEmails, removeAllowedEmail, setAccess,
} from "./actions";

type Person = { id: string; name: string; email: string | null; team: string | null; role: string; status: string; created_at: string };
const del = "min-h-11 px-3 text-sm text-red-600 underline";
const KINDS = ["recap", "homework", "slides", "other"];

function Row({ title, sub, badge, children }: { title: string; sub?: string; badge?: { text: string; done: boolean }; children: React.ReactNode }) {
  return (
    <details className="rounded-xl border border-border px-3">
      <summary className="min-h-11 cursor-pointer py-2 text-sm"><span className="font-semibold">{title}</span>{sub && <span className="text-muted"> {sub}</span>}
        {badge && <span className={`ml-2 inline-block rounded-full px-2 py-0.5 text-xs font-bold ${badge.done ? "border border-good text-good" : "bg-tint text-primary"}`}>{badge.text}</span>}</summary>
      <div className="flex flex-col gap-2 pb-3">{children}</div>
    </details>
  );
}

const Picker = ({ people, chosen = [] }: { people: Person[]; chosen?: string[] }) => (
  <AssignPicker people={people.map((p) => ({ id: p.id, label: p.name || p.email || "(no name)" }))} chosen={chosen} />
);
const Id = ({ id }: { id: string }) => <input type="hidden" name="id" value={id} />;

export default async function Admin() {
  const profile = await getProfile();
  if (profile?.role !== "admin") redirect("/");
  const supabase = await createClient();
  const [
    { data: meetings }, { data: todos }, { data: assignments }, { data: peopleRaw }, { data: goal },
    { data: announcements }, { data: items }, { data: files }, { data: sets }, { data: setItems }, { data: allowed },
  ] = await Promise.all([
    supabase.from("meetings").select("id, title, meeting_date").order("meeting_date", { ascending: false }),
    (async () => {
      const r = await supabase.from("todos").select("id, title, description, due_date, requires_upload, everyone").order("due_date");
      // before migration 0013 there is no everyone column
      return r.error ? supabase.from("todos").select("id, title, description, due_date, requires_upload").order("due_date") : r;
    })() as unknown as Promise<{ data: { id: string; title: string; description: string; due_date: string; requires_upload: boolean; everyone?: boolean }[] | null }>,
    supabase.from("todo_assignments").select("todo_id, user_id, completed_at, upload_path"),
    supabase.rpc("admin_list_people"),
    supabase.from("trip_goal").select("title, target_xp").single(),
    supabase.from("announcements").select("id, title, body, pinned").order("created_at", { ascending: false }).limit(20),
    supabase.from("itinerary_items").select("id, day, start_time, end_time, title, location, map_url, notes").order("day", { ascending: false }).order("start_time").limit(60),
    supabase.from("files").select("id, title, kind, meeting_id").order("created_at", { ascending: false }),
    supabase.from("verse_sets").select("id, title, description").order("created_at", { ascending: false }),
    supabase.from("verse_set_items").select("set_id, ref, position").order("position"),
    supabase.from("allowed_emails").select("email").order("email"),
  ]);
  const people = (peopleRaw ?? []) as Person[];
  const approved = new Set(people.filter((p) => p.status === "approved").map((p) => p.id));
  const waiting = people.filter((p) => p.status === "pending");
  const denied = people.filter((p) => p.status === "rejected");
  const who = new Map(people.map((p) => [p.id, p.name || p.email]));
  const meetingOptions = (sel: string | null) => (
    <select className="input" name="meeting_id" defaultValue={sel ?? ""}>
      <option value="">No meeting</option>
      {meetings?.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
    </select>
  );

  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-extrabold">Admin</h1>
      <AdminTabs
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "people", label: "People", badge: waiting.length },
          { id: "todos", label: "To-dos" },
          { id: "content", label: "Content" },
          { id: "settings", label: "Settings" },
        ]}
        panels={{
          overview: (<>
      {waiting.length > 0 && (
        <p className="card text-sm font-semibold">{waiting.length} {waiting.length === 1 ? "person is" : "people are"} waiting for approval. Open the People tab.</p>
      )}
      <Section title="To-do completion" open>
        {(todos ?? []).length === 0 && <p className="text-sm text-muted">No to-dos yet.</p>}
        {(todos ?? []).map((t) => {
          const m = assignments?.filter((a) => a.todo_id === t.id && approved.has(a.user_id)) ?? [];
          const waitingOn = m.filter((a) => !a.completed_at);
          const done = m.length - waitingOn.length;
          const all = m.length > 0 && waitingOn.length === 0;
          return (
            <div key={t.id} className="rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold">{t.title} <span className="text-xs font-normal text-muted">due {t.due_date}</span></p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${all ? "border border-good text-good" : "bg-tint text-primary"}`}>{all ? "✓ Everyone done" : `${done}/${m.length}`}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-border" role="progressbar" aria-valuemin={0} aria-valuemax={m.length} aria-valuenow={done} aria-label={`${t.title} completion`}>
                <div className="h-full rounded-full bg-good" style={{ width: `${m.length ? (100 * done) / m.length : 0}%` }} />
              </div>
              {waitingOn.length > 0 && <p className="mt-2 text-sm text-muted">Waiting on: {waitingOn.map((a) => who.get(a.user_id)).join(", ")}</p>}
            </div>
          );
        })}
      </Section>
          </>),
          people: (<>
      <Section title={`Access requests (${waiting.length} waiting)`} open={waiting.length > 0}>
        <p className="text-xs text-muted">Anyone can ask to join by signing in. They see nothing until you approve them here. Denied people can be approved again at any time.</p>
        {waiting.length === 0 && <p className="text-sm text-muted">No one is waiting for approval.</p>}
        {waiting.map((p) => (
          <div key={p.id} className="rounded-xl border border-border p-3">
            <p className="font-semibold">{p.name || "(no name yet)"} <span className="text-xs font-normal text-muted">waiting</span></p>
            <p className="break-all text-sm text-muted">{p.email}</p>
            <div className="mt-2 flex gap-2">
              <ActionForm action={setAccess} label="Approve" className="flex-1"><Id id={p.id} /><input type="hidden" name="status" value="approved" /></ActionForm>
              <ActionForm action={setAccess} label="Deny" buttonClass="btn ghost" confirm={`Deny ${p.name || p.email}?`}><Id id={p.id} /><input type="hidden" name="status" value="rejected" /></ActionForm>
            </div>
          </div>
        ))}
        {denied.length > 0 && <h3 className="mt-2 text-sm font-bold">Denied ({denied.length})</h3>}
        {denied.map((p) => (
          <div key={p.id} className="rounded-xl border border-border p-3">
            <p className="font-semibold">{p.name || "(no name yet)"} <span className="text-xs font-normal text-muted">denied</span></p>
            <p className="break-all text-sm text-muted">{p.email}</p>
            <div className="mt-2 flex gap-2">
              <ActionForm action={setAccess} label="Approve instead" className="flex-1"><Id id={p.id} /><input type="hidden" name="status" value="approved" /></ActionForm>
            </div>
          </div>
        ))}
      </Section>
      <Section title={`People and teams (${approved.size})`}>
        {people.filter((p) => approved.has(p.id)).map((p) => (
          <div key={p.id} className="flex flex-col gap-1 border-b border-border pb-2">
            <ActionForm action={setTeam} label="Set" className="flex items-center gap-2 text-sm" buttonClass="btn !px-3 !py-1">
              <Id id={p.id} />
              <span className="min-w-0 flex-1 truncate">{p.name || p.email}{p.role === "admin" && <Star size={13} className="ml-1 inline -mt-0.5 text-accent" aria-label="Admin" />}</span>
              <input className="input !w-28 !py-1" name="team" defaultValue={p.team ?? ""} placeholder="Team" aria-label={`Team for ${p.name || p.email}`} />
            </ActionForm>
            <ActionForm action={deletePerson} label="Delete person" buttonClass={del} confirm={`Permanently delete ${p.name || p.email} and all their progress? This can't be undone.`}><Id id={p.id} /></ActionForm>
          </div>
        ))}
        {[...waiting, ...denied].map((p) => (
          <ActionForm key={p.id} action={deletePerson} label="Delete" buttonClass={del} className="flex items-center gap-2 text-sm" confirm={`Permanently delete ${p.name || p.email}?`}>
            <Id id={p.id} /><span className="min-w-0 flex-1 truncate text-muted">{p.name || p.email} ({p.status === "pending" ? "waiting" : "denied"})</span>
          </ActionForm>
        ))}
      </Section>
      <Section title={`Pre-approved emails (${allowed?.length ?? 0})`}>
        <p className="text-xs text-muted">Optional. Emails listed here are approved automatically when they first sign in, with no request step.</p>
        <ActionForm action={addAllowedEmails} label="Add emails" reset>
          <textarea className="input" name="emails" rows={4} placeholder={"One per line or comma separated:\nanna@example.com, ben@example.com"} required />
        </ActionForm>
        {allowed?.map((a) => (
          <div key={a.email} className="flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate">{a.email}</span>
            <ActionForm action={removeAllowedEmail} label="Remove" buttonClass={del} className="flex items-center gap-2">
              <input type="hidden" name="email" value={a.email} />
            </ActionForm>
          </div>
        ))}
      </Section>
          </>),
          todos: (<>
      <Section title="To-dos" open>
        {(() => {
          const states = (todos ?? []).map((t) => {
            const m = assignments?.filter((a) => a.todo_id === t.id && approved.has(a.user_id)) ?? [];
            return m.length > 0 && m.every((a) => a.completed_at);
          });
          return states.length > 0 && <p className="text-sm font-semibold">{states.filter(Boolean).length} of {states.length} to-dos finished by everyone</p>;
        })()}
        <ActionForm action={addTodo} label="Create and notify" reset>
          <input className="input" name="title" placeholder="e.g. Submit passport copy" required />
          <textarea className="input" name="description" placeholder="Details" rows={2} />
          <input className="input" name="due_date" type="date" required />
          <label className="text-sm"><input type="checkbox" name="requires_upload" /> Requires a file upload</label>
          <Picker people={people.filter((p) => approved.has(p.id))} />
          <p className="text-xs text-muted">Reminders go out 5 days, 1 day, and 0 days before the due date.</p>
        </ActionForm>
        {todos?.map((t) => {
          const mine = assignments?.filter((a) => a.todo_id === t.id && approved.has(a.user_id)) ?? [];
          const open = mine.filter((a) => !a.completed_at);
          const uploads = mine.filter((a) => a.upload_path);
          return (
            <Row key={t.id} title={t.title} sub={`due ${t.due_date}, ${mine.length - open.length}/${mine.length} done`}
              badge={mine.length === 0 ? undefined : open.length === 0 ? { text: "✓ Everyone done", done: true } : { text: `${open.length} waiting`, done: false }}>
              {open.length > 0 && <p className="text-sm text-muted">Waiting on: {open.map((a) => who.get(a.user_id)).join(", ")}</p>}
              {uploads.length > 0 && (
                <div className="flex flex-col text-sm">
                  <p className="font-semibold">Uploads</p>
                  {uploads.map((a) => <UploadLink key={a.user_id} todoId={t.id} userId={a.user_id} name={String(who.get(a.user_id) ?? "file")} />)}
                </div>
              )}
              <ActionForm action={updateTodo} label="Save">
                <Id id={t.id} />
                <input className="input" name="title" defaultValue={t.title} required />
                <textarea className="input" name="description" defaultValue={t.description} rows={2} />
                <input className="input" name="due_date" type="date" defaultValue={t.due_date} required />
                <label className="text-sm"><input type="checkbox" name="requires_upload" defaultChecked={t.requires_upload} /> Requires a file upload</label>
                {t.everyone === false && <input type="hidden" name="scoped" value="1" />}
                <Picker people={people.filter((p) => approved.has(p.id))} chosen={t.everyone === false ? mine.map((a) => a.user_id) : []} />
              </ActionForm>
              <ActionForm action={deleteTodo} label="Delete to-do" buttonClass={del} confirm="Delete this to-do for everyone?"><Id id={t.id} /></ActionForm>
            </Row>
          );
        })}
        <ActionForm action={assignMissing} label="Repair missing assignments" buttonClass="min-h-11 px-3 text-sm text-muted underline" />
      </Section>
          </>),
          content: (<>
      <Section title="Announcements">
        <ActionForm action={postAnnouncement} label="Post" reset>
          <input className="input" name="title" placeholder="Title" required />
          <textarea className="input" name="body" placeholder="Message" rows={4} />
          <label className="text-sm"><input type="checkbox" name="push" defaultChecked /> Send push notification</label>
          <label className="text-sm"><input type="checkbox" name="pinned" /> Pin to top</label>
        </ActionForm>
        {announcements?.map((a) => (
          <Row key={a.id} title={a.title} sub={a.pinned ? "(pinned)" : undefined}>
            <ActionForm action={updateAnnouncement} label="Save (no new push)">
              <Id id={a.id} />
              <input className="input" name="title" defaultValue={a.title} required />
              <textarea className="input" name="body" defaultValue={a.body} rows={4} />
              <label className="text-sm"><input type="checkbox" name="pinned" defaultChecked={a.pinned} /> Pin to top</label>
            </ActionForm>
            <ActionForm action={deleteAnnouncement} label="Delete" buttonClass={del} confirm="Delete this announcement?"><Id id={a.id} /></ActionForm>
          </Row>
        ))}
      </Section>
      <Section title="Itinerary">
        <ActionForm action={addItineraryItem} label="Add" reset>
          <input className="input" name="day" type="date" required />
          <div className="flex gap-2">
            <input className="input" name="start_time" type="time" />
            <input className="input" name="end_time" type="time" />
          </div>
          <input className="input" name="title" placeholder="Title" required />
          <input className="input" name="location" placeholder="Location" />
          <input className="input" name="map_url" placeholder="Map link (optional)" />
          <textarea className="input" name="notes" placeholder="Notes" rows={2} />
        </ActionForm>
        {items?.map((i) => (
          <Row key={i.id} title={i.title} sub={`${i.day} ${i.start_time?.slice(0, 5) ?? ""}`}>
            <ActionForm action={updateItineraryItem} label="Save">
              <Id id={i.id} />
              <input className="input" name="day" type="date" defaultValue={i.day} required />
              <div className="flex gap-2">
                <input className="input" name="start_time" type="time" defaultValue={i.start_time?.slice(0, 5) ?? ""} />
                <input className="input" name="end_time" type="time" defaultValue={i.end_time?.slice(0, 5) ?? ""} />
              </div>
              <input className="input" name="title" defaultValue={i.title} required />
              <input className="input" name="location" defaultValue={i.location ?? ""} placeholder="Location" />
              <input className="input" name="map_url" defaultValue={i.map_url ?? ""} placeholder="Map link (optional)" />
              <textarea className="input" name="notes" defaultValue={i.notes ?? ""} rows={2} />
            </ActionForm>
            <ActionForm action={deleteItineraryItem} label="Delete" buttonClass={del} confirm="Delete this itinerary item?"><Id id={i.id} /></ActionForm>
          </Row>
        ))}
      </Section>
      <Section title="Meetings and files">
        <ActionForm action={addMeeting} label="Add meeting" reset>
          <input className="input" name="title" placeholder="e.g. Prep meeting 2" required />
          <input className="input" name="meeting_date" type="date" required />
        </ActionForm>
        {meetings?.map((m) => (
          <Row key={m.id} title={m.title} sub={m.meeting_date}>
            <ActionForm action={updateMeeting} label="Save">
              <Id id={m.id} />
              <input className="input" name="title" defaultValue={m.title} required />
              <input className="input" name="meeting_date" type="date" defaultValue={m.meeting_date} required />
            </ActionForm>
            <ActionForm action={deleteMeeting} label="Delete" buttonClass={del} confirm="Delete this meeting? Its files stay."><Id id={m.id} /></ActionForm>
          </Row>
        ))}
        <h3 className="mt-2 font-bold">Upload file</h3>
        <FileUpload meetings={meetings ?? []} />
        {files?.map((f) => (
          <Row key={f.id} title={f.title} sub={f.kind}>
            <ActionForm action={updateFile} label="Save">
              <Id id={f.id} />
              <input className="input" name="title" defaultValue={f.title} required />
              <select className="input" name="kind" defaultValue={f.kind}>
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
              {meetingOptions(f.meeting_id)}
            </ActionForm>
            <ActionForm action={deleteFile} label="Delete file" buttonClass={del} confirm="Delete this file for everyone?"><Id id={f.id} /></ActionForm>
          </Row>
        ))}
      </Section>
      <Section title="Verse sets">
        <ActionForm action={addVerseSet} label="Publish set" reset>
          <input className="input" name="title" placeholder="e.g. Core verses for the trip" required />
          <input className="input" name="description" placeholder="Short description" />
          <textarea className="input" name="refs" placeholder={"One reference per line:\nJean 3:16\nRomains 8:38-39"} rows={4} required />
        </ActionForm>
        {sets?.map((s) => (
          <Row key={s.id} title={s.title}>
            <ActionForm action={updateVerseSet} label="Save">
              <Id id={s.id} />
              <input className="input" name="title" defaultValue={s.title} required />
              <input className="input" name="description" defaultValue={s.description} />
              <textarea className="input" name="refs" defaultValue={setItems?.filter((i) => i.set_id === s.id).map((i) => i.ref).join("\n")} rows={4} required />
            </ActionForm>
            <ActionForm action={deleteVerseSet} label="Delete set" buttonClass={del} confirm="Delete this verse set?"><Id id={s.id} /></ActionForm>
          </Row>
        ))}
      </Section>
          </>),
          settings: (<>
      <Section title="Group goal">
        <ActionForm action={updateGoal} label="Save goal">
          <input className="input" name="title" defaultValue={goal?.title} required />
          <label className="text-sm text-muted">Total XP to raise the full spire
            <input className="input" name="target_xp" type="number" min="100" defaultValue={goal?.target_xp} required /></label>
        </ActionForm>
      </Section>
          </>),
        }}
      />
    </div>
  );
}
