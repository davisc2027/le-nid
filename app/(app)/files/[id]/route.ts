import { createClient } from "@/lib/supabase/server";

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wantsJson = new URL(req.url).searchParams.get("json") === "1";
  const supabase = await createClient();
  // RLS on `files` and on the storage bucket still decides who may read this.
  const { data: file } = await supabase.from("files").select("storage_path").eq("id", id).maybeSingle();
  if (!file) return wantsJson ? Response.json({ error: "Not found" }, { status: 404, headers: NO_STORE }) : new Response("Not found", { status: 404, headers: NO_STORE });
  const { data } = await supabase.storage.from("files").createSignedUrl(file.storage_path, 120);
  if (!data?.signedUrl) return wantsJson ? Response.json({ error: "Not found" }, { status: 404, headers: NO_STORE }) : new Response("Not found", { status: 404, headers: NO_STORE });
  // The signed URL needs no login, so the client can open it from any window, including the installed app.
  if (wantsJson) return Response.json({ url: data.signedUrl }, { headers: NO_STORE });
  return new Response(null, { status: 302, headers: { ...NO_STORE, Location: data.signedUrl } });
}
