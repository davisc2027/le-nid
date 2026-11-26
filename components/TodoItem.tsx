"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TODO_RULE, TODO_UPLOAD_MAX_BYTES, checkUpload, mimeOf } from "@/lib/uploads";

type Props = {
  todoId: string; userId: string; title: string; description: string;
  dueDate: string; requiresUpload: boolean; completed: boolean; hasUpload: boolean;
};

export default function TodoItem(p: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const supabase = createClient();

  async function complete(file?: File) {
    let upload_path: string | undefined;
    let previous: string | null = null;
    if (file) {
      const problem = checkUpload(file, TODO_RULE);
      if (problem) return setMsg(problem);
      // One fixed object per (person, to-do): a second upload replaces the first instead of leaving a stray copy.
      upload_path = `${p.userId}/${p.todoId}`;
      setMsg("Uploading…");
      const { data: row } = await supabase.from("todo_assignments").select("upload_path")
        .eq("todo_id", p.todoId).eq("user_id", p.userId).maybeSingle();
      previous = row?.upload_path ?? null;
      const up = await supabase.storage.from("todo-uploads").upload(upload_path, file, { upsert: true, contentType: mimeOf(file) });
      if (up.error) return setMsg(up.error.message);
    }
    const { error } = await supabase.from("todo_assignments")
      .update({ completed_at: new Date().toISOString(), ...(upload_path && { upload_path }) })
      .eq("todo_id", p.todoId).eq("user_id", p.userId);
    if (error) return setMsg(error.message);
    // Files uploaded before this change were named after the original file. Drop the old one now it is replaced.
    if (upload_path && previous && previous !== upload_path && previous.startsWith(`${p.userId}/`)) {
      await supabase.storage.from("todo-uploads").remove([previous]);
    }
    setMsg("");
    router.refresh();
  }

  async function undo() {
    await supabase.from("todo_assignments").update({ completed_at: null })
      .eq("todo_id", p.todoId).eq("user_id", p.userId);
    router.refresh();
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Paris" });
  const days = Math.round((Date.parse(p.dueDate) - Date.parse(today)) / 86_400_000);
  const late = !p.completed && days < 0;
  const soon = !p.completed && days >= 0 && days <= 3;
  // Built by hand: toLocaleDateString punctuation differs between server and browser ICU and breaks hydration.
  const dd = new Date(p.dueDate + "T12:00:00Z");
  const due = `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][dd.getUTCDay()]} ${dd.getUTCDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][dd.getUTCMonth()]}`;

  return (
    <div className={`card flex flex-col gap-2 ${p.completed ? "opacity-60" : ""}`}>
      <div className="flex justify-between gap-2">
        <h2 className="font-bold">{p.completed && <Check size={18} className="mr-1 inline -mt-0.5 text-good" aria-label="Done" />}{p.title}</h2>
        <span className={`shrink-0 self-start rounded-full px-2 py-0.5 text-xs font-bold ${late ? "bg-primary text-primary-fg" : soon ? "bg-accent text-[#2b2118]" : "text-muted"}`}>
          {late ? "Overdue · " : "Due "}{due}
        </span>
      </div>
      {p.description && <p className="whitespace-pre-wrap text-sm">{p.description}</p>}
      {p.completed ? (
        <button className="text-left text-sm text-muted underline" onClick={undo}>Mark not done</button>
      ) : p.requiresUpload ? (
        <label className="text-sm">Upload your file to finish
          <input className="input mt-1" type="file" accept=".pdf,image/jpeg,image/png,image/heic,image/heif,image/webp"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void complete(f); e.target.value = ""; }} />
          <span className="mt-1 block text-xs text-muted">A PDF or a photo, up to {TODO_UPLOAD_MAX_BYTES / 1048576} MB.</span>
        </label>
      ) : (
        <button className="btn" onClick={() => complete()}>Mark done</button>
      )}
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </div>
  );
}
