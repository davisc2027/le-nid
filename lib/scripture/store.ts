// Where verse progress lives: always in this browser's localStorage (works offline and before migration 0011),
// and also in srs_cards.progress once that column exists. Saving to the database is best effort: a missing
// column (migration not run yet) turns database saves off for the session without any error on screen.
import { createClient } from "@/lib/supabase/client";
import { newest, parseProgress, serialize, type Progress } from "./mastery";

const key = (ref: string) => `le-nid-verse:${ref}`;

export function loadLocal(ref: string): Progress | null {
  try { return parseProgress(localStorage.getItem(key(ref))); } catch { return null; }
}

function saveLocal(ref: string, p: Progress) {
  try { localStorage.setItem(key(ref), JSON.stringify(serialize(p))); } catch {}
}

let dbReady = true; // false once the database said the progress column is missing
const pending = new Map<string, ReturnType<typeof setTimeout>>();

/** True for "column does not exist" style errors (Postgres 42703, PostgREST schema cache PGRST204). */
export const missingColumn = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "42703" || e.code === "PGRST204" || /progress/i.test(e.message ?? ""));

async function saveRemote(ref: string, p: Progress) {
  if (!dbReady) return;
  try {
    const { error } = await createClient().from("srs_cards").upsert({ ref, progress: serialize(p) }, { onConflict: "user_id,ref" });
    if (missingColumn(error)) dbReady = false;
  } catch {} // offline: localStorage still has it, and the next step saves again
}

/** Saves now to this device and, shortly after (or immediately with `flush`), to the database. */
export function saveProgress(ref: string, p: Progress, flush = false) {
  saveLocal(ref, p);
  const t = pending.get(ref);
  if (t) clearTimeout(t);
  if (flush) { pending.delete(ref); void saveRemote(ref, p); return; }
  pending.set(ref, setTimeout(() => { pending.delete(ref); void saveRemote(ref, p); }, 600));
}

/** The newer of the database copy and this device's copy. */
export const mergeSaved = (ref: string, server: unknown) => newest(parseProgress(server), loadLocal(ref));
