import ActionForm from "@/components/admin/ActionForm";
import { remindPerson } from "@/app/(app)/admin/actions";
import type { Attention } from "@/lib/attention";

const chip = "rounded-full px-2.5 py-1 text-xs font-bold";
const soft = `${chip} bg-tint text-primary`;

/** Who still has something open, worst first, with a one-tap reminder. Computed from data the Admin page already loaded. */
export default function NeedsAttention({ list, partial }: { list: Attention[]; partial: boolean }) {
  return (
    <>
      {list.length === 0 ? (
        <p className="text-base font-semibold text-good">Everyone is up to date. Nice work.</p>
      ) : (
        <p className="text-xs text-muted">Most to follow up first. Remind sends a short push to that one person about their open to-dos (at most once an hour).</p>
      )}
      {list.map((a) => (
        <div key={a.id} className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <p className="min-w-0 break-words font-semibold">{a.name}</p>
          <div className="flex flex-wrap gap-1.5">
            {a.overdue.count > 0 && <span className={`${chip} bg-danger text-danger-fg`}>{a.overdue.count} overdue: {a.overdue.first}{a.overdue.count > 1 ? ` +${a.overdue.count - 1}` : ""}</span>}
            {a.open > 0 && <span className={soft}>{a.open} to-do{a.open === 1 ? "" : "s"} open</span>}
            {a.notificationsOff && <span className={soft}>Notifications off</span>}
            {a.privacyMissing && <span className={soft}>Privacy not accepted</span>}
            {a.noEmergency && <span className={soft}>No emergency contact</span>}
            {a.notApproved && <span className={soft}>Not approved yet</span>}
          </div>
          {a.open > 0 && (
            <ActionForm action={remindPerson} label="Remind" buttonClass="btn ghost min-h-11 !px-4"
              confirm={`Send ${a.name} a reminder notification about their open to-dos?`}>
              <input type="hidden" name="id" value={a.id} />
            </ActionForm>
          )}
        </div>
      ))}
      {partial && <p className="text-xs text-muted">Some checks are switched off until their setup is done (run migration 0021 for emergency contacts and privacy, 0019 for notifications).</p>}
    </>
  );
}
