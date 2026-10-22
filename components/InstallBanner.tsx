"use client";

import { useEffect, useState } from "react";

/** iPhone only: push notifications work only once the app is added to the Home Screen. */
export default function InstallBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const standalone = (navigator as unknown as { standalone?: boolean }).standalone === true || matchMedia("(display-mode: standalone)").matches;
    setShow(ios && !standalone);
  }, []);
  if (!show) return null;
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
