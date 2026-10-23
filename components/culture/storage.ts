// Per-device conveniences for the culture section. localStorage can be missing or throw (private mode, blocked
// storage), so every access is wrapped and the UI works without it.
export const READ_KEY = "le-nid-culture-read";
export const QUIZ_KEY = "le-nid-culture-quiz"; // ids of questions answered right at least once
export const CHECK_KEY = "le-nid-culture-checklist";

export function readSet(key: string): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? "[]");
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

export function writeSet(key: string, set: Set<string>) {
  try { localStorage.setItem(key, JSON.stringify([...set])); } catch {}
}

/** Adds one id to a stored set and returns the new set. */
export function addTo(key: string, id: string): Set<string> {
  const s = readSet(key);
  if (!s.has(id)) { s.add(id); writeSet(key, s); }
  return s;
}
