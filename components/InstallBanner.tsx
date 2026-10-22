"use client";

import { useEffect, useState } from "react";

type InstallEvent = Event & { prompt: () => Promise<unknown> };

/** Prompts to add the app to the Home Screen: native prompt on Android/Chrome, steps on iPhone (where push needs it). */
export default function InstallBanner() {
  const [ios, setIos] = useState(false);
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true || matchMedia("(display-mode: standalone)").matches;
    if (standalone) return;
    setIos(/iPhone|iPad|iPod/.test(navigator.userAgent));
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  if (evt)
    return (
      <div className="card !border-primary gap-2" role="note">
        <h2 className="font-extrabold">Add Le Nid to your Home Screen</h2>
        <p className="text-sm">Open it in one tap, like any other app, and keep your streak going.</p>
        <button className="btn" onClick={async () => { await evt.prompt(); setEvt(null); }}>Install</button>
      </div>
    );
  if (!ios) return null;
  return (
    <div className="card !border-primary gap-1" role="note">
      <h2 className="font-extrabold">Add Le Nid to your Home Screen</h2>
      <ol className="list-decimal pl-5 text-sm">
        <li>Tap the Share button at the bottom of Safari.</li>
        <li>Choose <b>Add to Home Screen</b>, then Add.</li>
        <li>Open Le Nid from your Home Screen and sign in there.</li>
        <li>Turn on notifications when asked.</li>
      </ol>
      <p className="text-xs text-muted">Without this step your iPhone can&apos;t send you announcements or reminders.</p>
    </div>
  );
}
