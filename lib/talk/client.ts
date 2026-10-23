/** Network calls from the Conversation mode page. Client only. */
import type { SttErrorCode } from "@/lib/talk/api";
import type { DeepLTarget, Side } from "@/lib/talk/lang";
import type { SttDiag } from "@/lib/talk/api";

/** What the capture knew about a clip (for the diagnostics panel only). */
export type ClipMeta = {
  pcm: boolean; mime: string; bytes: number; floor: number; speechMs: number; silenceMs: number; reason: string;
  preRollMs: number; sampleRate: number; band?: number; endedAt: number;
};
export type Clip = {
  blob: Blob; ext: string; durationMs: number; peak: number;
  /** Set in Noisy place mode: the person tapped English or Français before speaking. */
  forcedLang?: Side;
  meta?: ClipMeta;
};

/** Extras for one transcription request. */
export type TranscribeOptions = {
  language?: Side;
  /** Last same-language sentences, for the optional Whisper prompt. */
  contextEn?: string;
  contextFr?: string;
  /** Diagnostics overrides (honoured by the server only with diag=1). */
  diag?: { model?: string; prompt?: boolean; retry?: boolean };
};

export type SttResult =
  | { ok: true; text: string; language: string; dropped: boolean; confidence?: number; lowConfidence?: boolean; retried?: boolean; forced?: boolean; diag?: SttDiag }
  | { ok: false; code: SttErrorCode | "offline"; message: string; retryAfter?: number; scope?: "you" | "group" };

async function readJsonSafe(res: Response): Promise<Record<string, unknown> | null> {
  if (!res.headers.get("content-type")?.includes("application/json")) return null;
  try { return (await res.json()) as Record<string, unknown>; } catch { return null; }
}

export async function transcribe(clip: Clip, opts: TranscribeOptions = {}): Promise<SttResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { ok: false, code: "offline", message: "You're offline." };
  const form = new FormData();
  form.append("file", new File([clip.blob], `clip.${clip.ext}`, { type: clip.blob.type || "application/octet-stream" }));
  form.append("durationMs", String(Math.round(clip.durationMs)));
  form.append("peak", clip.peak.toFixed(4));
  if (opts.language) form.append("language", opts.language);
  if (opts.contextEn) form.append("contextEn", opts.contextEn.slice(-120));
  if (opts.contextFr) form.append("contextFr", opts.contextFr.slice(-120));
  if (opts.diag) {
    form.append("diag", "1");
    if (opts.diag.model) form.append("model", opts.diag.model);
    if (opts.diag.prompt) form.append("prompt", "1");
    if (opts.diag.retry === false) form.append("retry", "0");
  }
  let res: Response;
  try {
    res = await fetch("/api/stt", { method: "POST", body: form, signal: AbortSignal.timeout(30_000) });
  } catch {
    return { ok: false, code: navigator.onLine === false ? "offline" : "upstream_error", message: "Couldn't reach Le Nid." };
  }
  const data = await readJsonSafe(res);
  if (res.ok && data && typeof data.text === "string") {
    return {
      ok: true, text: data.text, language: String(data.language ?? ""), dropped: data.dropped === true,
      confidence: typeof data.confidence === "number" ? data.confidence : undefined,
      lowConfidence: data.lowConfidence === true, retried: data.retried === true, forced: data.forced === true,
      diag: data.diag as SttDiag | undefined,
    };
  }
  const code = (typeof data?.error === "string" ? data.error : res.status === 429 ? "rate_limited" : "upstream_error") as SttErrorCode;
  const retryAfter = Number(data?.retryAfter ?? res.headers.get("retry-after")) || undefined;
  const scope = data?.scope === "you" || data?.scope === "group" ? data.scope : undefined;
  return { ok: false, code, message: typeof data?.message === "string" ? data.message : "Something went wrong.", retryAfter, scope };
}

export type TranslateResult = { ok: true; text: string; engine?: string; warnings?: string[] } | { ok: false; limited: boolean; message: string };

export type TranslateOptions = { source?: Side; context?: string; warn?: boolean };

/** The existing DeepL proxy (/api/translate). */
export async function translate(text: string, target: DeepLTarget, opts: TranslateOptions = {}): Promise<TranslateResult> {
  try {
    const body: Record<string, unknown> = { text: text.slice(0, 500), target };
    if (opts.source) { body.source = opts.source.toUpperCase(); if (opts.context) body.context = opts.context.slice(-300); if (opts.warn) body.warn = true; }
    const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
    const data = await readJsonSafe(res);
    if (res.ok && typeof data?.text === "string") {
      return { ok: true, text: data.text, engine: typeof data.engine === "string" ? data.engine : undefined, warnings: Array.isArray(data.warnings) ? data.warnings.filter((w): w is string => typeof w === "string") : undefined };
    }
    return { ok: false, limited: res.status === 429, message: typeof data?.error === "string" ? data.error : "Translation failed." };
  } catch {
    return { ok: false, limited: false, message: "Couldn't reach the translator." };
  }
}

export type HandoffResult = { ok: true; url: string } | { ok: false; message: string };

export async function requestHandoff(next = "/translate/talk?mode=safari"): Promise<HandoffResult> {
  try {
    const res = await fetch("/api/handoff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ next }) });
    const data = await readJsonSafe(res);
    if (res.ok && typeof data?.url === "string") return { ok: true, url: data.url };
    return { ok: false, message: typeof data?.message === "string" ? data.message : "Couldn't make a Safari link." };
  } catch {
    return { ok: false, message: "No connection. Try again." };
  }
}
