/** Recording formats in order of preference. iPhone Safari records audio/mp4 (AAC); Chrome and Firefox record webm. */
export const MIME_PREFERENCE = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"] as const;

/** The first supported type, or "" to let the browser pick its default. */
export function pickMimeType(isSupported: (t: string) => boolean): string {
  for (const t of MIME_PREFERENCE) {
    try { if (isSupported(t)) return t; } catch { /* some browsers throw for unknown types */ }
  }
  return "";
}

/** File extension Groq understands for a recorded mime type. */
export function extensionFor(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4") || m.includes("aac") || m.includes("m4a")) return "m4a";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("wav")) return "wav";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  return "webm";
}

/** Extensions /api/stt accepts (a subset of what Groq accepts). */
export const ACCEPTED_EXTENSIONS = ["webm", "m4a", "mp4", "ogg", "wav", "mp3"];
