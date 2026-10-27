"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { announceFile } from "@/app/(app)/admin/actions";
import DateInput from "@/components/DateInput";
import { createClient } from "@/lib/supabase/client";

type Meeting = { id: string; title: string };

// Uploads straight from the browser to Supabase Storage (avoids server-action size limits).
// RLS only lets admins write to the bucket and the files table.
export default function FileUpload({ meetings }: { meetings: Meeting[] }) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = e.currentTarget;
    const f = new FormData(form);
    const file = f.get("file") as File;
    const supabase = createClient();
    const path = `${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
    setBusy(true);
    setMsg("Uploading…");
    try {
      const up = await supabase.storage.from("files").upload(path, file);
      if (up.error) return setMsg(up.error.message);
      const release = String(f.get("release_at") || "");
      const { error } = await supabase.from("files").insert({
        title: String(f.get("title")),
        kind: String(f.get("kind")),
        meeting_id: String(f.get("meeting_id")) || null,
        storage_path: path,
        ...(release && { release_at: new Date(release).toISOString() }),
      });
      if (error) {
        await supabase.storage.from("files").remove([path]);
        return setMsg(error.message);
      }
      if (!release || new Date(release).getTime() <= Date.now()) void announceFile(String(f.get("title")));
      setMsg("Uploaded.");
      form.reset();
      router.refresh();
    } catch {
      setMsg("Upload failed. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <input className="input" name="title" placeholder="Title" required />
      <input className="input" name="file" type="file" required />
      <select className="input" name="kind" defaultValue="slides">
        <option value="recap">Recap</option><option value="homework">Homework</option>
        <option value="slides">Slides</option><option value="other">Other</option>
      </select>
      <select className="input" name="meeting_id" defaultValue="">
        <option value="">No meeting</option>
        {meetings.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
      </select>
      <label className="text-sm text-muted">Release at (blank = now)
        <DateInput className="input" name="release_at" type="datetime-local" />
      </label>
      <button className="btn" disabled={busy}>{busy ? "Uploading…" : "Upload"}</button>
      {msg && <p className="text-sm text-muted" role="status">{msg}</p>}
    </form>
  );
}
