"use client";

import { useSpeakingOn } from "./useSpeakingOn";

/** Me page switch: Say-it steps in lessons and Pronunciation practice. On by default. */
export default function SpeakingToggle() {
  const [on, setOn] = useSpeakingOn();
  return (
    <label className="flex min-h-11 items-start gap-3">
      <input type="checkbox" className="mt-1 size-5 shrink-0 accent-primary" checked={on} onChange={(e) => setOn(e.target.checked)} />
      <span className="flex flex-col">
        <span className="font-bold">Speaking exercises</span>
        <span className="text-sm text-muted">Say-it steps in lessons and Pronunciation practice. Your voice stays on this phone.</span>
      </span>
    </label>
  );
}
