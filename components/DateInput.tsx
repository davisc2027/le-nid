"use client";

import { useEffect, useRef, useState } from "react";

const HINT = { date: "Select date", time: "Select time", "datetime-local": "Select date and time" } as const;

/** Date/time field with helper text inside the box while it is empty (iOS shows nothing in an empty date field). */
export default function DateInput({ type, className = "input", defaultValue, ...rest }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value"> & { type: keyof typeof HINT }) {
  const ref = useRef<HTMLInputElement>(null);
  const [has, setHas] = useState(!!defaultValue);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const sync = () => setHas(!!el.value);
    // A form reset clears the value after the event, so read it on the next tick.
    const reset = () => setTimeout(sync, 0);
    el.addEventListener("input", sync);
    el.addEventListener("change", sync);
    el.form?.addEventListener("reset", reset);
    return () => { el.removeEventListener("input", sync); el.removeEventListener("change", sync); el.form?.removeEventListener("reset", reset); };
  }, []);
  return (
    <div className="relative">
      <input ref={ref} type={type} defaultValue={defaultValue} className={`${className} ${has ? "" : "date-empty"}`} {...rest} />
      {!has && <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-muted">{HINT[type]}</span>}
    </div>
  );
}
