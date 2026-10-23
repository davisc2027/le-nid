"use client";

import { Check, Compass, Mail, Share, Smartphone, SquarePlus } from "lucide-react";
import Logo from "@/components/art/Logo";

function Step({ n, icon, title, children }: { n: number; icon: React.ReactNode; title: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary font-extrabold text-primary-fg" aria-hidden="true">{n}</span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 font-extrabold">{title} <span className="text-primary">{icon}</span></p>
        {children && <p className="text-sm text-muted">{children}</p>}
      </div>
    </li>
  );
}

/** Shown to iPhone visitors in Safari before the sign-in form. Notifications, sounds and a login that sticks only work from the Home Screen app. */
export default function InstallFirst({ inApp, onSkip }: { inApp: boolean; onSkip: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-4 px-4 py-6">
      <h1 className="sr-only">Install Le Nid</h1>
      <Logo stacked size={96} />
      <div className="card gap-1 text-center">
        <p className="text-lg font-extrabold">Step 1: add Le Nid to your Home Screen</p>
        <p className="text-sm text-muted">Do this first. Announcements, reminders and staying signed in only work from the app on your Home Screen. It takes under a minute.</p>
      </div>

      {inApp && (
        <div className="card !border-primary gap-1 text-sm" role="alert">
          <p className="flex items-center gap-2 font-extrabold"><Compass size={18} aria-hidden="true" /> Open this page in Safari first</p>
          <p>This looks like an in-app browser, which can&apos;t add apps to your Home Screen. Tap the menu (••• or the compass icon) and choose <b>Open in Safari</b>, then come back to these steps.</p>
        </div>
      )}

      <ol className="card flex flex-col gap-4">
        <Step n={1} icon={<Share size={20} aria-hidden="true" />} title="Tap the Share button">
          It&apos;s the square with an arrow pointing up, at the bottom of Safari. If you don&apos;t see it, tap ••• first, then Share.
        </Step>
        <Step n={2} icon={<SquarePlus size={20} aria-hidden="true" />} title="Tap Add to Home Screen">
          Scroll down in the menu if you need to. Keep &ldquo;Open as Web App&rdquo; on if you see it.
        </Step>
        <Step n={3} icon={<Check size={20} aria-hidden="true" />} title="Tap Add">
          It&apos;s in the top right corner. Le Nid appears on your Home Screen with the stork.
        </Step>
        <Step n={4} icon={<Smartphone size={20} aria-hidden="true" />} title="Open Le Nid from your Home Screen">
          Close Safari and tap the Le Nid icon. Don&apos;t keep using this page.
        </Step>
      </ol>

      <div className="card gap-1">
        <p className="flex items-center gap-2 font-extrabold"><Mail size={18} className="text-primary" aria-hidden="true" /> Step 2: sign in inside the app</p>
        <p className="text-sm text-muted">When the app opens, enter your email, then the 8-digit code we send you. A trip leader will approve you, and then you&apos;re in. Turn on notifications when it asks.</p>
      </div>

      <p className="text-center text-xs text-muted">
        Using Chrome on iPhone? Tap Share in the top right, then Add to Home Screen.
      </p>
      <button type="button" onClick={onSkip} className="mx-auto min-h-11 px-3 text-xs text-muted underline">Having trouble? Continue in the browser anyway</button>
    </main>
  );
}
