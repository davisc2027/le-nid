import { createClient } from "@/lib/supabase/server";

const MAX_CHARS = 500;
const PER_HOUR = 40;
const hits = new Map<string, number[]>(); // per-instance and best effort; fine for a 35-person group

// DeepL API Free (500k characters per month). The key stays on the server.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Sign in first." }, { status: 401 });

  let body: { text?: unknown; target?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Nothing to translate." }, { status: 400 }); }
  const { text, target } = body;
  const clean = typeof text === "string" ? text.trim() : "";
  if (!clean || (target !== "FR" && target !== "EN-US")) return Response.json({ error: "Nothing to translate." }, { status: 400 });
  if (clean.length > MAX_CHARS) return Response.json({ error: `Keep it under ${MAX_CHARS} characters.` }, { status: 400 });
  if (!process.env.DEEPL_API_KEY) return Response.json({ error: "Translation isn't set up yet." }, { status: 503 });

  const now = Date.now();
  const recent = (hits.get(user.id) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= PER_HOUR) return Response.json({ error: "Too many translations this hour. Try again soon." }, { status: 429 });
  hits.set(user.id, [...recent, now]);

  const res = await fetch("https://api-free.deepl.com/v2/translate", {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: [clean], target_lang: target }),
  });
  if (!res.ok) return Response.json({ error: res.status === 456 ? "Monthly translation limit reached." : "Translation failed." }, { status: 502 });
  const data = (await res.json()) as { translations: { text: string }[] };
  return Response.json({ text: data.translations[0].text });
}
