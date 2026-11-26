import { Check, Download, Minus } from "lucide-react";
import { telHref } from "@/lib/emergency";
import type { RosterPerson } from "@/lib/csv";

export type RosterCounts = Map<string, { done: number; total: number }>;

const yes = <span className="inline-flex items-center gap-0.5 text-good"><Check size={14} aria-hidden="true" />yes</span>;
const no = <span className="inline-flex items-center gap-0.5 text-muted"><Minus size={14} aria-hidden="true" />no</span>;
const dl = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-primary bg-surface px-4 py-2 text-sm font-bold text-primary";

/** The roster cards: one line per person, tap to see the emergency contact and medical notes (leaders only). */
export default function RosterSection({ people, pushOn, counts }: { people: RosterPerson[]; pushOn: Set<string> | null; counts: RosterCounts }) {
  return (
    <>
      <p className="text-xs text-muted">Tap a person to see their emergency contact and medical notes. Only leaders see this. Opening the Admin page with the roster is written to the log, and so is every download.</p>
      <div className="flex flex-wrap gap-2">
        <a href="/admin/export?type=roster" download className={dl}><Download size={18} aria-hidden="true" />Download roster CSV</a>
        <a href="/admin/export?type=todos" download className={dl}><Download size={18} aria-hidden="true" />Download to-dos CSV</a>
      </div>
      {people.length === 0 && <p className="text-sm text-muted">No approved people yet.</p>}
      {people.map((p) => {
        const c = counts.get(p.id) ?? { done: 0, total: 0 };
        const label = p.name || p.email || "(no name)";
        const hasContact = !!(p.emergency_name || p.emergency_phone);
        return (
          <details key={p.id} className="rounded-xl border border-border px-3">
            <summary className="flex min-h-11 cursor-pointer flex-col justify-center gap-1 py-2 text-sm">
              <span className="flex flex-wrap items-baseline gap-x-2"><span className="font-semibold">{label}</span>
                {p.team && <span className="text-muted">{p.team}</span>}
                {p.role === "admin" && <span className="tag">Leader</span>}
                <span className="text-xs text-muted">{p.status}</span></span>
              <span className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                <span>To-dos {c.done}/{c.total}</span>
                <span>Privacy {p.privacy_ack_at ? yes : no}</span>
                <span>Notifications {pushOn ? (pushOn.has(p.id) ? yes : no) : "?"}</span>
                <span>Emergency {hasContact ? (p.emergency_phone ? p.emergency_phone : yes) : <span className="font-bold text-danger">none</span>}</span>
              </span>
            </summary>
            <div className="flex flex-col gap-2 pb-3 text-sm">
              {p.email && <p className="break-all text-muted">{p.email}</p>}
              <p><b>Emergency contact:</b> {hasContact ? <>{p.emergency_name || "(no name)"}{p.emergency_relation ? ` (${p.emergency_relation})` : ""}</> : "none added"}</p>
              {p.emergency_phone && <a href={telHref(p.emergency_phone)} className="inline-flex min-h-11 items-center self-start rounded-xl bg-primary px-4 font-bold text-primary-fg">Call {p.emergency_phone}</a>}
              <p className="whitespace-pre-wrap break-words"><b>Medical notes:</b> {p.medical_notes || "none added"}</p>
            </div>
          </details>
        );
      })}
    </>
  );
}
