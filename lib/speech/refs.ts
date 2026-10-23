/**
 * Volunteer reference recordings (public/reference/<voice>/<stem>.<ext>) found through one small manifest.
 * A phrase without a recording falls back to the device voice; nothing here ever throws to the caller.
 * See docs/speaking-build-spec.md section 8.
 */
import { phraseKey } from "../french/exercises";

export type RefManifest = { version: 1; voices: Record<string, Record<string, { file: string; v: string }>> };
export const EMPTY_MANIFEST: RefManifest = { version: 1, voices: {} };
export const MANIFEST_URL = "/reference/manifest.json";
const VOICE_RE = /^[fm][1-9]$/;
const VOICE_KEY = "le-nid-ref-voice";

/** File stem for a phrase key: spaces become hyphens. */
export const fileStem = (key: string): string => key.replace(/ /g, "-");

export function parseManifest(json: unknown): RefManifest {
  if (!json || typeof json !== "object") return EMPTY_MANIFEST;
  const j = json as { version?: unknown; voices?: unknown };
  if (j.version !== 1 || !j.voices || typeof j.voices !== "object") return EMPTY_MANIFEST;
  const voices: RefManifest["voices"] = {};
  for (const [voice, files] of Object.entries(j.voices as Record<string, unknown>)) {
    if (!VOICE_RE.test(voice) || !files || typeof files !== "object") continue;
    const clean: Record<string, { file: string; v: string }> = {};
    for (const [key, e] of Object.entries(files as Record<string, unknown>)) {
      const x = e as { file?: unknown; v?: unknown };
      if (x && typeof x.file === "string" && /^[a-z0-9-]+\.(m4a|mp3|wav)$/.test(x.file) && typeof x.v === "string" && /^[0-9a-f]+$/.test(x.v)) clean[key] = { file: x.file, v: x.v };
    }
    voices[voice] = clean;
  }
  return { version: 1, voices };
}

let manifestPromise: Promise<RefManifest> | null = null;
/** One small fetch per page load. Any error gives the empty manifest. */
export function loadManifest(): Promise<RefManifest> {
  manifestPromise ??= (async () => {
    try {
      const res = await fetch(MANIFEST_URL, { cache: "no-cache" });
      if (!res.ok) return EMPTY_MANIFEST;
      return parseManifest(await res.json());
    } catch { return EMPTY_MANIFEST; }
  })();
  return manifestPromise;
}

const voiceOrder = (v: string) => Number(v[1]) * 2 + (v[0] === "m" ? 1 : 0);

/** Voices that have this phrase, sorted f1, m1, f2, m2, ... */
export function voicesFor(m: RefManifest, fr: string): string[] {
  const key = phraseKey(fr);
  return Object.keys(m.voices).filter((v) => m.voices[v][key]).sort((a, b) => voiceOrder(a) - voiceOrder(b));
}

export function preferredVoice(): string {
  try { return localStorage.getItem(VOICE_KEY) || "f1"; } catch { return "f1"; }
}
export function setPreferredVoice(v: string): void {
  try { localStorage.setItem(VOICE_KEY, v); } catch { /* ignore */ }
}

function pickVoice(m: RefManifest, fr: string, voice?: string): string | null {
  const have = voicesFor(m, fr);
  if (voice && have.includes(voice)) return voice;
  const pref = preferredVoice();
  if (have.includes(pref)) return pref;
  return have[0] ?? null;
}

export function referenceUrl(m: RefManifest, fr: string, voice?: string): string | null {
  const v = pickVoice(m, fr, voice);
  if (!v) return null;
  const e = m.voices[v][phraseKey(fr)];
  return `/reference/${v}/${e.file}?v=${e.v}`;
}

// ---- blob cache (an LRU of 24 object URLs; failures are remembered for the page load)
const MAX_BLOBS = 24;
const blobs = new Map<string, Promise<string | null>>();
const resolved = new Map<string, string>();

function touch(url: string, p: Promise<string | null>) {
  blobs.delete(url);
  blobs.set(url, p);
  while (blobs.size > MAX_BLOBS) {
    const oldest = blobs.keys().next().value as string;
    blobs.delete(oldest);
    const obj = resolved.get(oldest);
    if (obj) { URL.revokeObjectURL(obj); resolved.delete(oldest); }
  }
}

/** A blob: URL for the recording, or null (no recording, or it failed to load) so the caller uses text to speech. */
export async function referenceBlobUrl(fr: string, voice?: string): Promise<string | null> {
  try {
    const url = referenceUrl(await loadManifest(), fr, voice);
    if (!url) return null;
    const hit = blobs.get(url);
    if (hit) { touch(url, hit); return hit; }
    const p = (async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const obj = URL.createObjectURL(await res.blob());
        resolved.set(url, obj);
        return obj;
      } catch { return null; }
    })();
    touch(url, p);
    return p;
  } catch { return null; }
}

export function prefetchReferences(frs: string[]): void {
  for (const fr of frs) void referenceBlobUrl(fr);
}

/** Test helper: forget the memoized manifest and blobs. */
export function resetRefsForTests(): void {
  manifestPromise = null; blobs.clear(); resolved.clear();
}
