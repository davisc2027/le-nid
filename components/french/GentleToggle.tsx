"use client";

import { useEffect, useState } from "react";
import { GENTLE_KEY } from "@/lib/odile";

export default function GentleToggle() {
  const [gentle, setGentle] = useState(false);
  useEffect(() => { try { setGentle(localStorage.getItem(GENTLE_KEY) === "1"); } catch {} }, []);
  function toggle() {
    const next = !gentle;
    setGentle(next);
    try { localStorage.setItem(GENTLE_KEY, next ? "1" : "0"); } catch {}
  }
  return (
    <button onClick={toggle} className="self-start text-xs text-muted underline">
      {gentle ? "Odile is gentle. Bring back the sass" : "Odile too sassy? Make her gentler"}
    </button>
  );
}
