/**
 * Voice-activity detector for Conversation mode. Pure: feed it one RMS reading per frame (about every 50 ms) and
 * it says when to start recording, when speech is confirmed, and when the utterance is over.
 *
 *   idle --(rms over the arm level)--> armed: start the recorder now so the first syllable is not clipped
 *   armed --(rms over the start level within armMs)--> speaking ("start")
 *   armed --(no confirmation within armMs)--> idle ("cancel": throw the recording away)
 *   speaking --(endSilenceMs without voice)--> idle ("end", keep = long and loud enough)
 *   speaking --(maxMs reached)--> idle ("end", reason "cap"; a new utterance can start right away)
 *
 * The noise floor adapts while nobody is talking, so a noisy café raises the bar and a quiet room lowers it.
 */

export type VadConfig = {
  /** Start recording when rms > floor * armRatio (and > minArmRms). */
  armRatio: number;
  minArmRms: number;
  /** Speech is confirmed when rms > floor * startRatio (and > minStartRms). */
  startRatio: number;
  minStartRms: number;
  /** While speaking, a frame counts as voice when rms > floor * holdRatio (and > minHoldRms). */
  holdRatio: number;
  minHoldRms: number;
  /** How long an armed recording waits for confirmation. */
  armMs: number;
  /** Silence that ends an utterance. */
  endSilenceMs: number;
  /** Utterances with less voiced time than this are discarded. */
  minSpeechMs: number;
  /** Utterances whose loudest frame is below this are discarded as too quiet. */
  minPeakRms: number;
  /** Hard cap for one utterance. */
  maxMs: number;
  /** Noise-floor smoothing per frame while idle (0..1). */
  floorAlpha: number;
  /** Noise-floor step after a false alarm (armed but never confirmed). */
  cancelAlpha: number;
  /** While speaking, the floor follows the quietest reading of the last minWindowFrames frames (about 1.5 s). */
  minWindowFrames: number;
  minTrackAlpha: number;
  initialFloor: number;
  minFloor: number;
  maxFloor: number;
};

export const DEFAULT_VAD: VadConfig = {
  armRatio: 2,
  minArmRms: 0.008,
  startRatio: 3,
  minStartRms: 0.015,
  holdRatio: 1.8,
  minHoldRms: 0.01,
  armMs: 400,
  endSilenceMs: 900,
  minSpeechMs: 600,
  minPeakRms: 0.03,
  maxMs: 25_000,
  floorAlpha: 0.05,
  cancelAlpha: 0.3,
  minWindowFrames: 30,
  minTrackAlpha: 0.15,
  initialFloor: 0.006,
  minFloor: 0.002,
  maxFloor: 0.08,
};

export type VadEnd = {
  type: "end";
  /** Discard when false (too short or too quiet). */
  keep: boolean;
  reason: "silence" | "cap";
  /** Whole clip, from arm to now. */
  durationMs: number;
  /** Time from the first to the last voiced frame. */
  speechMs: number;
  peakRms: number;
};
export type VadEvent = { type: "none" } | { type: "arm"; confirmed: boolean } | { type: "start" } | { type: "cancel" } | VadEnd;
export type VadPhase = "idle" | "armed" | "speaking";

export function createVad(partial: Partial<VadConfig> = {}) {
  const c: VadConfig = { ...DEFAULT_VAD, ...partial };
  let phase: VadPhase = "idle";
  let floor = c.initialFloor;
  let armedAt = 0;
  let firstVoice = 0;
  let lastVoice = 0;
  let peak = 0;
  /** Recent readings while speaking: real speech always dips between syllables, steady noise does not. */
  let recent: number[] = [];

  const clampFloor = (f: number) => Math.min(c.maxFloor, Math.max(c.minFloor, f));
  const armLevel = () => Math.max(c.minArmRms, floor * c.armRatio);
  const startLevel = () => Math.max(c.minStartRms, floor * c.startRatio);
  const holdLevel = () => Math.max(c.minHoldRms, floor * c.holdRatio);

  function finish(now: number, reason: "silence" | "cap"): VadEnd {
    const speechMs = Math.max(0, lastVoice - firstVoice);
    const ev: VadEnd = {
      type: "end",
      // The peak must also stand clearly above the (possibly just raised) floor, so steady noise is dropped.
      keep: speechMs >= c.minSpeechMs && peak >= Math.max(c.minPeakRms, floor * c.startRatio),
      reason,
      durationMs: Math.max(0, now - armedAt),
      speechMs,
      peakRms: peak,
    };
    phase = "idle";
    peak = 0;
    recent = [];
    return ev;
  }

  function step(rms: number, now: number): VadEvent {
    if (!Number.isFinite(rms) || rms < 0) rms = 0;
    if (phase === "idle") {
      if (rms > armLevel()) {
        phase = "armed";
        armedAt = now;
        peak = rms;
        firstVoice = lastVoice = now;
        // Loud right away: confirm in the same frame.
        if (rms > startLevel()) { phase = "speaking"; return { type: "arm", confirmed: true }; }
        return { type: "arm", confirmed: false };
      }
      floor = clampFloor(floor * (1 - c.floorAlpha) + rms * c.floorAlpha);
      return { type: "none" };
    }
    if (phase === "armed") {
      peak = Math.max(peak, rms);
      if (rms > startLevel()) { phase = "speaking"; lastVoice = now; return { type: "start" }; }
      if (now - armedAt > c.armMs) {
        phase = "idle";
        peak = 0;
        // A false alarm is probably a louder background: let the floor learn from it quickly so it does not re-arm
        // over and over.
        floor = clampFloor(floor * (1 - c.cancelAlpha) + rms * c.cancelAlpha);
        return { type: "cancel" };
      }
      return { type: "none" };
    }
    // speaking
    peak = Math.max(peak, rms);
    recent.push(rms);
    if (recent.length > c.minWindowFrames) recent.shift();
    if (recent.length === c.minWindowFrames) {
      const quietest = Math.min(...recent);
      if (quietest > floor) floor = clampFloor(floor + (quietest - floor) * c.minTrackAlpha);
    }
    if (rms > holdLevel()) lastVoice = now;
    if (now - armedAt >= c.maxMs) return finish(now, "cap");
    if (now - lastVoice >= c.endSilenceMs) return finish(now, "silence");
    return { type: "none" };
  }

  return {
    step,
    /** True once speech is confirmed (the "hearing you" state). */
    phase: () => phase,
    floor: () => floor,
    /** Drop any utterance in progress (for example while the phone is reading aloud). Keeps the learned floor. */
    reset() { phase = "idle"; peak = 0; recent = []; },
    config: c,
  };
}

/** RMS of 8-bit time-domain samples from AnalyserNode.getByteTimeDomainData (128 = silence). */
export function rmsFromBytes(buf: ArrayLike<number>): number {
  if (!buf.length) return 0;
  let sum = 0;
  for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
  return Math.sqrt(sum / buf.length);
}

/** 0..1 for the level meter: roughly logarithmic so normal speech fills most of the bar. */
export function meterLevel(rms: number): number {
  if (rms <= 0.002) return 0;
  const db = 20 * Math.log10(rms); // about -54 dB (quiet) .. -6 dB (shouting)
  return Math.min(1, Math.max(0, (db + 54) / 46));
}
