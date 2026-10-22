import Dots from "@/components/talk/Dots";
import type { Turn } from "@/components/talk/types";

const serif = "font-[family-name:var(--font-garamond)]";

/**
 * Default layout: one thread. English speaker on the right in the primary color, French speaker on the left.
 * Each bubble shows the translation large (what the listener needs) and the speaker's own words small beneath.
 */
export default function ChatThread({ turns, size }: { turns: Turn[]; size: number }) {
  const small = Math.max(12, Math.round(size * 0.7));
  return (
    <ol className="flex flex-col gap-3" aria-label="Conversation">
      {turns.map((t) => {
        const en = t.side === "en";
        const unknown = t.side === null;
        const align = unknown ? "self-center" : en ? "self-end" : "self-start";
        const look = en ? "bg-primary text-primary-fg rounded-br-md" : unknown ? "bg-tint text-primary" : "border border-border bg-surface rounded-bl-md";
        const mainLang = en ? "fr" : "en";
        return (
          <li key={t.id} className={`flex max-w-[88%] flex-col ${align}`}>
            <span className={`mb-0.5 text-[11px] font-extrabold uppercase tracking-wider text-muted ${en ? "self-end" : unknown ? "self-center" : "self-start"}`}>
              {unknown ? "Listening" : en ? "English → Français" : "Français → English"}
            </span>
            <div className={`rounded-2xl px-3.5 py-2.5 [overflow-wrap:anywhere] ${look}`}>
              {unknown ? (
                <Dots label="Transcribing" />
              ) : (
                <>
                  <p lang={mainLang} className={`font-bold leading-snug ${en ? serif : ""}`} style={{ fontSize: size }}>
                    {t.translation || (t.status === "failed" ? <span className="font-normal italic opacity-80">{t.note ?? "Couldn't translate this one."}</span> : <Dots label="Translating" />)}
                  </p>
                  <p lang={t.side ?? undefined} className={`mt-1 leading-snug opacity-80 ${t.interim ? "italic" : ""} ${en ? "" : serif}`} style={{ fontSize: small }}>
                    {t.original}
                  </p>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
