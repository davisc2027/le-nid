import { requireApprovedUser, isLimitError } from "@/lib/talk/server-auth";
import { DAILY_TRANSLATE_MESSAGE } from "@/lib/talk/api";

const MAX_CHARS = 500;
// Soft per-instance guard against runaway loops (about 60k characters/hour at most). The real limit is the per-user
// daily character budget in Postgres (use_translate_chars), which holds across instances.
const PER_HOUR = 120;
const hits = new Map<string, number[]>();

// DeepL API Free (500k characters per month). The key stays on the server.
export async function POST(request: Request) {
  const auth = await requireApprovedUser();
  if ("response" in auth) {
    // Keep `error` a human-readable string: the client shows it as-is.
    const body = (await auth.response.json().catch(() => ({}))) as { message?: string };
    return Response.json({ error: body.message ?? "Sign in first.", code: auth.response.status === 403 ? "forbidden" : "unauthorized" }, { status: auth.response.status });
  }
  const { user, supabase } = auth;

  let body: { text?: unknown; target?: unknown };
  try { body = await request.json(); } catch { return Response.json({ error: "Nothing to translate." }, { status: 400 }); }
  const { text, target } = body;
  const clean = typeof text === "string" ? text.trim() : "";
  if (!clean || (target !== "FR" && target !== "EN-US")) return Response.json({ error: "Nothing to translate." }, { status: 400 });
  if (clean.length > MAX_CHARS) return Response.json({ error: `Keep it under ${MAX_CHARS} characters.` }, { status: 400 });
  if (!process.env.DEEPL_API_KEY) return Response.json({ error: "Translation isn't set up yet." }, { status: 503 });

  const now = Date.now();
  const recent = (hits.get(user.id) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= PER_HOUR) return Response.json({ error: "Too many translations this hour. Try again soon.", code: "rate_limited" }, { status: 429 });
  hits.set(user.id, [...recent, now]);

  // Per-user daily budget. Only a missing function or permission error fails open (migration 0010 not run yet).
  const { error: quotaError } = await supabase.rpc("use_translate_chars", { p_chars: clean.length });
  if (isLimitError(quotaError, "daily translate limit")) return Response.json({ error: DAILY_TRANSLATE_MESSAGE, code: "rate_limited" }, { status: 429 });

  let res: Response;
  try {
    res = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ text: [clean], target_lang: target }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return Response.json({ error: "Couldn't reach the translator." }, { status: 502 });
  }
  if (!res.ok) return Response.json({ error: res.status === 456 ? "Monthly translation limit reached." : "Translation failed." }, { status: 502 });
  let data: { translations?: { text: string }[] };
  try { data = await res.json(); } catch { return Response.json({ error: "Translation failed." }, { status: 502 }); }
  const out = data.translations?.[0]?.text;
  if (typeof out !== "string") return Response.json({ error: "Translation failed." }, { status: 502 });
  return Response.json({ text: out });
}
