"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AdoptSet({ refs }: { refs: string[] }) {
  const router = useRouter();
  async function adopt() {
    await createClient().from("srs_cards").upsert(refs.map((ref) => ({ ref })), { onConflict: "user_id,ref", ignoreDuplicates: true });
    router.refresh();
  }
  return <button className="btn ghost self-start" onClick={adopt}>Add all to my verses</button>;
}
