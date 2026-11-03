import ShowThem from "@/components/gospel/ShowThem";
import { loadGospel } from "@/lib/gospel-load";

export default async function ShowThemPage({ searchParams }: PageProps<"/learn/three-circles/show">) {
  const [{ content, reviewed }, sp] = await Promise.all([loadGospel(), searchParams]);
  const raw = Number(Array.isArray(sp.step) ? sp.step[0] : sp.step);
  return <ShowThem content={content} reviewed={reviewed} startStep={Number.isFinite(raw) ? raw : 0} />;
}
