/**
 * DEMO MODE (development only). Enabled when NODE_ENV !== "production" AND the URL has ?demo=1.
 * Replaces the microphone, /api/stt, /api/translate and /api/handoff with scripted fakes so the page's states can be
 * screenshotted without a microphone, Groq or DeepL. Options: &fail=rate_limited|not_configured|upstream_error
 * (after two lines), &standalone=1 (pretend to be the Home Screen app), &mode=safari (start in the backup).
 * Nothing here runs in a production build: the page only passes demo options when NODE_ENV !== "production".
 */
import type { SttErrorCode } from "@/lib/talk/api";
import type { SttResult, TranslateResult, HandoffResult } from "@/lib/talk/client";
import type { DeepLTarget, Side } from "@/lib/talk/lang";

export type DemoOptions = { fail?: SttErrorCode; standalone?: boolean };

export const DEMO_LINES = [
  { lang: "fr", text: "Bonjour ! Vous visitez Strasbourg ?", other: "Hello! Are you visiting Strasbourg?" },
  { lang: "en", text: "Yes, we're here with a church group from Texas.", other: "Oui, nous sommes ici avec un groupe d'église du Texas." },
  { lang: "fr", text: "C'est super. Vous connaissez déjà la cathédrale ?", other: "That's great. Do you already know the cathedral?" },
  { lang: "en", text: "Not yet. Could you tell us the best way to get there?", other: "Pas encore. Pourriez-vous nous dire comment y aller ?" },
  { lang: "fr", text: "Prenez le tram C jusqu'à Homme de Fer, puis marchez cinq minutes.", other: "Take tram C to Homme de Fer, then walk five minutes." },
  { lang: "en", text: "Thank you so much, that's very kind.", other: "Merci beaucoup, c'est très gentil." },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createDemo(opts: DemoOptions) {
  let n = 0;
  const lastBy = new Map<string, string>();
  return {
    async transcribe(forced?: Side): Promise<SttResult> {
      await wait(700);
      let i = n++;
      if (forced) { while (DEMO_LINES[i % DEMO_LINES.length].lang !== forced) i++; n = i + 1; }
      if (opts.fail && i >= 2) {
        const messages: Record<string, string> = {
          rate_limited: "The group's voice limit is used up for a moment.",
          not_configured: "Live listening isn't set up yet.",
          upstream_error: "The voice service had a problem.",
        };
        return { ok: false, code: opts.fail, message: messages[opts.fail] ?? "Demo failure.", retryAfter: opts.fail === "rate_limited" ? 42 : undefined, scope: "group" };
      }
      const line = DEMO_LINES[i % DEMO_LINES.length];
      lastBy.set(line.text, line.other);
      // Index 3 pretends Whisper was unsure, so the dimmed original line can be seen in screenshots.
      return { ok: true, text: line.text, language: line.lang, dropped: false, confidence: i % 6 === 3 ? 0.41 : 0.9, lowConfidence: i % 6 === 3, forced: !!forced };
    },
    async translate(text: string, target: DeepLTarget): Promise<TranslateResult> {
      await wait(500);
      const known = lastBy.get(text) ?? DEMO_LINES.find((l) => l.text === text)?.other;
      // The tram line pretends the number check fired, so the "May be off" chip can be seen in screenshots.
      return { ok: true, text: known ?? (target === "FR" ? `(FR) ${text}` : `(EN) ${text}`), engine: "demo", warnings: text.startsWith("Prenez le tram") ? ["numbers"] : undefined };
    },
    async handoff(): Promise<HandoffResult> {
      await wait(400);
      return { ok: true, url: `${location.origin}/auth/handoff?th=demo-token-not-real&next=%2Ftranslate%2Ftalk%3Fmode%3Dsafari` };
    },
    /** Fake Safari recognition: a scripted line in the chosen language, shown as interim words then final. */
    recognitionLine(lang: "en" | "fr", i: number) {
      const pool = DEMO_LINES.filter((l) => l.lang === lang);
      return pool[i % pool.length].text;
    },
  };
}
export type Demo = ReturnType<typeof createDemo>;
