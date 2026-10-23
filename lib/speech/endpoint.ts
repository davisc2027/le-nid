/**
 * Pure end-of-speech detector for the recorder. Fed one RMS value per audio chunk with the time at the chunk's end.
 * Numbers and reasons are in docs/speaking-build-spec.md section 5.
 */
export type EndpointConfig = {
  ignoreMs: number;
  startFloor: number;
  minFloor: number;
  maxFloor: number;
  startMin: number;
  holdMin: number;
  endSilenceMs: number;
  noSpeechMs: number;
  capSec: number;
};

export const DEFAULT_ENDPOINT: EndpointConfig = {
  ignoreMs: 150, startFloor: 0.004, minFloor: 0.0015, maxFloor: 0.05, startMin: 0.012, holdMin: 0.008,
  endSilenceMs: 900, noSpeechMs: 6000, capSec: 10,
};

export type EndpointEvent = "none" | "speech" | "stop-silence" | "stop-no-speech" | "stop-cap";

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Meter level 0..1 from an RMS value (same curve as the conversation meter). */
export const levelFromRms = (rms: number): number => (rms <= 0.002 ? 0 : clamp((20 * Math.log10(rms) + 54) / 46, 0, 1));

export function createEndpointer(partial: Partial<EndpointConfig> = {}) {
  const c = { ...DEFAULT_ENDPOINT, ...partial };
  let floor = c.startFloor;
  let inSpeech = false;
  let loud = 0;
  let lastVoiced = 0;
  return {
    step(rms: number, tMs: number): EndpointEvent {
      if (tMs >= c.capSec * 1000) return "stop-cap";
      if (tMs < c.ignoreMs) return "none";
      if (!inSpeech) {
        const startLevel = Math.max(c.startMin, 3 * floor);
        if (rms < startLevel) {
          floor = clamp(0.9 * floor + 0.1 * rms, c.minFloor, c.maxFloor);
          loud = 0;
        } else if (++loud >= 2) {
          inSpeech = true;
          lastVoiced = tMs;
          return "speech";
        }
        return tMs >= c.noSpeechMs ? "stop-no-speech" : "none";
      }
      if (rms > Math.max(c.holdMin, 2 * floor)) lastVoiced = tMs;
      else if (tMs - lastVoiced >= c.endSilenceMs) return "stop-silence";
      return "none";
    },
  };
}
