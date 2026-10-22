/** Network calls from the Conversation mode page. Client only. */
import type { SttErrorCode } from "@/lib/talk/api";
import type { DeepLTarget } from "@/lib/talk/lang";

export type Clip = { blob: Blob; ext: string; durationMs: number; peak: number };

export type SttResult =
  | { ok: true; text: string; language: string; dropped: boolean }
  | { ok: false; code: SttErrorCode | "offline"; message: string; retryAfter?: number; scope?: "you" | "group" };

async function readJsonSafe(res: Response): Promise<Record<string, unknown> | null> {
  if (!res.headers.get("content-type")?.includes("application/json")) return null;
  try { return (await res.json()) as Record<string, unknown>; } catch { return null; }
}

export async function transcribe(clip: Clip): Promise<SttResult> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return { ok: false, code: "offline", message: "You're offline." };
  const form = new FormData();
  form.append("file", new File([clip.blob], `clip.${clip.ext}`, { type: clip.blob.type || "application/octet-stream" }));
  form.append("durationMs", String(Math.round(clip.durationMs)));
  form.append("peak", clip.peak.toFixed(4));
  let res: Response;
  try {
    res = await fetch("/api/stt", { method: "POST", body: form, signal: AbortSignal.timeout(30_000) });
  } catch {
    return { ok: false, code: navigator.onLine === false ? "offline" : "upstream_error", message: "Couldn't reach Le Nid." };
  }
  const data = await readJsonSafe(res);
  if (res.ok && data && typeof data.text === "string") {
    return { ok: true, text: data.text, language: String(data.language ?? ""), dropped: data.dropped === true };
  }
  const code = (typeof data?.error === "string" ? data.error : res.status === 429 ? "rate_limited" : "upstream_error") as SttErrorCode;
  const retryAfter = Number(data?.retryAfter ?? res.headers.get("retry-after")) || undefined;
  const scope = data?.scope === "you" || data?.scope === "group" ? data.scope : undefined;
  return { ok: false, code, message: typeof data?.message === "string" ? data.message : "Something went wrong.", retryAfter, scope };
}

export type TranslateResult = { ok: true; text: string } | { ok: false; limited: boolean; message: string };

/** The existing DeepL proxy (/api/translate). */
export async function translate(text: string, target: DeepLTarget): Promise<TranslateResult> {
  try {
    const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: text.slice(0, 500), target }), signal: AbortSignal.timeout(20_000) });
    const data = await readJsonSafe(res);
    if (res.ok && typeof data?.text === "string") return { ok: true, text: data.text };
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
