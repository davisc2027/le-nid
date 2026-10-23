/** Every learner-facing string of the speaking feature (docs/speaking-build-spec.md section 2). Warm, short, never blaming. */
import type { ResultState } from "./checks";

export const RESULT_COPY: Record<ResultState, { title?: string; body: string }> = {
  success: { title: "Bien dit !", body: "Listen back and compare." },
  "near-miss": { title: "Presque !", body: "Make the end go up, like a real question. Listen to the model, then try again?" },
  thanks: { title: "Merci !", body: "Let's keep going. You can listen back and compare first." },
  "too-short": { body: "That sounded short. Say the whole phrase?" },
  "too-long": { body: "Let's keep it to just the phrase. Try again?" },
  "too-quiet": { body: "I could barely hear you. Hold the phone a little closer and try again?" },
  "too-noisy": { body: "It's a bit loud around you. Try a quieter spot, or skip for now." },
  "no-speech": { body: "I didn't hear anything. Tap the microphone and say the phrase?" },
};

export const ROSE_BODY = "Your voice went up at the end, like a real question. Listen back and compare.";

export const BLOCKED_COPY = {
  denied: {
    title: "Microphone off",
    body: "The microphone is off for Le Nid. To use it, allow it in Settings › Apps › Safari › Microphone (on older iPhones: Settings › Safari › Microphone), then come back. You can keep going without speaking.",
  },
  unsupported: { body: "Speaking practice isn't available on this device. You can keep going without it." },
  error: { body: "The microphone didn't start. Try again, or keep going without speaking." },
} as const;

export const PROMPT_COPY = {
  label: "Say it out loud",
  idle: "Tap and say it",
  recording: "Listening… tap to stop",
  processing: "One moment…",
  privacy: "Your voice stays on this phone. Nothing is saved or sent.",
  skip: "Skip",
  cantSpeak: "Can't speak now",
  tryAgain: "Try again",
  next: "Continue",
  noVoice: "The phone's French voice isn't available, so only your recording plays.",
  silentHint: "No sound? Flip the silent switch off.",
  yourVoice: "Your voice",
  aimHere: "aim here",
} as const;
