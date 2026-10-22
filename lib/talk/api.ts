/** Shapes shared by /api/stt, /api/handoff and the Conversation mode page. */

export type SttErrorCode = "not_configured" | "rate_limited" | "upstream_error" | "bad_audio" | "unauthorized" | "forbidden";

export type SttOk = { text: string; language: string; dropped?: boolean };
export type SttError = { error: SttErrorCode; message: string; retryAfter?: number; scope?: "you" | "group" };

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
