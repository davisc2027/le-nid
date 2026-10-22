"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// One shared animated overlay + panel. Every bespoke `fixed inset-0 bg-black/*`
// modal in an app rebuilds this from scratch with a hard cut - replace them
// with this so enter/exit, Escape-to-close and stacking behave the same everywhere.
//
// Needs the motion.css utilities: .animate-modal-backdrop-in/out and
// .animate-modal-panel-in/out.
//
// Must be >= the longest exit animation (.animate-modal-*-out is 150ms).
const EXIT_MS = 200;

export default function Modal({
  open,
  onClose,
  children,
  labelledBy,
  panelClassName = "max-w-sm",
  dismissOnBackdrop = true,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  labelledBy?: string;
  // Width / height classes for the panel (default: small confirm-sized card).
  panelClassName?: string;
  // Long forms turn this off so a stray tap outside can't throw away typing.
  dismissOnBackdrop?: boolean;
}) {
  // `mounted` outlives `open` by EXIT_MS so the exit animation can play -
  // unmounting the instant `open` flips false would cut it off.
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);

  // Sync to the `open` prop during render (no effect needed for the state flip).
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
    }
  }

  useEffect(() => {
    if (!closing) return;
    const t = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, EXIT_MS);
    return () => clearTimeout(t);
  }, [closing]);

  useEffect(() => {
    if (!mounted) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mounted, onClose]);

  if (!mounted) return null;

  // Rendered at <body> level. Inside the page, any ancestor that creates a
  // stacking context or has a `transform` (including a finished animation that
  // used fill-mode `both`) traps `position:fixed` children and lets sticky
  // bars paint over tall dialogs.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className={`fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/45 ${
        closing ? "animate-modal-backdrop-out" : "animate-modal-backdrop-in"
      }`}
      onClick={dismissOnBackdrop ? onClose : undefined}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        onClick={(e) => e.stopPropagation()}
        className={`bg-surface text-foreground rounded-2xl shadow-2xl w-full ${panelClassName} ${
          closing ? "animate-modal-panel-out" : "animate-modal-panel-in"
        }`}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
