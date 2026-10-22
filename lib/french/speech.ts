/** Speaks French with the device's built-in voice. Returns false when speech is unavailable. */
export function speak(text: string, slow = false): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "fr-FR";
  u.rate = slow ? 0.6 : 0.9;
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith("fr"));
  if (voice) u.voice = voice;
  synth.speak(u);
  return true;
}
