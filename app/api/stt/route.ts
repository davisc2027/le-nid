import { requireApprovedUser, isLimitError } from "@/lib/talk/server-auth";
import { createRateLimiter } from "@/lib/talk/rate-limit";
import { shouldDropTranscript, summarizeSegments, type SegmentSummary, type WhisperSegment } from "@/lib/talk/hallucination";
import { isSide, normalizeLang, textLanguage, type Side } from "@/lib/talk/lang";
import { ACCEPTED_EXTENSIONS } from "@/lib/talk/mime";
import { buildWhisperPrompt, isPromptEcho, type PromptBook } from "@/lib/talk/whisper-prompt";
import prompts from "@/content/talk/prompts.json";
import {
  DAILY_STT_MESSAGE, GROUP_PER_MINUTE, STT_DEFAULT_MODEL, STT_MAX_BYTES, STT_MODELS, STT_PER_HOUR, STT_PER_MINUTE,
  type SttDiag, type SttError, type SttErrorCode, type SttOk,
} from "@/lib/talk/api";

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

type Verbose = { text?: string; language?: string; duration?: number; segments?: WhisperSegment[] };
type GroqCall = { ok: true; data: Verbose } | { ok: false; response: Response };

/** STT_MODEL from the environment (default whisper-large-v3-turbo); a diagnostics request may pick another allowed one. */
function chooseModel(override: FormDataEntryValue | null): string {
  const allowed = (m: string | undefined) => STT_MODELS.find((x) => x === m?.trim());
  const fromEnv = allowed(process.env.STT_MODEL);
  return (typeof override === "string" ? allowed(override) : undefined) ?? fromEnv ?? STT_DEFAULT_MODEL;
}

async function callGroq(key: string, file: Blob, ext: string, model: string, language: Side | undefined, prompt: string, timeoutMs: number): Promise<GroqCall> {
  const upstream = new FormData();
  upstream.append("file", file, `clip.${ext}`);
  upstream.append("model", model);
  upstream.append("response_format", "verbose_json");
  upstream.append("temperature", "0");
  // Without "language" Whisper detects it on its own; it is sent only when the language is known (the Noisy place
  // buttons, or the single retry below).
  if (language) upstream.append("language", language);
  if (prompt) upstream.append("prompt", prompt);

  let res: Response;
  try {
    res = await fetch(GROQ_URL, { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: upstream, signal: AbortSignal.timeout(timeoutMs) });
  } catch {
    return { ok: false, response: fail("upstream_error", "Couldn't reach the voice service.", 502) };
  }
  if (res.status === 429) {
    const retry = Math.min(3600, Math.max(5, Math.ceil(Number(res.headers.get("retry-after")) || 30)));
    groqBlockedUntil = Date.now() + retry * 1000;
    return { ok: false, response: fail("rate_limited", "The group's voice limit is used up for a moment.", 429, { retryAfter: retry, scope: "group" }) };
  }
  if (res.status === 401 || res.status === 403) return { ok: false, response: fail("not_configured", "Live listening isn't set up correctly.", 503) };
  if (res.status === 400 || res.status === 413 || res.status === 415 || res.status === 422) return { ok: false, response: fail("bad_audio", "Couldn't understand that recording.", 400) };
  if (!res.ok) return { ok: false, response: fail("upstream_error", "The voice service had a problem.", 502) };
  try { return { ok: true, data: (await res.json()) as Verbose }; } catch { return { ok: false, response: fail("upstream_error", "The voice service had a problem.", 502) }; }
}

export async function POST(request: Request) {
  const started = Date.now();
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

  // Optional fields from newer clients. Older clients send none of them and get the old behaviour.
  const langField = form.get("language");
  const forcedLang: Side | undefined = typeof langField === "string" && isSide(langField) ? langField : undefined;
  const diag = form.get("diag") === "1"; // only the hidden diagnostics panel sends this; unlocks the overrides below
  const model = chooseModel(diag ? form.get("model") : null);
  const wantPrompt = diag && form.get("prompt") === "1";
  const retryEnabled = !(diag && form.get("retry") === "0");
  const ctxFor = (l: Side) => { const v = form.get(l === "fr" ? "contextFr" : "contextEn"); return typeof v === "string" ? v : ""; };
  const book = prompts as PromptBook;

  const now = Date.now();
  if (groqBlockedUntil > now) {
    return fail("rate_limited", "The group's voice limit is used up for a moment.", 429, { retryAfter: Math.ceil((groqBlockedUntil - now) / 1000), scope: "group" });
  }
  const mine = perUser.hit(user.id, now);
  if (!mine.ok) return fail("rate_limited", "You've sent a lot of speech in a short time.", 429, { retryAfter: mine.retryAfterSec, scope: "you" });
  const all = group.hit("groq", now);
  if (!all.ok) return fail("rate_limited", "The whole group is using live listening right now.", 429, { retryAfter: all.retryAfterSec, scope: "group" });

  // Per-user daily budget, persisted in Postgres so it holds across instances. One recorded clip uses it once: the
  // single forced-language retry below does NOT use it again (it does count against the per-minute/hour/group limits).
  // Only a missing function or permission error fails open (migration 0010 not run yet); the limit error itself is a 429.
  const { error: quotaError } = await auth.supabase.rpc("use_stt_clip");
  if (isLimitError(quotaError, "daily voice limit")) return fail("rate_limited", DAILY_STT_MESSAGE, 429, { scope: "you" });

  const promptFor = (l: Side | undefined) => (wantPrompt ? buildWhisperPrompt(book, l ?? "", l ? ctxFor(l) : "") : "");
  const firstPrompt = promptFor(forcedLang);
  const first = await callGroq(key, file, ext, model, forcedLang, firstPrompt, 18_000);
  if (!first.ok) return first.response;
  const firstMs = Date.now() - started;

  const judge = (data: Verbose) => {
    const seg: SegmentSummary = summarizeSegments(data.text ?? "", data.segments);
    const text = seg.text;
    const clip = { durationSec: durationSec ?? data.duration, peakRms, noSpeechProb: seg.noSpeechProb };
    return { seg, text, clip, drop: !text || shouldDropTranscript(text, clip) };
  };

  let used = { data: first.data, ...judge(first.data) };
  let usedPrompt = firstPrompt;
  let sentLanguage: string = forcedLang ?? "auto";
  let retried = false;
  let retryMs: number | undefined;
  let language: string = forcedLang ?? normalizeLang(first.data.language);
  let forced = !!forcedLang;

  // Whisper's language guess is only trusted for English and French. Anything else (an Alsatian accent heard as
  // German, a name heard as Dutch), or a label that contradicts the text, gets ONE retry with the language forced.
  if (!forcedLang && retryEnabled && !used.drop) {
    const tl = textLanguage(used.text);
    let retryLang: Side | undefined;
    if (language !== "en" && language !== "fr") retryLang = tl.lang === "en" ? "en" : "fr";
    else if (tl.lang && tl.lang !== language && tl.strong) retryLang = tl.lang;
    const t = Date.now();
    if (retryLang && groqBlockedUntil <= t && t - started < 12_000 && perUser.hit(user.id, t).ok && group.hit("groq", t).ok) {
      const p = promptFor(retryLang);
      const second = await callGroq(key, file, ext, model, retryLang, p, Math.max(5_000, Math.min(15_000, 27_000 - (t - started))));
      retryMs = Date.now() - t;
      retried = true;
      if (second.ok) {
        used = { data: second.data, ...judge(second.data) };
        usedPrompt = p;
        sentLanguage = retryLang;
        language = retryLang;
        forced = true;
      }
    }
  }

  let drop = used.drop;
  let dropReason: string | undefined = drop ? (used.text ? "hallucination rule" : used.seg.droppedCount ? "segments failed Whisper's checks" : "empty") : undefined;
  if (!drop && usedPrompt && isPromptEcho(used.text, usedPrompt, used.clip)) { drop = true; dropReason = "echo of the vocabulary prompt"; }

  const tl = textLanguage(used.text);
  const body: SttOk = drop
    ? { text: "", language, dropped: true, ...(retried ? { retried } : {}), ...(forced ? { forced } : {}) }
    : {
        text: used.text,
        language,
        ...(used.seg.confidence !== undefined ? { confidence: Math.round(used.seg.confidence * 100) / 100 } : {}),
        ...(used.seg.lowConfidence ? { lowConfidence: true } : {}),
        ...(retried ? { retried } : {}),
        ...(forced ? { forced } : {}),
      };
  if (diag) {
    body.diag = {
      model, sentLanguage, whisperLanguage: normalizeLang(used.data.language), textLang: tl.lang, textScore: tl.score,
      promptUsed: !!usedPrompt, dropReason, segments: used.seg.verdicts,
      ms: { first: firstMs, retry: retryMs, total: Date.now() - started },
    } satisfies SttDiag;
  }
  return Response.json(body);
}
