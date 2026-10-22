"use server";

import { revalidatePath } from "next/cache";
import { createClient, getProfile } from "@/lib/supabase/server";
import { sendPushToAll } from "@/lib/push";
import { parseRef, refKey } from "@/lib/bible/reference";

async function requireAdmin() {
  const profile = await getProfile();
  if (profile?.role !== "admin") throw new Error("Admins only");
  return createClient();
}

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function postAnnouncement(f: FormData) {
  const supabase = await requireAdmin();
  const title = text(f, "title");
  const body = text(f, "body");
  const { error } = await supabase.from("announcements")
    .insert({ title, body, pinned: f.get("pinned") === "on" });
  if (error) throw new Error(error.message);
  if (f.get("push") === "on") await sendPushToAll({ title, body: body.slice(0, 140), url: "/" });
  revalidatePath("/");
}

export async function addItineraryItem(f: FormData) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("itinerary_items").insert({
    day: text(f, "day"),
    start_time: text(f, "start_time") || null,
    end_time: text(f, "end_time") || null,
    title: text(f, "title"),
    location: text(f, "location") || null,
    map_url: text(f, "map_url") || null,
    notes: text(f, "notes") || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/itinerary");
}

export async function addMeeting(f: FormData) {
  const supabase = await requireAdmin();
  const { error } = await supabase.from("meetings")
    .insert({ title: text(f, "title"), meeting_date: text(f, "meeting_date") });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/files");
}

export async function addTodo(f: FormData) {
  const supabase = await requireAdmin();
  const title = text(f, "title");
  const due_date = text(f, "due_date");
  const { data: todo, error } = await supabase.from("todos")
    .insert({ title, description: text(f, "description"), due_date, requires_upload: f.get("requires_upload") === "on" })
    .select("id").single();
  if (error) throw new Error(error.message);
  const { data: people } = await supabase.from("profiles").select("id").eq("role", "member");
  const ids = (people ?? []).map((p) => p.id);
  if (ids.length) {
    const { error: e2 } = await supabase.from("todo_assignments").insert(ids.map((user_id) => ({ todo_id: todo.id, user_id })));
    if (e2) throw new Error(e2.message);
    await sendPushToAll({ title: "New to-do", body: `${title} (due ${due_date})`, url: "/todos" }, ids);
  }
  revalidatePath("/admin");
  revalidatePath("/todos");
}

/** Assigns every existing to-do to members who joined after it was created. */
export async function assignMissing() {
  const supabase = await requireAdmin();
  const [{ data: todos }, { data: people }, { data: have }] = await Promise.all([
    supabase.from("todos").select("id"),
    supabase.from("profiles").select("id").eq("role", "member"),
    supabase.from("todo_assignments").select("todo_id, user_id"),
  ]);
  const existing = new Set(have?.map((a) => `${a.todo_id}:${a.user_id}`));
  const rows = (todos ?? []).flatMap((t) => (people ?? [])
    .filter((p) => !existing.has(`${t.id}:${p.id}`)).map((p) => ({ todo_id: t.id, user_id: p.id })));
  if (rows.length) await supabase.from("todo_assignments").insert(rows);
  revalidatePath("/admin");
}

/** Leader verse set: one reference per line, e.g. "Jean 3:16". */
export async function addVerseSet(f: FormData) {
  const supabase = await requireAdmin();
  const refs = text(f, "refs").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const r = parseRef(l);
    if (!r) throw new Error(`Could not read reference: ${l}`);
    return refKey(r);
  });
  const { data: set, error } = await supabase.from("verse_sets")
    .insert({ title: text(f, "title"), description: text(f, "description") }).select("id").single();
  if (error) throw new Error(error.message);
  const { error: e2 } = await supabase.from("verse_set_items").insert(refs.map((ref, position) => ({ set_id: set.id, ref, position })));
  if (e2) throw new Error(e2.message);
  revalidatePath("/scripture");
}
