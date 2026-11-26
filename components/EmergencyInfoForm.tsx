"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { MyExtras } from "@/lib/my-extras";

export const EMERGENCY_FIELD_LIMITS = { name: 80, phone: 30, relation: 40, notes: 1000 } as const;
const L = EMERGENCY_FIELD_LIMITS;

/** "My emergency info" card on the Me page. Saves through save_my_emergency() (migration 0021), never to the profile table directly. */
export default function EmergencyInfoForm({ initial }: { initial: MyExtras }) {
  const router = useRouter();
  const [name, setName] = useState(initial.emergency_name ?? "");
  const [phone, setPhone] = useState(initial.emergency_phone ?? "");
  const [relation, setRelation] = useState(initial.emergency_relation ?? "");
  const [notes, setNotes] = useState(initial.medical_notes ?? "");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (phone.trim() && (!/^[0-9+()./ -]{5,30}$/.test(phone.trim()) || phone.replace(/\D/g, "").length < 4)) return setMsg({ ok: false, text: "That phone number does not look right. Use digits, spaces and + ( ) - only." });
    if ((name.trim() && !phone.trim()) || (!name.trim() && phone.trim())) return setMsg({ ok: false, text: "Add both a name and a phone number, so a leader can actually call them." });
    setBusy(true); setMsg(null);
    try {
      const { error } = await createClient().rpc("save_my_emergency", { p_name: name, p_phone: phone, p_relation: relation, p_notes: notes });
      setMsg(error ? { ok: false, text: "Could not save. Check your connection and try again." } : { ok: true, text: "Saved. Thank you." });
      if (!error) router.refresh();
    } catch {
      setMsg({ ok: false, text: "Could not save. Check your connection and try again." });
    }
    setBusy(false);
  }

  return (
    <form id="emergency" onSubmit={save} className="card scroll-mt-20 gap-3">
      <h2 className="label">My emergency info</h2>
      <p className="text-sm">Only your trip leaders can see this, and only so they can help you. It is optional, but we strongly recommend adding at least an emergency contact. <a href="/privacy" className="underline">How we use it</a></p>
      <label htmlFor="em-name" className="text-sm font-bold">Emergency contact name</label>
      <input id="em-name" className="input" value={name} maxLength={L.name} onChange={(e) => setName(e.target.value)} autoComplete="off" placeholder="e.g. Maria Lopez" />
      <label htmlFor="em-phone" className="text-sm font-bold">Their phone number</label>
      <input id="em-phone" className="input" type="tel" inputMode="tel" value={phone} maxLength={L.phone} onChange={(e) => setPhone(e.target.value)} autoComplete="off" placeholder="+1 512 555 0100" />
      <label htmlFor="em-rel" className="text-sm font-bold">How they are related to you</label>
      <input id="em-rel" className="input" value={relation} maxLength={L.relation} onChange={(e) => setRelation(e.target.value)} autoComplete="off" placeholder="e.g. Mom, roommate, pastor" />
      <label htmlFor="em-notes" className="text-sm font-bold">Medical notes <span className="font-normal text-muted">(optional)</span></label>
      <textarea id="em-notes" className="input" rows={4} value={notes} maxLength={L.notes} onChange={(e) => setNotes(e.target.value)} placeholder="Allergies, medications, anything leaders should know" />
      <p className="text-xs text-muted">{notes.length}/{L.notes}. Share only what you are comfortable with.</p>
      <button className="btn" disabled={busy}>{busy ? "Saving…" : "Save emergency info"}</button>
      {msg && <p className={`text-sm ${msg.ok ? "font-bold text-good" : "text-danger"}`} role={msg.ok ? "status" : "alert"}>{msg.text}</p>}
    </form>
  );
}
