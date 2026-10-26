// Optional English voice for the English-first stage. Uses the device's built-in voice; every call must come from a
// tap (iOS). Returns false when the device has no speech, so callers can hide their play buttons.
import { stop } from "./karaoke";

export const englishVoiceAvailable = () => typeof window !== "undefined" && "speechSynthesis" in window;

let voice: SpeechSynthesisVoice | undefined;
const loadVoice = () => {
  voice = window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().replace("_", "-").startsWith("en"));
};
if (englishVoiceAvailable()) {
  loadVoice();
  window.speechSynthesis.addEventListener?.("voiceschanged", loadVoice);
}

/** Speaks English text; `end` runs when it finishes or fails. A second call replaces the first. */
export function speakEnglish(text: string, slow = false, end?: () => void): boolean {
  if (!englishVoiceAvailable()) return false;
  stop(); // also stops any French playback and its highlight
  const synth = window.speechSynthesis;
  if (!voice) loadVoice();
  if (synth.paused) synth.resume();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = slow ? 0.55 : 0.92;
  if (voice) u.voice = voice;
  if (end) { u.onend = () => end(); u.onerror = () => end(); }
  synth.speak(u);
  return true;
}

export const stopEnglish = () => { if (englishVoiceAvailable()) window.speechSynthesis.cancel(); };
