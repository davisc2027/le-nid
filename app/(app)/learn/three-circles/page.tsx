import CirclesApp from "@/components/gospel/CirclesApp";
import { loadGospel } from "@/lib/gospel-load";

export default async function ThreeCircles({ searchParams }: PageProps<"/learn/three-circles">) {
  const [{ content, reviewed }, sp] = await Promise.all([loadGospel(), searchParams]);
  const raw = Number(Array.isArray(sp.step) ? sp.step[0] : sp.step);
  return <CirclesApp content={content} reviewed={reviewed} startStep={Number.isFinite(raw) ? raw : 0} />;
}
