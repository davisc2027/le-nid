"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Floating shortcut so translation is one tap from anywhere, including mid-lesson. */
export default function TranslateFab() {
  if (usePathname().startsWith("/translate")) return null;
  return (
    <Link href="/translate" aria-label="Translate"
      className="fixed bottom-20 right-4 z-40 flex items-center gap-1.5 rounded-full bg-accent px-4 py-3 text-sm font-extrabold text-[#2b2118] shadow-lg">
      <span aria-hidden="true">🌐</span> Translate
    </Link>
  );
}
