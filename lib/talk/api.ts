/** Shapes shared by /api/stt, /api/handoff and the Conversation mode page. */

export type SttErrorCode = "not_configured" | "rate_limited" | "upstream_error" | "bad_audio" | "unauthorized" | "forbidden";

/** Per-request details returned only when the client sends diag=1 (the hidden diagnostics panel). */
export type SttDiag = {
  model: string;
  /** What we asked Whisper for: a language code, or "auto". */
  sentLanguage: string;
  whisperLanguage: string;
  /** Result of the free text check on the transcript. */
  textLang: string;
  textScore: number;
  promptUsed: boolean;
  dropReason?: string;
  segments: { verdict: string; avgLogprob?: number; noSpeechProb?: number; compressionRatio?: number }[];
  /** Server time in ms: first Groq call, retry call, whole request. */
  ms: { first: number; retry?: number; total: number };
};

/** Every field after `language` is optional, so older clients keep working. */
export type SttOk = {
  text: string;
  language: string;
  dropped?: boolean;
  /** 0..1, from Whisper's segment log-probabilities. */
  confidence?: number;
  lowConfidence?: boolean;
  /** The server asked Whisper a second time with a forced language. */
  retried?: boolean;
  /** The language was fixed (by the client, or by the retry): do not second-guess it from the text. */
  forced?: boolean;
  diag?: SttDiag;
};
export type SttError = { error: SttErrorCode; message: string; retryAfter?: number; scope?: "you" | "group" };

export const STT_MODELS = ["whisper-large-v3-turbo", "whisper-large-v3"] as const;
export const STT_DEFAULT_MODEL = "whisper-large-v3-turbo";
export const STT_MAX_BYTES = 2 * 1024 * 1024;
export const STT_PER_MINUTE = 30;
export const STT_PER_HOUR = 120;
/** Real per-user daily caps live in Postgres (use_stt_clip, use_translate_chars); these mirror them for messages. */
export const STT_PER_DAY = 120;
export const TRANSLATE_CHARS_PER_DAY = 15000;
export const DAILY_STT_MESSAGE = "Voice limit for today reached. It resets tomorrow.";
export const DAILY_TRANSLATE_MESSAGE = "You've used today's translation allowance. It resets tomorrow.";
/** Groq's free tier allows about 20 transcription requests per minute for the whole key, so for the whole group. */
export const GROUP_PER_MINUTE = 20;
export const HANDOFF_PER_HOUR = 5;
