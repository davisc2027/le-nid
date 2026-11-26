import Link from "next/link";
import { loadPrivacy } from "@/lib/privacy-load";
import { SECTIONS, toBlocks, type SectionId } from "@/lib/privacy";

export const metadata = { title: "Privacy notice" };

export default async function Privacy() {
  const { content } = await loadPrivacy();
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-extrabold">Privacy notice</h1>
        <p className="mt-1 text-base">In plain English: what Le Nid keeps about you, why, and who can see it.</p>
      </div>
      {SECTIONS.filter((s) => s.id !== "summary").map((s) => (
        <section key={s.id} aria-labelledby={`p-${s.id}`} className="card flex flex-col gap-2">
          <h2 id={`p-${s.id}`} className="text-lg font-extrabold">{s.title}</h2>
          {toBlocks(content[s.id as SectionId]).map((b, i) => b.type === "ul"
            ? <ul key={i} className="flex list-disc flex-col gap-1 pl-5 text-base">{b.items.map((it, n) => <li key={n}>{it}</li>)}</ul>
            : <p key={i} className="text-base">{b.text}</p>)}
        </section>
      ))}
      <Link href="/" className="btn">Back to the app</Link>
    </div>
  );
}
