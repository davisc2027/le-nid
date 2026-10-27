"use client";

import { useRef, useState } from "react";

/** Option fields for the new-poll form: starts with 2, up to 8. Inputs are uncontrolled so the form's reset clears them. */
export default function PollOptions() {
  const next = useRef(2);
  const [ids, setIds] = useState([0, 1]);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-semibold">Options (2 to 8)</legend>
      {ids.map((id, n) => (
        <div key={id} className="flex items-center gap-2">
          <input className="input" name="option" maxLength={100} placeholder={`Option ${n + 1}`} aria-label={`Option ${n + 1}`} required={n < 2} />
          {ids.length > 2 && (
            <button type="button" className="min-h-11 min-w-11 shrink-0 rounded-xl border border-border text-lg" aria-label={`Remove option ${n + 1}`}
              onClick={() => setIds((cur) => cur.filter((x) => x !== id))}>×</button>
          )}
        </div>
      ))}
      {ids.length < 8 && (
        <button type="button" className="min-h-11 self-start px-1 text-sm font-semibold text-primary underline"
          onClick={() => setIds((cur) => [...cur, next.current++])}>+ Add option</button>
      )}
    </fieldset>
  );
}
