import { requireApprovedUser } from "@/lib/talk/server-auth";
import { createRateLimiter } from "@/lib/talk/rate-limit";
import { shouldDropTranscript } from "@/lib/talk/hallucination";
import { normalizeLang } from "@/lib/talk/lang";
import { ACCEPTED_EXTENSIONS } from "@/lib/talk/mime";
import { GROUP_PER_MINUTE, STT_MAX_BYTES, STT_PER_HOUR, STT_PER_MINUTE, type SttError, type SttErrorCode, type SttOk } from "@/lib/talk/api";

// Speech to text for Conversation mode, through Groq's hosted Whisper (free tier). The key stays on the server.
// Audio and transcripts are never logged or stored: they pass through this function and are gone.

export const maxDuration = 30;

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const perUser = createRateLimiter([{ ms: 60_000, max: STT_PER_MINUTE }, { ms: 3_600_000, max: STT_PER_HOUR }]);
// Soft awareness of the shared Groq key (per server instance): stay under its per-minute limit and remember its 429s.
const group = createRateLimiter([{ ms: 60_000, max: GROUP_PER_MINUTE }]);
let groqBlockedUntil = 0;

const fail = (error: SttErrorCode, message: string, status: number, extra: Partial<SttError> = {}) =>
  Response.json({ error, message, ...extra } satisfies SttError, {
    status,
    headers: extra.retryAfter ? { "Retry-After": String(extra.retryAfter) } : undefined,
  });

type Verbose = { text?: string; language?: string; duration?: number; segments?: { no_speech_prob?: number }[] };

export async function POST(request: Request) {
  const auth = await requireApprovedUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;

  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) return fail("not_configured", "Live listening isn't set up yet.", 503);

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > STT_MAX_BYTES + 64 * 1024) return fail("bad_audio", "That recording is too long.", 413);

  let form: FormData;
  try { form = await request.formData(); } catch { return fail("bad_audio", "No recording received.", 400); }
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size < 1000) return fail("bad_audio", "That recording was empty.", 400);
  if (file.size > STT_MAX_BYTES) return fail("bad_audio", "That recording is too long.", 413);
  const name = file instanceof File && file.name ? file.name : "clip.webm";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (!ACCEPTED_EXTENSIONS.includes(ext)) return fail("bad_audio", "That recording format isn't supported.", 400);
  const durationSec = Number(form.get("durationMs")) / 1000 || undefined;
  const peakRms = Number(form.get("peak")) || undefined;

  const now = Date.now();
  if (groqBlockedUntil > now) {
    return fail("rate_limited", "The group's voice limit is used up for a moment.", 429, { retryAfter: Math.ceil((groqBlockedUntil - now) / 1000), scope: "group" });
  }
  const mine = perUser.hit(user.id, now);
  if (!mine.ok) return fail("rate_limited", "You've sent a lot of speech in a short time.", 429, { retryAfter: mine.retryAfterSec, scope: "you" });
  const all = group.hit("groq", now);
  if (!all.ok) return fail("rate_limited", "The whole group is using live listening right now.", 429, { retryAfter: all.retryAfterSec, scope: "group" });

  const upstream = new FormData();
  upstream.append("file", file, `clip.${ext}`);
  upstream.append("model", "whisper-large-v3-turbo");
  upstream.append("response_format", "verbose_json");
  upstream.append("temperature", "0");
  // No "language": Whisper detects English or French on its own.

  let res: Response;
  try {
    res = await fetch(GROQ_URL, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: upstream, signal: AbortSignal.timeout(20_000) });
  } catch {
    return fail("upstream_error", "Couldn't reach the voice service.", 502);
  }

  if (res.status === 429) {
    const retry = Math.min(3600, Math.max(5, Math.ceil(Number(res.headers.get("retry-after")) || 30)));
    groqBlockedUntil = Date.now() + retry * 1000;
    return fail("rate_limited", "The group's voice limit is used up for a moment.", 429, { retryAfter: retry, scope: "group" });
  }
  if (res.status === 401 || res.status === 403) return fail("not_configured", "Live listening isn't set up correctly.", 503);
  if (res.status === 400 || res.status === 413 || res.status === 415 || res.status === 422) return fail("bad_audio", "Couldn't understand that recording.", 400);
  if (!res.ok) return fail("upstream_error", "The voice service had a problem.", 502);

  let data: Verbose;
  try { data = (await res.json()) as Verbose; } catch { return fail("upstream_error", "The voice service had a problem.", 502); }
  const text = (data.text ?? "").trim();
  const language = normalizeLang(data.language);
  const noSpeechProb = data.segments?.length ? Math.max(...data.segments.map((s) => s.no_speech_prob ?? 0)) : undefined;
  const clip = { durationSec: durationSec ?? data.duration, peakRms, noSpeechProb };
  if (shouldDropTranscript(text, clip)) return Response.json({ text: "", language, dropped: true } satisfies SttOk);
  return Response.json({ text, language } satisfies SttOk);
}
