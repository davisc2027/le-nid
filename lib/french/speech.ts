let unlocked = false;
let voice: SpeechSynthesisVoice | undefined;

const supported = () => typeof window !== "undefined" && "speechSynthesis" in window;

function loadVoice() {
  voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().replace("_", "-").startsWith("fr"));
}

// iOS fills the voice list asynchronously.
if (supported()) {
  loadVoice();
  window.speechSynthesis.addEventListener?.("voiceschanged", loadVoice);
}

/** True once a tap has started speech; browsers like iOS Safari ignore audio that did not start from a tap. */
export const speechUnlocked = () => unlocked;

/** Optional progress callbacks. Not every browser fires boundary events (iOS often does not), so treat them as a bonus. */
export type SpeakEvents = { boundary?: (charIndex: number) => void; end?: () => void };

/** Speaks French with the device's built-in voice. Call from a tap. Returns false when speech is unavailable. */
export function speak(text: string, slow = false, on?: SpeakEvents): boolean {
  if (!supported()) return false;
  const synth = window.speechSynthesis;
  unlocked = true;
  if (!voice) loadVoice();
  synth.cancel();
  if (synth.paused) synth.resume();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "fr-FR";
  u.rate = slow ? 0.6 : 0.9;
  if (voice) u.voice = voice;
  if (on?.boundary) u.onboundary = (e) => { if (e.name === undefined || e.name === "word") on.boundary!(e.charIndex); };
  if (on?.end) { u.onend = () => on.end!(); u.onerror = () => on.end!(); }
  synth.speak(u);
  return true;
}
