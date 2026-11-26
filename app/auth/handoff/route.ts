import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/talk/safe-next";
import { isSameOriginPost } from "@/lib/handoff-guard";

// Safari hand-off link from /api/handoff. Signing in is a state change, so it only happens on POST (from the
// confirmation page at /auth/handoff/continue). GET never signs anyone in and never uses the token up, which keeps
// link-preview bots (iMessage, WhatsApp, Slack, Safari pre-fetch) harmless and stops a link from signing a browser
// in as somebody else just by being opened (login CSRF). proxy.ts lets /auth paths through without a session.

/** Old and new links both arrive here: send them to the confirmation page, token still unused. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const to = new URL("/auth/handoff/continue", origin);
  const th = searchParams.get("th");
  if (th) to.searchParams.set("th", th);
  to.searchParams.set("next", safeNextPath(searchParams.get("next")));
  return NextResponse.redirect(to, 303);
}

export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  if (!isSameOriginPost(request.headers)) return new NextResponse("Cross-site request refused", { status: 403 });
  const form = await request.formData().catch(() => null);
  const tokenHash = form?.get("th");
  const next = safeNextPath(form?.get("next"));
  if (typeof tokenHash === "string" && tokenHash && tokenHash.length < 512) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    if (!error) return NextResponse.redirect(`${origin}${next}`, 303);
    // A double tap can use the token up on the first request and still sign this browser in. If it is signed in now, carry on.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return NextResponse.redirect(`${origin}${next}`, 303);
  }
  return NextResponse.redirect(`${origin}/auth/handoff/expired`, 303);
}
