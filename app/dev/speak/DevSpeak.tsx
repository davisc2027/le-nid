"use client";

import { useState } from "react";
import SpeakStep from "@/components/speech/SpeakStep";

/** Dev harness body: shows "Done" when the step finishes, for the Playwright flow. */
export default function DevSpeak({ fr, en, note, mode }: { fr: string; en: string; note?: string; mode: "lesson" | "practice" }) {
  const [done, setDone] = useState(false);
  return (
    <main className="mx-auto max-w-xl p-4">
      <SpeakStep fr={fr} en={en} note={note} mode={mode} onDone={() => setDone(true)} onCantSpeak={() => setDone(true)} />
      <p data-testid="dev-done" className="mt-4 text-sm text-muted">{done ? "Done" : ""}</p>
    </main>
  );
}
