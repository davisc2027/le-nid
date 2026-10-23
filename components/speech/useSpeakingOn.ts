"use client";

import { useSyncExternalStore } from "react";
import { setSpeakingOn, speakingOn } from "@/lib/speech/settings";

const EVENT = "le-nid-speaking-change";
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
};

/** The Me-page speaking switch as a hook, in step with changes made anywhere on the page. */
export function useSpeakingOn(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, speakingOn, () => true);
  return [on, (next) => { setSpeakingOn(next); window.dispatchEvent(new Event(EVENT)); }];
}
