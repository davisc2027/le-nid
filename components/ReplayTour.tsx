"use client";

import { PlayCircle } from "lucide-react";

export default function ReplayTour() {
  return (
    <button type="button" onClick={() => window.dispatchEvent(new Event("nid:tour"))}
      className="btn ghost self-start">
      <PlayCircle size={18} aria-hidden="true" />Replay the tour
    </button>
  );
}
