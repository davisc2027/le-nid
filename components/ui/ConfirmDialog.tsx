"use client";

import Modal from "./Modal";

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

// Replaces native window.confirm(): same job (block a destructive or one-way
// action on an explicit yes) but styled, animated, and it doesn't block the
// JS thread.
//
// Migration recipe for a handler that used to do
//     if (!confirm("Delete this?")) return;  ...work...
//   1. keep the handler's name as the TRIGGER:
//        function deleteThing() { setConfirmReq({ title, message, danger: true,
//                                   confirmLabel: "Delete", onConfirm: doDeleteThing }); }
//   2. move the work into `async function doDeleteThing() { ... }`
//   3. if the work needs arguments: onConfirm: () => doDeleteThing(id)
//   4. render once per component:  <ConfirmDialog request={confirmReq} onClose={() => setConfirmReq(null)} />
// Call sites (onClick={deleteThing}) don't change.
export default function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
}) {
  return (
    <Modal open={!!request} onClose={onClose} labelledBy="confirm-dialog-title">
      {request && (
        <div className="p-5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
              request.danger ? "bg-tint text-primary" : "bg-tint text-primary"
            }`}
          >
            {/* inline triangle-alert so the template has no icon-library dependency */}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>
          <h3 id="confirm-dialog-title" className="font-semibold text-foreground mb-1.5">
            {request.title}
          </h3>
          <p className="text-sm text-muted mb-5">{request.message}</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-press flex-1 px-3 py-2 rounded-lg text-sm font-medium text-muted hover:bg-tint"
            >
              {request.cancelLabel ?? "Cancel"}
            </button>
            <button
              type="button"
              onClick={() => {
                request.onConfirm();
                onClose();
              }}
              
              className={`btn-press flex-1 px-3 py-2 rounded-lg text-sm font-medium text-primary-fg ${
                request.danger ? "bg-primary" : "bg-primary"
              }`}
            >
              {request.confirmLabel ?? "Confirm"}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
