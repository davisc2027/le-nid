"use client";

import TapWords from "./TapWords";

/** The expected verse with missed words marked; every word can be tapped to hear it. */
export default function VerseDiff({ marks, group }: { marks: { word: string; ok: boolean }[]; group?: string }) {
  const bad = new Set(marks.flatMap((m, i) => (m.ok ? [] : [i])));
  return <TapWords text={marks.map((m) => m.word).join(" ")} bad={bad} group={group} className="verse-text" />;
}
