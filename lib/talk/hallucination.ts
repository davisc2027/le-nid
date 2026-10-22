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

/** Real people say these too, so they are dropped only when the clip was short or quiet or Whisper doubted it. */
const SUSPECT = new Set([
  "thank you", "thank you very much", "thanks", "thank you so much", "you", "bye", "bye bye", "okay", "ok", "oh", "so", "um", "uh", "hmm",
  "merci", "merci beaucoup", "merci a vous", "merci de votre attention", "au revoir", "voila", "euh", "ah", "oui", "bon",
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
  if (SUSPECT.has(n) && (short || quiet || doubted)) return true;
  // Whisper itself is confident there was no speech and the clip was quiet.
  if (doubted && quiet) return true;
  return false;
}
