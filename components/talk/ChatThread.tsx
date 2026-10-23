import { CircleHelp } from "lucide-react";
import Dots from "@/components/talk/Dots";
import type { Turn } from "@/components/talk/types";

const serif = "font-[family-name:var(--font-garamond)]";

/**
 * Default layout: one thread. English speaker on the right in the primary color, French speaker on the left.
 * Each bubble shows the translation large (what the listener needs) and the speaker's own words small beneath.
 * Tapping a finished bubble opens its actions (edit, wrong language, delete, check meaning).
 */
export default function ChatThread({ turns, size, onOpen }: { turns: Turn[]; size: number; onOpen?: (id: number) => void }) {
  const small = Math.max(12, Math.round(size * 0.7));
  return (
    <ol className="flex flex-col gap-3" aria-label="Conversation">
      {turns.map((t) => {
        const en = t.side === "en";
        const unknown = t.side === null;
        const align = unknown ? "self-center" : en ? "self-end" : "self-start";
        const look = en ? "bg-primary text-primary-fg rounded-br-md" : unknown ? "bg-tint text-primary" : "border border-border bg-surface rounded-bl-md";
        const mainLang = en ? "fr" : "en";
        const tappable = !unknown && !t.interim && !!onOpen;
        const body = unknown ? (
          <Dots label="Transcribing" />
        ) : (
          <>
            <p lang={mainLang} className={`font-bold leading-snug ${en ? serif : ""}`} style={{ fontSize: size }}>
              {t.translation || (t.status === "failed" ? <span className="font-normal italic opacity-80">{t.note ?? "Couldn't translate this one."}</span> : <Dots label="Translating" />)}
            </p>
            <p lang={t.side ?? undefined} className={`mt-1 leading-snug ${t.lowConfidence ? "opacity-60 underline decoration-dotted underline-offset-4" : "opacity-80"} ${t.interim ? "italic" : ""} ${en ? "" : serif}`} style={{ fontSize: small }}>
              {t.original}
            </p>
            {t.check && (
              <p className="mt-1.5 border-t border-current/20 pt-1.5 text-xs leading-snug" lang={t.side === "en" ? "en" : "fr"}>
                <span className="font-extrabold uppercase tracking-wider opacity-80">{t.side === "en" ? "Meant" : "Voulu"}: </span>
                {t.check.status === "loading" ? "…" : t.check.status === "failed" ? "Couldn't check this one." : t.check.text}
              </p>
            )}
            {t.warnings && t.warnings.length > 0 && (
              <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-extrabold text-[#2b2118]">
                <CircleHelp size={13} aria-hidden="true" />May be off. Tap to check
              </span>
            )}
          </>
        );
        return (
          <li key={t.id} className={`flex max-w-[88%] flex-col ${align}`}>
            <span className={`mb-0.5 text-[11px] font-extrabold uppercase tracking-wider text-muted ${en ? "self-end" : unknown ? "self-center" : "self-start"}`}>
              {unknown ? "Listening" : en ? "English → Français" : "Français → English"}
            </span>
            {tappable ? (
              <button type="button" onClick={() => onOpen!(t.id)} aria-label={`Actions for this sentence: ${t.original}`}
                className={`min-h-11 rounded-2xl px-3.5 py-2.5 text-left [overflow-wrap:anywhere] ${look}`}>
                {body}
              </button>
            ) : (
              <div className={`rounded-2xl px-3.5 py-2.5 [overflow-wrap:anywhere] ${look}`}>{body}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
