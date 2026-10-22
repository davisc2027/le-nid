import { createServiceClient } from "@/lib/supabase/server";
import { requireApprovedUser } from "@/lib/talk/server-auth";
import { createRateLimiter } from "@/lib/talk/rate-limit";
import { DEFAULT_HANDOFF_NEXT, safeNextPath } from "@/lib/talk/safe-next";
import { HANDOFF_PER_HOUR } from "@/lib/talk/api";

// Makes a single-use sign-in link so Safari (which does not share the Home Screen app's login) opens Conversation
// mode already signed in as the same person. The email always comes from the session, never from the request.

const limiter = createRateLimiter([{ ms: 3_600_000, max: HANDOFF_PER_HOUR }]);

function originOf(request: Request): string {
  const h = request.headers;
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim();
  if (!/^[a-z0-9.-]+(:\d{1,5})?$/i.test(host)) return new URL(request.url).origin;
  const fwd = h.get("x-forwarded-proto")?.split(",")[0].trim();
  const proto = fwd === "http" || fwd === "https" ? fwd : /^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https";
  return `${proto}://${host}`;
}

export async function POST(request: Request) {
  const auth = await requireApprovedUser();
  if ("response" in auth) return auth.response;
  const { user } = auth;
  if (!user.email) return Response.json({ error: "no_email", message: "Your account has no email address." }, { status: 400 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return Response.json({ error: "not_configured", message: "Safari links aren't set up yet." }, { status: 503 });

  const r = limiter.hit(user.id);
  if (!r.ok) return Response.json({ error: "rate_limited", message: "You've made several Safari links already. Use the last one, or try again later.", retryAfter: r.retryAfterSec }, { status: 429, headers: { "Retry-After": String(r.retryAfterSec) } });

  let next = DEFAULT_HANDOFF_NEXT;
  try {
    const body = (await request.json()) as { next?: unknown };
    next = safeNextPath(body?.next);
  } catch { /* no body: use the default */ }

  const { data, error } = await createServiceClient().auth.admin.generateLink({ type: "magiclink", email: user.email });
  const hashed = data?.properties?.hashed_token;
  if (error || !hashed) return Response.json({ error: "upstream_error", message: "Couldn't make a Safari link. Try again." }, { status: 502 });

  const url = `${originOf(request)}/auth/handoff?th=${encodeURIComponent(hashed)}&next=${encodeURIComponent(next)}`;
  return Response.json({ url }, { headers: { "Cache-Control": "no-store" } });
}
