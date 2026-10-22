"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import ConfirmDialog from "@/components/ui/ConfirmDialog";

export type State = { ok?: string; error?: string } | null;

function Submit({ label, className }: { label: string; className?: string }) {
  const { pending } = useFormStatus();
  return <button className={className ?? "btn"} disabled={pending}>{pending ? "Working…" : label}</button>;
}

/** Server-action form with a pending state (no double submits) and a success/error message. */
export default function ActionForm({ action, label, children, className = "flex flex-col gap-2", buttonClass, confirm, reset = false }: {
  action: (prev: State, f: FormData) => Promise<State>;
  label: string;
  children?: React.ReactNode;
  className?: string;
  buttonClass?: string;
  confirm?: string;
  reset?: boolean;
}) {
  const [state, formAction] = useActionState(async (prev: State, f: FormData) => {
    const res = await action(prev, f);
    if (reset && res?.ok) ref.current?.reset();
    return res;
  }, null);
  const ref = useRef<HTMLFormElement>(null);
  const confirmed = useRef(false);
  const [asking, setAsking] = useState(false);
  return (
    <>
    <form ref={ref} action={formAction} className={className}
      onSubmit={confirm ? (e) => { if (confirmed.current) { confirmed.current = false; return; } e.preventDefault(); setAsking(true); } : undefined}>
      {children}
      <Submit label={label} className={buttonClass} />
      {state?.ok && <p className="text-sm text-primary" role="status">{state.ok}</p>}
      {state?.error && <p className="text-sm text-red-600" role="alert">{state.error}</p>}
    </form>
    <ConfirmDialog request={asking ? { title: "Are you sure?", message: confirm ?? "", confirmLabel: label, danger: true, onConfirm: () => { confirmed.current = true; ref.current?.requestSubmit(); } } : null} onClose={() => setAsking(false)} />
    </>
  );
}
