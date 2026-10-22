"use client";

import { useState } from "react";
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

  return (
    <div className={`card flex flex-col gap-2 ${p.completed ? "opacity-60" : ""}`}>
      <div className="flex justify-between gap-2">
        <h2 className="font-bold">{p.completed && "✓ "}{p.title}</h2>
        <span className="shrink-0 text-xs text-muted">Due {p.dueDate}</span>
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
