/**
 * Whisper invents text for silence and noise, almost always the same few phrases (YouTube outros and subtitle
 * credits it was trained on). This decides which transcripts to drop before they become bubbles.
 */

export type ClipInfo = {
  /** Length of the uploaded clip in seconds (client-measured, best effort). */
  durationSec?: number;
  /** Loudest analyser RMS in the clip (client-measured, best effort). */
  peakRms?: number;
  /** Highest Whisper no_speech_prob across segments, when the response includes segments. */
  noSpeechProb?: number;
};

/** Lowercase, no accents, no punctuation, single spaces. */
export function normalizeTranscript(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Never real speech in a street conversation: drop whatever the clip looked like. */
const ALWAYS = [
  /^sous titr/, // "Sous-titres réalisés par la communauté d'Amara.org", "Sous-titrage ST' 501"
  /amara org/,
  /^(thanks|thank you) for watching/,
  /^merci d avoir regarde/,
  /^merci de nous avoir regarde/,
  /^(please )?(like and )?subscribe/,
  /^abonnez vous/,
  /^n oubliez pas de vous abonner/,
  /^see you (in the )?next (time|video)/,
  /^a la prochaine( fois)?$/,
  /^transcription par/,
  /^subtitles by/,
];

/**
 * Real people say these too ("Merci.", "Thank you."), so they are dropped only when the clip was quiet or Whisper
 * doubted it (or, when Whisper gave no confidence at all, when the clip was also short). "oui" is not a known
 * Whisper invention and is not listed.
 */
export const SUSPECT = new Set([
  "thank you", "thank you very much", "thanks", "thank you so much", "you", "bye", "bye bye", "okay", "ok", "oh", "so", "um", "uh", "hmm",
  "merci", "merci beaucoup", "merci a vous", "merci de votre attention", "au revoir", "voila", "euh", "ah", "bon",
]);

const SHORT_SEC = 1.2;
const QUIET_PEAK = 0.045;
const NO_SPEECH = 0.5;

export function shouldDropTranscript(text: string, clip: ClipInfo = {}): boolean {
  const n = normalizeTranscript(text);
  // Empty, a lone letter, or only punctuation/dots.
  if (n.replace(/ /g, "").length < 2) return true;
  if (ALWAYS.some((r) => r.test(n))) return true;
  // The same word over and over ("you you you you").
  const words = n.split(" ");
  if (words.length >= 6 && new Set(words).size <= 2) return true;
  const short = clip.durationSec !== undefined && clip.durationSec < SHORT_SEC;
  const quiet = clip.peakRms !== undefined && clip.peakRms < QUIET_PEAK;
  const doubted = clip.noSpeechProb !== undefined && clip.noSpeechProb > NO_SPEECH;
  if (SUSPECT.has(n) && (quiet || doubted || (short && clip.noSpeechProb === undefined))) return true;
  // Whisper itself is confident there was no speech and the clip was quiet.
  if (doubted && quiet) return true;
  return false;
}

// ----- per-segment confidence (Whisper verbose_json) -----

export type WhisperSegment = {
  text?: string;
  start?: number;
  end?: number;
  avg_logprob?: number;
  no_speech_prob?: number;
  compression_ratio?: number;
};

/** Whisper's own decode-failure thresholds, plus a stricter rule for the usual inventions. */
export const SEGMENT_RULES = {
  noSpeechWithLowLogprob: { noSpeech: 0.6, logprob: -1.0 },
  maxCompression: 2.4,
  suspectNoSpeech: 0.8,
  lowConfidenceLogprob: -0.7,
} as const;

export type SegmentVerdict = "keep" | "silence" | "looping" | "suspect";

export function judgeSegment(seg: WhisperSegment): SegmentVerdict {
  const nsp = seg.no_speech_prob, lp = seg.avg_logprob, cr = seg.compression_ratio;
  const r = SEGMENT_RULES;
  if (nsp !== undefined && lp !== undefined && nsp > r.noSpeechWithLowLogprob.noSpeech && lp < r.noSpeechWithLowLogprob.logprob) return "silence";
  if (cr !== undefined && cr > r.maxCompression) return "looping";
  if (nsp !== undefined && nsp > r.suspectNoSpeech && SUSPECT.has(normalizeTranscript(seg.text ?? ""))) return "suspect";
  return "keep";
}

export type SegmentSummary = {
  text: string;
  /** Per segment: what happened to it (for the diagnostics panel). */
  verdicts: { verdict: SegmentVerdict; avgLogprob?: number; noSpeechProb?: number; compressionRatio?: number }[];
  keptCount: number;
  droppedCount: number;
  /** Highest no_speech_prob among kept segments. */
  noSpeechProb?: number;
  /** exp(duration-weighted mean avg_logprob) of kept segments: roughly "how likely the words were", 0..1. */
  confidence?: number;
  lowConfidence: boolean;
};

/** Collapses a 3+ word phrase repeated three or more times in a row into one occurrence ("de-loop"). */
export function deloop(text: string): string {
  const words = text.split(/\s+/).filter(Boolean);
  const key = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, "");
  let out = words;
  for (let n = Math.min(12, Math.floor(words.length / 3)); n >= 3; n--) {
    let i = 0;
    const next: string[] = [];
    let changed = false;
    while (i < out.length) {
      let reps = 1;
      while (i + (reps + 1) * n <= out.length && out.slice(i, i + n).every((w, k) => key(w) === key(out[i + reps * n + k]))) reps++;
      if (reps >= 3) { next.push(...out.slice(i, i + n)); i += reps * n; changed = true; } else { next.push(out[i]); i++; }
    }
    if (changed) out = next;
  }
  return out.join(" ");
}

/**
 * Applies the segment rules: drops failed segments (not the whole clip), rebuilds the text from the rest and
 * summarises confidence. With no segments in the response, the plain text is returned untouched.
 */
export function summarizeSegments(fallbackText: string, segments: WhisperSegment[] | undefined): SegmentSummary {
  if (!segments?.length) return { text: deloop(fallbackText.trim()), verdicts: [], keptCount: 0, droppedCount: 0, lowConfidence: false };
  const verdicts: SegmentSummary["verdicts"] = [];
  const kept: WhisperSegment[] = [];
  for (const s of segments) {
    const verdict = judgeSegment(s);
    verdicts.push({ verdict, avgLogprob: s.avg_logprob, noSpeechProb: s.no_speech_prob, compressionRatio: s.compression_ratio });
    if (verdict === "keep") kept.push(s);
  }
  const text = deloop(kept.map((s) => (s.text ?? "").trim()).filter(Boolean).join(" "));
  let wSum = 0, lpSum = 0, nsp: number | undefined;
  for (const s of kept) {
    if (typeof s.avg_logprob === "number") {
      const w = Math.max(0.2, (s.end ?? 0) - (s.start ?? 0));
      wSum += w;
      lpSum += w * s.avg_logprob;
    }
    if (typeof s.no_speech_prob === "number") nsp = Math.max(nsp ?? 0, s.no_speech_prob);
  }
  const meanLp = wSum > 0 ? lpSum / wSum : undefined;
  return {
    text,
    verdicts,
    keptCount: kept.length,
    droppedCount: segments.length - kept.length,
    noSpeechProb: nsp,
    confidence: meanLp === undefined ? undefined : Math.min(1, Math.max(0, Math.exp(meanLp))),
    lowConfidence: meanLp !== undefined && meanLp < SEGMENT_RULES.lowConfidenceLogprob,
  };
}
