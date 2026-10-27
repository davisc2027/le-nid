"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceClient, getProfile } from "@/lib/supabase/server";
import { sendPushToAll } from "@/lib/push";
import { parseRef, refKey } from "@/lib/bible/reference";
import type { State } from "@/components/admin/ActionForm";

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function requireAdmin() {
  const profile = await getProfile();
  if (profile?.role !== "admin") throw new Error("Admins only");
  return createClient();
}

const text = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

/** Runs an admin action and turns thrown errors into a message the form can show. */
async function run(fn: (supabase: Supabase) => Promise<string>, paths: string[] = []): Promise<State> {
  try {
    const supabase = await requireAdmin();
    const ok = await fn(supabase);
    paths.forEach((p) => revalidatePath(p));
    revalidatePath("/admin");
    return { ok };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function mapUrl(raw: string) {
  if (!raw) return null;
  const url = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try { return new URL(url).href; } catch { throw new Error("That map link does not look like a web address"); }
}

async function push(payload: Parameters<typeof sendPushToAll>[0], ids?: string[]) {
  try { await sendPushToAll(payload, ids); return ""; } catch { return " (push notification failed)"; }
}

export async function postAnnouncement(_: State, f: FormData) {
  return run(async (supabase) => {
    const title = text(f, "title");
    const body = text(f, "body");
    const since = new Date(Date.now() - 120_000).toISOString();
    const { data: dup } = await supabase.from("announcements").select("id").eq("title", title).eq("body", body).gte("created_at", since).limit(1);
    if (dup?.length) return "Already posted";
    fail((await supabase.from("announcements").insert({ title, body, pinned: f.get("pinned") === "on" })).error);
    const note = f.get("push") === "on" ? await push({ title, body: body.slice(0, 140), url: "/" }) : "";
    return `Posted${note}`;
  }, ["/"]);
}

export async function updateAnnouncement(_: State, f: FormData) {
  return run(async (supabase) => {
    fail((await supabase.from("announcements")
      .update({ title: text(f, "title"), body: text(f, "body"), pinned: f.get("pinned") === "on" }).eq("id", text(f, "id"))).error);
    return "Saved";
  }, ["/"]);
}

export async function deleteAnnouncement(_: State, f: FormData) {
  return run(async (supabase) => {
    fail((await supabase.from("announcements").delete().eq("id", text(f, "id"))).error);
    return "Deleted";
  }, ["/"]);
}

function itineraryFields(f: FormData) {
  return {
    day: text(f, "day"),
    start_time: text(f, "start_time") || null,
    end_time: text(f, "end_time") || null,
    title: text(f, "title"),
    location: text(f, "location") || null,
    map_url: mapUrl(text(f, "map_url")),
    notes: text(f, "notes") || null,
  };
}

export async function addItineraryItem(_: State, f: FormData) {
  return run(async (supabase) => {
    fail((await supabase.from("itinerary_items").insert(itineraryFields(f))).error);
    return "Added";
  }, ["/itinerary"]);
}

export async function updateItineraryItem(_: State, f: FormData) {
  return run(async (supabase) => {
    fail((await supabase.from("itinerary_items").update(itineraryFields(f)).eq("id", text(f, "id"))).error);
    return "Saved";
  }, ["/itinerary"]);
}

export async function deleteItineraryItem(_: State, f: FormData) {
  return run(async (supabase) => {
    fail((await supabase.from("itinerary_items").delete().eq("id", text(f, "id"))).error);
    return "Deleted";
  }, ["/itinerary"]);
}

export async function addMeeting(_: State, f: FormData) {
  return run(async (supabase) => {
    fail((await supabase.from("meetings").insert({ title: text(f, "title"), meeting_date: text(f, "meeting_date") })).error);
    return "Added";
  }, ["/files"]);
}

export async function updateMeeting(_: State, f: FormData) {
  return run(async (supabase) => {
    fail((await supabase.from("meetings").update({ title: text(f, "title"), meeting_date: text(f, "meeting_date") }).eq("id", text(f, "id"))).error);
    return "Saved";
  }, ["/files"]);
}

export async function deleteMeeting(_: State, f: FormData) {
  return run(async (supabase) => {
    fail((await supabase.from("meetings").delete().eq("id", text(f, "id"))).error);
    return "Deleted (its files stay, without a meeting)";
  }, ["/files"]);
}

export async function updateFile(_: State, f: FormData) {
  return run(async (supabase) => {
    fail((await supabase.from("files").update({ title: text(f, "title"), kind: text(f, "kind"), meeting_id: text(f, "meeting_id") || null }).eq("id", text(f, "id"))).error);
    return "Saved";
  }, ["/files"]);
}

export async function deleteFile(_: State, f: FormData) {
  return run(async (supabase) => {
    const id = text(f, "id");
    const { data: file } = await supabase.from("files").select("storage_path").eq("id", id).single();
    fail((await supabase.from("files").delete().eq("id", id)).error);
    if (file) await supabase.storage.from("files").remove([file.storage_path]);
    return "Deleted";
  }, ["/files"]);
}

export async function addTodo(_: State, f: FormData) {
  return run(async (supabase) => {
    const title = text(f, "title");
    const due_date = text(f, "due_date");
    const since = new Date(Date.now() - 120_000).toISOString();
    const { data: dup } = await supabase.from("todos").select("id").eq("title", title).eq("due_date", due_date).gte("created_at", since).limit(1);
    if (dup?.length) return "Already created";
    const chosen = f.get("audience") === "individuals" ? f.getAll("assign").map(String).filter(Boolean) : [];
    if (f.get("audience") === "individuals" && !chosen.length) throw new Error("Choose at least one person, or switch to Everyone");
    const { data: todo, error } = await supabase.from("todos")
      .insert({ title, description: text(f, "description"), due_date, requires_upload: f.get("requires_upload") === "on", ...(chosen.length && { everyone: false }) })
      .select("id").single();
    fail(error);
    const { data: people } = await supabase.from("profiles").select("id").eq("status", "approved");
    const ids = (people ?? []).map((p) => p.id).filter((id) => !chosen.length || chosen.includes(id));
    let note = "";
    if (ids.length) {
      fail((await supabase.from("todo_assignments").insert(ids.map((user_id) => ({ todo_id: todo!.id, user_id })))).error);
      note = await push({ title: "New to-do", body: `${title} (due ${due_date})`, url: "/todos" }, ids);
    }
    return `Created for ${chosen.length ? "" : "all "}${ids.length} ${ids.length === 1 ? "person" : "people"}${note}`;
  }, ["/todos"]);
}

export async function updateTodo(_: State, f: FormData) {
  return run(async (supabase) => {
    const id = text(f, "id");
    const chosen = f.get("audience") === "individuals" ? f.getAll("assign").map(String).filter(Boolean) : [];
    if (f.get("audience") === "individuals" && !chosen.length) throw new Error("Choose at least one person, or switch to Everyone");
    const wasScoped = f.get("scoped") === "1";
    fail((await supabase.from("todos").update({
      title: text(f, "title"), description: text(f, "description"), due_date: text(f, "due_date"),
      requires_upload: f.get("requires_upload") === "on",
      ...(chosen.length ? { everyone: false } : wasScoped ? { everyone: true } : {}),
    }).eq("id", id)).error);
    if (!chosen.length) {
      // Back to everyone: give it to any approved person who is missing it.
      if (wasScoped) {
        const [{ data: people }, { data: have }] = await Promise.all([
          supabase.from("profiles").select("id").eq("status", "approved"),
          supabase.from("todo_assignments").select("user_id").eq("todo_id", id),
        ]);
        const got = new Set(have?.map((a) => a.user_id));
        const rows = (people ?? []).filter((p) => !got.has(p.id)).map((p) => ({ todo_id: id, user_id: p.id }));
        if (rows.length) fail((await supabase.from("todo_assignments").insert(rows)).error);
      }
      return "Saved";
    }
    const { data: have } = await supabase.from("todo_assignments").select("user_id, completed_at").eq("todo_id", id);
    const got = new Set(have?.map((a) => a.user_id));
    const add = chosen.filter((u) => !got.has(u));
    if (add.length) {
      fail((await supabase.from("todo_assignments").insert(add.map((user_id) => ({ todo_id: id, user_id })))).error);
      await push({ title: "New to-do", body: `${text(f, "title")} (due ${text(f, "due_date")})`, url: "/todos" }, add);
    }
    // People taken off it lose it, unless they already finished it.
    const drop = (have ?? []).filter((a) => !chosen.includes(a.user_id) && !a.completed_at).map((a) => a.user_id);
    if (drop.length) fail((await supabase.from("todo_assignments").delete().eq("todo_id", id).in("user_id", drop)).error);
    return `Saved. Added ${add.length}, removed ${drop.length}`;
  }, ["/todos"]);
}

export async function deleteTodo(_: State, f: FormData) {
  return run(async (supabase) => {
    fail((await supabase.from("todos").delete().eq("id", text(f, "id"))).error);
    return "Deleted";
  }, ["/todos"]);
}

/** Safety net: new sign-ups get to-dos automatically, this repairs any gaps. */
export async function assignMissing(): Promise<State> {
  return run(async (supabase) => {
    const [{ data: todos }, { data: people }, { data: have }] = await Promise.all([
      (async () => {
        const r = await supabase.from("todos").select("id").eq("everyone", true);
        return r.error ? supabase.from("todos").select("id") : r; // before migration 0013 there is no everyone column
      })(),
      supabase.from("profiles").select("id").eq("status", "approved"),
      supabase.from("todo_assignments").select("todo_id, user_id"),
    ]);
    const existing = new Set(have?.map((a) => `${a.todo_id}:${a.user_id}`));
    const rows = (todos ?? []).flatMap((t) => (people ?? [])
      .filter((p) => !existing.has(`${t.id}:${p.id}`)).map((p) => ({ todo_id: t.id, user_id: p.id })));
    if (rows.length) fail((await supabase.from("todo_assignments").insert(rows)).error);
    return `Added ${rows.length} missing assignments`;
  }, ["/todos"]);
}

/** Signed link (60 s) to a member's uploaded file, for the admin console. */
export async function viewUpload(todoId: string, userId: string): Promise<{ url?: string; error?: string }> {
  try {
    const supabase = await requireAdmin();
    const { data: a } = await supabase.from("todo_assignments").select("upload_path").eq("todo_id", todoId).eq("user_id", userId).single();
    if (!a?.upload_path) return { error: "No upload" };
    const { data, error } = await supabase.storage.from("todo-uploads").createSignedUrl(a.upload_path, 60);
    if (error || !data) return { error: error?.message ?? "Could not create link" };
    return { url: data.signedUrl };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Something went wrong" };
  }
}

function parseRefs(raw: string) {
  const refs = raw.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
    const r = parseRef(l);
    if (!r) throw new Error(`Could not read reference: ${l}`);
    return refKey(r);
  });
  if (!refs.length) throw new Error("Add at least one reference");
  return [...new Set(refs)];
}

/** Leader verse set: one reference per line, e.g. "Jean 3:16". */
export async function addVerseSet(_: State, f: FormData) {
  return run(async (supabase) => {
    const refs = parseRefs(text(f, "refs"));
    const { data: set, error } = await supabase.from("verse_sets")
      .insert({ title: text(f, "title"), description: text(f, "description") }).select("id").single();
    fail(error);
    const { error: e2 } = await supabase.from("verse_set_items").insert(refs.map((ref, position) => ({ set_id: set!.id, ref, position })));
    if (e2) {
      await supabase.from("verse_sets").delete().eq("id", set!.id);
      throw new Error(e2.message);
    }
    return "Published";
  }, ["/scripture"]);
}

export async function updateVerseSet(_: State, f: FormData) {
  return run(async (supabase) => {
    const id = text(f, "id");
    const refs = parseRefs(text(f, "refs"));
    fail((await supabase.from("verse_sets").update({ title: text(f, "title"), description: text(f, "description") }).eq("id", id)).error);
    fail((await supabase.from("verse_set_items").delete().eq("set_id", id)).error);
    fail((await supabase.from("verse_set_items").insert(refs.map((ref, position) => ({ set_id: id, ref, position })))).error);
    return "Saved";
  }, ["/scripture"]);
}

export async function deleteVerseSet(_: State, f: FormData) {
  return run(async (supabase) => {
    fail((await supabase.from("verse_sets").delete().eq("id", text(f, "id"))).error);
    return "Deleted";
  }, ["/scripture"]);
}

export async function setTeam(_: State, f: FormData) {
  return run(async (supabase) => {
    fail((await supabase.rpc("admin_set_team", { p_id: text(f, "id"), p_team: text(f, "team") })).error);
    return "Saved";
  }, ["/together"]);
}

export async function updateGoal(_: State, f: FormData) {
  return run(async (supabase) => {
    const target_xp = Number(text(f, "target_xp"));
    if (!Number.isFinite(target_xp) || target_xp < 1) throw new Error("Enter a valid XP number");
    fail((await supabase.from("trip_goal").update({ title: text(f, "title"), target_xp: Math.round(target_xp) }).eq("id", 1)).error);
    return "Saved";
  }, ["/together", "/"]);
}

/** Bulk-add sign-up emails: one per line or comma separated. */
export async function addAllowedEmails(_: State, f: FormData) {
  return run(async (supabase) => {
    const all = text(f, "emails").toLowerCase().split(/[\s,;]+/).filter(Boolean);
    const good = [...new Set(all.filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))];
    const bad = all.filter((e) => !good.includes(e));
    if (!good.length) throw new Error(bad.length ? `Not valid emails: ${bad.join(", ")}` : "Paste at least one email");
    fail((await supabase.from("allowed_emails").upsert(good.map((email) => ({ email })), { onConflict: "email", ignoreDuplicates: true })).error);
    return `Added ${good.length}${bad.length ? `. Skipped: ${bad.join(", ")}` : ""}`;
  });
}

export async function removeAllowedEmail(_: State, f: FormData) {
  return run(async (supabase) => {
    fail((await supabase.from("allowed_emails").delete().eq("email", text(f, "email"))).error);
    return "Removed";
  });
}

export async function setAccess(_: State, f: FormData) {
  return run(async (supabase) => {
    const status = text(f, "status");
    fail((await supabase.rpc("admin_set_status", { p_id: text(f, "id"), p_status: status })).error);
    return status === "approved" ? "Approved. They can now sign in and use the app." : "Denied";
  });
}

/** Permanently deletes a person's account and everything tied to it. Service role is used only after the admin check. */
export async function deletePerson(_: State, f: FormData) {
  return run(async () => {
    const id = text(f, "id");
    const me = await getProfile();
    if (!id) throw new Error("Missing person");
    if (me?.id === id) throw new Error("You can't delete your own account");
    const { error } = await createServiceClient().auth.admin.deleteUser(id);
    if (error) throw new Error(error.message);
    return "Deleted";
  });
}

/** Pushes "new resource" to everyone after a file goes up with no future release time. */
export async function announceFile(title: string) {
  try {
    await requireAdmin();
    await sendPushToAll({ title: "New resource", body: title.slice(0, 100), url: "/files" });
  } catch { /* the file is already saved; a failed push is not worth an error */ }
}

/** For someone whose emailed code never arrives: makes a one-time 8-digit code the admin can send them privately. */
export async function signInCode(_: State, f: FormData) {
  return run(async () => {
    const email = text(f, "email").toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email");
    const { data, error } = await createServiceClient().auth.admin.generateLink({ type: "magiclink", email });
    const code = data?.properties?.email_otp;
    if (error || !code) throw new Error(error?.message ?? "Couldn't make a code");
    return `Code for ${email}: ${code}. Send it to them privately. It works once and expires within an hour.`;
  });
}
