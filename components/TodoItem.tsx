"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
    if (file) {
      upload_path = `${p.userId}/${p.todoId}-${file.name.replace(/[^\w.-]/g, "_")}`;
      setMsg("Uploading…");
      const up = await supabase.storage.from("todo-uploads").upload(upload_path, file, { upsert: true });
      if (up.error) return setMsg(up.error.message);
    }
    const { error } = await supabase.from("todo_assignments")
      .update({ completed_at: new Date().toISOString(), ...(upload_path && { upload_path }) })
      .eq("todo_id", p.todoId).eq("user_id", p.userId);
    if (error) return setMsg(error.message);
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
          <input className="input mt-1" type="file" onChange={(e) => e.target.files?.[0] && complete(e.target.files[0])} />
        </label>
      ) : (
        <button className="btn" onClick={() => complete()}>Mark done</button>
      )}
      {msg && <p className="text-sm text-muted">{msg}</p>}
    </div>
  );
}
