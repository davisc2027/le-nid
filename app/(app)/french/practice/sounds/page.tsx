import { createClient } from "@/lib/supabase/server";
import SoundsPractice from "@/components/speech/SoundsPractice";

export default async function SoundsPage() {
  let completed: string[] = [];
  try {
    const { data, error } = await (await createClient()).from("lesson_progress").select("lesson_id");
    if (!error && data) completed = data.map((d) => d.lesson_id);
  } catch {
    completed = [];
  }
  return <SoundsPractice completed={completed} />;
}
