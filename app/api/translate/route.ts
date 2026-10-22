import { requireApprovedUser, isLimitError } from "@/lib/talk/server-auth";
import { DAILY_TRANSLATE_MESSAGE } from "@/lib/talk/api";
import { translate } from "@/lib/translate/providers";

export const maxDuration = 30; // up to three providers are tried in turn

const MAX_CHARS = 500;
// Soft per-instance guard against runaway loops (about 60k characters/hour at most). The real limit is the per-user
// daily character budget in Postgres (use_translate_chars), which holds across instances.
const PER_HOUR = 120;
const hits = new Map<string, number[]>();

// Translation chain: DeepL if DEEPL_API_KEY is set, then Groq language models if GROQ_API_KEY is set (lib/translate).
// Keys stay on the server.
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

  const now = Date.now();
  const recent = (hits.get(user.id) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= PER_HOUR) return Response.json({ error: "Too many translations this hour. Try again soon.", code: "rate_limited" }, { status: 429 });
  hits.set(user.id, [...recent, now]);

  // Per-user daily budget. Only a missing function or permission error fails open (migration 0010 not run yet).
  const { error: quotaError } = await supabase.rpc("use_translate_chars", { p_chars: clean.length });
  if (isLimitError(quotaError, "daily translate limit")) return Response.json({ error: DAILY_TRANSLATE_MESSAGE, code: "rate_limited" }, { status: 429 });

  const result = await translate(clean, target);
  if (result.ok) return Response.json({ text: result.text, engine: result.engine });
  if (!result.configured) return Response.json({ error: "Translation isn't set up yet." }, { status: 503 });
  return Response.json(
    { error: result.busy ? "Translation is busy right now. Try again in a minute." : "Translation failed.", code: result.busy ? "rate_limited" : "upstream_error" },
    { status: result.busy ? 429 : 502 },
  );
}
