import { notFound } from "next/navigation";
import { ALL_PHRASES } from "@/lib/french/content";
import DevSpeak from "./DevSpeak";

// Dev-only harness for the Say-it step (used by Playwright). Not found in production builds.
export default async function DevSpeakPage({ searchParams }: PageProps<"/dev/speak">) {
  if (process.env.NODE_ENV === "production") notFound();
  const q = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const want = one(q.phrase) ?? "Très";
  const p = ALL_PHRASES.find((x) => x.fr === want);
  if (!p) notFound();
  return <DevSpeak fr={p.fr} en={p.en} note={p.note} mode={one(q.mode) === "practice" ? "practice" : "lesson"} />;
}
