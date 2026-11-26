// Receives Content-Security-Policy-Report-Only violation reports (see next.config.ts) and writes one short line per
// report to the server log. Nothing is stored. Public on purpose (proxy.ts), so the size is capped hard.

export async function POST(request: Request) {
  try {
    const raw = (await request.text()).slice(0, 4000);
    console.warn("CSP report", raw.replace(/\s+/g, " "));
  } catch { /* ignore malformed reports */ }
  return new Response(null, { status: 204 });
}
