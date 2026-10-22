import Stork from "@/components/art/Stork";

export default function Loading() {
  return <div className="flex flex-col items-center gap-2 pt-16 text-muted" role="status"><Stork mood="think" size={80} /><p>Un instant…</p></div>;
}
