import { createClient } from "@/lib/supabase/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: file } = await supabase.from("files").select("storage_path").eq("id", id).maybeSingle();
  if (!file) return new Response("Not found", { status: 404 });
  const { data } = await supabase.storage.from("files").createSignedUrl(file.storage_path, 60);
  if (!data?.signedUrl) return new Response("Not found", { status: 404 });
  return Response.redirect(data.signedUrl, 302);
}
