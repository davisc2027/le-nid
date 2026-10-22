"use server";

import { revalidatePath } from "next/cache";
import { createClient, getProfile } from "@/lib/supabase/server";
import { sendPushToAll } from "@/lib/push";

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
