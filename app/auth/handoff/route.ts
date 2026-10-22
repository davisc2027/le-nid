import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/talk/safe-next";

// Opens a Safari hand-off link from /api/handoff: verifies the single-use token with the cookie-based client so the
// session cookies land in Safari, then continues to `next`. proxy.ts lets /auth paths through without a session.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("th");
  const next = safeNextPath(searchParams.get("next"));
  if (tokenHash) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    // Safari can preload a pasted address before Go is tapped, which uses the token up but still sets the cookies
    // in Safari. If this browser is signed in now, carry on.
    const { data: { user } } = await supabase.auth.getUser();
    if (user) return NextResponse.redirect(`${origin}${next}`);
  }
  return NextResponse.redirect(`${origin}/auth/handoff/expired`);
}
