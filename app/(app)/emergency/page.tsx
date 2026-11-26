import Link from "next/link";
import { MapPin, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadEmergency } from "@/lib/emergency-load";
import { loadMyExtras } from "@/lib/my-extras";
import { GROUPS, telHref, type Item } from "@/lib/emergency";
import SayButton from "@/components/emergency/SayButton";

export const metadata = { title: "Emergency" };

const NUMBERS = [
  { n: "112", en: "Emergency, anywhere in Europe", fr: "Urgences, partout en Europe", say: [
    { fr: "Au secours !", en: "Help!" }, { fr: "J'ai besoin d'aide.", en: "I need help." }, { fr: "Je suis perdu(e).", en: "I am lost." }] },
  { n: "15", en: "SAMU: ambulance and medical emergency", fr: "SAMU : ambulance et urgence médicale", say: [
    { fr: "J'ai besoin d'une ambulance.", en: "I need an ambulance." }, { fr: "Quelqu'un est blessé.", en: "Someone is hurt." }] },
  { n: "17", en: "Police", fr: "Police secours", say: [
    { fr: "J'ai besoin de la police.", en: "I need the police." }, { fr: "On m'a volé mon sac.", en: "My bag was stolen." }] },
  { n: "18", en: "Fire brigade and rescue", fr: "Pompiers", say: [
    { fr: "Il y a un incendie.", en: "There is a fire." }, { fr: "Il y a un accident.", en: "There has been an accident." }] },
] as const;

const callBtn = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 font-bold text-primary-fg";

function ItemRow({ item }: { item: Item }) {
  return (
    <li className="flex flex-col gap-2 border-t border-border pt-3 first:border-t-0 first:pt-0">
      <p className="font-bold">{item.label}</p>
      {item.value && <p className="whitespace-pre-wrap break-words text-sm">{item.value}</p>}
      {(item.phone || item.map) && (
        <div className="flex flex-wrap gap-2">
          {item.phone && <a href={telHref(item.phone)} className={callBtn}><Phone size={18} aria-hidden="true" />Call {item.phone}</a>}
          {item.map && <a href={item.map} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-primary bg-surface px-4 py-2 font-bold text-primary"><MapPin size={18} aria-hidden="true" />Open map</a>}
        </div>
      )}
    </li>
  );
}

export default async function Emergency() {
  const supabase = await createClient();
  const [{ content }, mine] = await Promise.all([loadEmergency(), loadMyExtras(supabase)]);
  const hasContact = !!(mine?.emergency_name || mine?.emergency_phone);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-extrabold">Emergency</h1>
        <p className="mt-1 text-base">Take a breath. If someone is in danger, call <b>112</b> first. It is free from any phone in France. This page also works without internet once you have opened it online.</p>
      </div>

      <section aria-labelledby="nums" className="flex flex-col gap-3">
        <h2 id="nums" className="label">Numbers to call in France</h2>
        {NUMBERS.map((x) => (
          <div key={x.n} className="card flex flex-col gap-3">
            <a href={`tel:${x.n}`} aria-label={`Call ${x.n}: ${x.en}`} className={`flex min-h-16 items-center gap-3 rounded-xl px-4 py-2 ${x.n === "112" ? "bg-danger text-danger-fg" : "bg-primary text-primary-fg"}`}>
              <Phone size={26} aria-hidden="true" className="shrink-0" />
              <span className="text-3xl font-extrabold leading-none">{x.n}</span>
              <span className="min-w-0 text-sm font-bold leading-tight">{x.en}<span lang="fr" className="block font-normal opacity-90">{x.fr}</span></span>
            </a>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold text-muted">Tap the speaker to say it in French</p>
              {x.say.map((p) => <SayButton key={p.fr} fr={p.fr} en={p.en} />)}
            </div>
          </div>
        ))}
      </section>

      {(hasContact || mine) && (
        <section aria-labelledby="mine" className="card flex flex-col gap-2 !border-primary">
          <h2 id="mine" className="label">My emergency contact</h2>
          {hasContact ? (<>
            <p className="text-sm text-muted">Show this to someone who is helping you.</p>
            <p className="text-lg font-extrabold">{mine?.emergency_name || "Name not added"}{mine?.emergency_relation && <span className="text-base font-normal text-muted"> ({mine.emergency_relation})</span>}</p>
            {mine?.emergency_phone && <a href={telHref(mine.emergency_phone)} className={callBtn}><Phone size={18} aria-hidden="true" />Call {mine.emergency_phone}</a>}
            {mine?.medical_notes && <p className="whitespace-pre-wrap break-words text-sm"><b>Medical notes:</b> {mine.medical_notes}</p>}
            <Link href="/me#emergency" className="min-h-11 self-start py-2 text-sm text-muted underline">Change my emergency info</Link>
          </>) : (
            <Link href="/me#emergency" className="flex min-h-11 items-center font-bold text-primary underline">Add your emergency contact so leaders can reach someone for you →</Link>
          )}
        </section>
      )}

      {GROUPS.map((g) => content[g.id].length > 0 && (
        <section key={g.id} aria-labelledby={`g-${g.id}`} className="card flex flex-col gap-3">
          <h2 id={`g-${g.id}`} className="label">{g.title}</h2>
          <ul className="flex flex-col gap-3">{content[g.id].map((it, n) => <ItemRow key={n} item={it} />)}</ul>
        </section>
      ))}
    </div>
  );
}
