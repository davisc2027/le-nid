import type { Metadata } from "next";
import TalkScreen from "@/components/talk/TalkScreen";
import type { DemoOptions } from "@/lib/talk/demo";

export const metadata: Metadata = { title: "Conversation | Le Nid" };

const FAILS = ["rate_limited", "not_configured", "upstream_error"] as const;

export default async function TalkPage({ searchParams }: PageProps<"/translate/talk">) {
  const sp = await searchParams;
  const one = (k: string) => (Array.isArray(sp[k]) ? sp[k][0] : sp[k]);
  // DEMO MODE: development only, and only with ?demo=1. Never enabled in a production build.
  let demo: DemoOptions | null = null;
  if (process.env.NODE_ENV !== "production" && one("demo") === "1") {
    const fail = FAILS.find((f) => f === one("fail"));
    demo = { fail, standalone: one("standalone") === "1" };
  }
  return <TalkScreen startInSafari={one("mode") === "safari"} demo={demo} />;
}
