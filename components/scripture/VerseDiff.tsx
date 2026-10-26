"use client";

import TapWords from "./TapWords";

/**
 * The expected verse with missed words marked; every word can be tapped to hear it (French).
 * English text (`lang="en"`) is shown as plain text: the tap-to-hear voice is French.
 */
export default function VerseDiff({ marks, group, lang = "fr" }: { marks: { word: string; ok: boolean }[]; group?: string; lang?: "fr" | "en" }) {
  if (lang === "en") {
    return (
      <p lang="en" className="verse-text">
        {marks.map((m, i) => (
          <span key={i}>{i > 0 && " "}<span className={m.ok ? "" : "rounded-md bg-tint font-bold text-primary underline decoration-wavy decoration-primary"}>{m.word}</span></span>
        ))}
      </p>
    );
  }
  const bad = new Set(marks.flatMap((m, i) => (m.ok ? [] : [i])));
  return <TapWords text={marks.map((m) => m.word).join(" ")} bad={bad} group={group} className="verse-text" />;
}
