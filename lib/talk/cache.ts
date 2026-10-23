/** Small in-memory translation cache (text + direction), least recently used out first. Never persisted. */
export function createTranslationCache(max = 200) {
  const map = new Map<string, string>();
  const keyOf = (text: string, target: string) => `${target}|${text.trim().replace(/\s+/g, " ").toLowerCase()}`;
  return {
    get(text: string, target: string): string | undefined {
      const k = keyOf(text, target);
      const v = map.get(k);
      if (v !== undefined) { map.delete(k); map.set(k, v); }
      return v;
    },
    set(text: string, target: string, value: string) {
      const k = keyOf(text, target);
      map.delete(k);
      map.set(k, value);
      while (map.size > max) map.delete(map.keys().next().value as string);
    },
    clear() { map.clear(); },
    size: () => map.size,
  };
}
