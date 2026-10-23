/** The Me-page switch for speaking exercises. Default ON; a storage error counts as ON. */
export const SPEAKING_KEY = "le-nid-speaking";

export function speakingOn(): boolean {
  try { return typeof localStorage === "undefined" || localStorage.getItem(SPEAKING_KEY) !== "0"; } catch { return true; }
}

export function setSpeakingOn(on: boolean): void {
  try { localStorage.setItem(SPEAKING_KEY, on ? "1" : "0"); } catch { /* storage blocked: the switch just will not persist */ }
}
