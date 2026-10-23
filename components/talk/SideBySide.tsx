import { Fragment } from "react";
import Dots from "@/components/talk/Dots";
import type { Turn } from "@/components/talk/types";
import type { Side } from "@/lib/talk/lang";

const serif = "font-[family-name:var(--font-garamond)]";

/** Second layout: French column on the left, English on the right, each holding the whole conversation. Rows line up. */
export default function SideBySide({ turns, size, onOpen }: { turns: Turn[]; size: number; onOpen?: (id: number) => void }) {
  const cell = (t: Turn, col: Side) => {
    const own = t.side === col;
    const text = t.side === null ? "" : own ? t.original : t.translation;
    const pending = t.side === null || (!own && !t.translation && t.status !== "failed");
    const tappable = !!onOpen && t.side !== null && !t.interim;
    const Tag = tappable ? "button" : "div";
    return (
      <Tag lang={col} {...(tappable ? { type: "button" as const, onClick: () => onOpen!(t.id), "aria-label": `Actions for this sentence: ${t.original}` } : {})}
        className={`min-h-11 rounded-xl px-2.5 py-2 text-left [overflow-wrap:anywhere] ${own ? "bg-tint" : "border border-border bg-surface"} ${col === "fr" ? serif : ""}`}
        style={{ fontSize: size }}>
        {own && <span className="mb-0.5 block font-sans text-[10px] font-extrabold uppercase tracking-wider text-muted">{col === "fr" ? "Dit" : "Said"}</span>}
        {pending ? <Dots label={t.side === null ? "Transcribing" : "Translating"} /> : text ? (
          <span className={`leading-snug ${own ? (t.lowConfidence ? "underline decoration-dotted underline-offset-4 opacity-70" : "") : "font-bold"} ${t.interim ? "italic opacity-70" : ""}`}>{text}</span>
        ) : (
          <span className="text-sm italic text-muted">{t.note ?? "No translation"}</span>
        )}
        {!own && t.warnings && t.warnings.length > 0 && <span className="mt-1 block font-sans text-[11px] font-extrabold text-primary">May be off. Tap to check</span>}
      </Tag>
    );
  };
  return (
    <div className="grid grid-cols-2 gap-x-2 gap-y-2">
      <h2 className="label sticky top-0 z-10 bg-background py-1">Français</h2>
      <h2 className="label sticky top-0 z-10 bg-background py-1">English</h2>
      {turns.map((t) => (
        <Fragment key={t.id}>
          {cell(t, "fr")}
          {cell(t, "en")}
        </Fragment>
      ))}
    </div>
  );
}
