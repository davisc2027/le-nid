export const DEFAULT_HANDOFF_NEXT = "/translate/talk?mode=safari";

/**
 * Only same-site paths: must start with "/" but not "//" or "/\" (which browsers treat as another host),
 * with no control characters. Anything else falls back to the given default.
 */
export function safeNextPath(next: unknown, fallback = DEFAULT_HANDOFF_NEXT): string {
  if (typeof next !== "string" || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\u007f\\]/.test(next)) return fallback;
  return next;
}
