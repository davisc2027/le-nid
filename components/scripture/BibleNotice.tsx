"use client";

import { useEffect, useState } from "react";
import { bibleInstalled } from "@/lib/bible/load";

/** Shown only when the Bible JSON is not installed. Tells leaders how to fix it. */
export default function BibleNotice({ leader }: { leader: boolean }) {
  const [missing, setMissing] = useState(false);
  useEffect(() => { bibleInstalled().then((ok) => setMissing(!ok)); }, []);
  if (!missing) return null;
  return (
    <p className="card text-sm" role="alert">
      {leader
        ? "The Bible text is not installed, so verses can't be learned yet. Run `node scripts/build-bible.mjs` on a computer with internet, commit public/bible, and redeploy."
        : "Verses aren't available yet. A leader still needs to install the Bible text. Check back soon."}
    </p>
  );
}
