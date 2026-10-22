import { Fragment } from "react";
import Dots from "@/components/talk/Dots";
import type { Turn } from "@/components/talk/types";
import type { Side } from "@/lib/talk/lang";

const serif = "font-[family-name:var(--font-garamond)]";

/** Second layout: French column on the left, English on the right, each holding the whole conversation. Rows line up. */
export default function SideBySide({ turns, size }: { turns: Turn[]; size: number }) {
  const cell = (t: Turn, col: Side) => {
    const own = t.side === col;
    const text = t.side === null ? "" : own ? t.original : t.translation;
    const pending = t.side === null || (!own && !t.translation && t.status !== "failed");
    return (
      <div lang={col} className={`rounded-xl px-2.5 py-2 [overflow-wrap:anywhere] ${own ? "bg-tint" : "border border-border bg-surface"} ${col === "fr" ? serif : ""}`}
        style={{ fontSize: size }}>
        {own && <span className="mb-0.5 block font-sans text-[10px] font-extrabold uppercase tracking-wider text-muted">{col === "fr" ? "Dit" : "Said"}</span>}
        {pending ? <Dots label={t.side === null ? "Transcribing" : "Translating"} /> : text ? (
          <span className={`leading-snug ${own ? "" : "font-bold"} ${t.interim ? "italic opacity-70" : ""}`}>{text}</span>
        ) : (
          <span className="text-sm italic text-muted">{t.note ?? "No translation"}</span>
        )}
      </div>
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
