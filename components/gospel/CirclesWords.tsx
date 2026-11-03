"use client";

import { STEP_IDS, type GospelContent } from "@/lib/gospel";
import { PhraseRow } from "./Speak";

/** "1 · God's design" -> "Step 1 · God's design"; names without a number stay as they are. */
export const stepName = (title: string) => (/^\d/.test(title) ? `Step ${title}` : title);

/** The sentences and key words of each step with the phone's French voice, English meanings, and an optional Say-it. */
export default function CirclesWords({ content }: { content: GospelContent }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">Tap the speaker to hear it, the turtle to hear it slowly{" "}and the microphone to try it yourself (optional).</p>
      {STEP_IDS.map((id) => {
        const s = content.steps[id];
        const words = content.words.filter((w) => w.step === id);
        return (
          <section key={id} className="flex flex-col gap-2" aria-labelledby={`w-${id}`}>
            <h2 id={`w-${id}`} className="label mt-3">{stepName(s.title.en)}</h2>
            <PhraseRow fr={s.key.fr} en={s.key.en} mic />
            <PhraseRow fr={s.say.fr} en={s.say.en} mic small />
            {words.map((w) => <PhraseRow key={`${w.fr}|${w.en}`} fr={w.fr} en={w.en} />)}
          </section>
        );
      })}
      <h2 className="label mt-3">Start a conversation</h2>
      {content.openers.map((p) => <PhraseRow key={p.fr} fr={p.fr} en={p.en} mic />)}
      <h2 className="label mt-3">Listen well</h2>
      {content.listening.map((p) => <PhraseRow key={p.fr} fr={p.fr} en={p.en} mic />)}
      <h2 className="label mt-3">Ask at the end</h2>
      {content.closing.map((p) => <PhraseRow key={p.fr} fr={p.fr} en={p.en} mic />)}
      <p className="mt-2 rounded-xl bg-tint p-3 text-sm">Tip: draw the circles on paper while you talk. It keeps the conversation relaxed, and nobody needs a phone.</p>
    </div>
  );
}
