"use client";

import { useEffect, useState } from "react";
import { Share, SquarePlus } from "lucide-react";

/** iPhone only: push notifications work only once the app is added to the Home Screen. */
export default function InstallBanner({ compact = false }: { compact?: boolean }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true || matchMedia("(display-mode: standalone)").matches;
    setShow(ios && !standalone);
  }, []);
  if (!show) return null;
  if (compact) {
    return (
      <div className="card !border-primary gap-1 text-left" role="note">
        <h2 className="font-extrabold">Install first, then sign in</h2>
        <p className="text-sm">
          In Safari, tap <Share className="inline h-4 w-4 align-text-bottom" aria-label="Share" /> then <b>Add to Home Screen</b> <SquarePlus className="inline h-4 w-4 align-text-bottom" aria-hidden="true" />. Open Le Nid from your Home Screen and sign in there. The app and Safari don&apos;t share your login, and you only need to sign in once.
        </p>
      </div>
    );
  }
  return (
    <div className="card !border-primary gap-1" role="note">
      <h2 className="font-extrabold">Add Le Nid to your Home Screen</h2>
      <ol className="list-decimal pl-5 text-sm">
        <li>Tap the Share button at the bottom of Safari.</li>
        <li>Choose <b>Add to Home Screen</b>, then Add.</li>
        <li>Open Le Nid from your Home Screen and sign in there.</li>
        <li>Turn on notifications when asked.</li>
      </ol>
      <p className="text-xs text-muted">Without this step your iPhone can't send you announcements or reminders.</p>
    </div>
  );
}
