import type { NextConfig } from "next";

// Security headers (audit docs/audit-security.md, M5).
//
// The CSP is sent as Content-Security-Policy-REPORT-ONLY: browsers log violations (to the console and to
// /api/csp-report, which writes them to the server log) but block nothing, so a mistake here cannot break the app.
// Plan to enforce it: leave it in report-only for about a week of real use (Conversation mode in Safari and the
// Home Screen app, push, file downloads, Learn audio, admin console), read the "CSP report" lines in the Vercel logs,
// fix or allow each legitimate one, then rename the header key below to "Content-Security-Policy". If the report
// stays quiet, a later step is to drop 'unsafe-inline' from script-src with per-request nonces (see
// node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md).
//
// Why each source is there:
//  - script-src 'unsafe-inline': Next's own inline bootstrap/flight scripts and the inline service-worker
//    registration in app/(app)/layout.tsx. No nonce yet. 'unsafe-eval' only in development (React debugging).
//  - style-src 'unsafe-inline': Next and Tailwind inject styles, and components use style={}.
//  - connect-src Supabase https + wss: browser calls to Auth, PostgREST and Storage (and Realtime if ever used).
//    Groq and DeepL are called from the server only, so they are not listed. Google Translate and Apple Maps are
//    plain links (navigation), not fetches.
//  - worker-src 'self' blob: and script-src 'self': /sw.js, and the audio worklets (/worklets/capture.js,
//    /speech/pcm-tap.js) which are loaded with audioWorklet.addModule (governed by script-src).
//  - media-src 'self' blob: data: and img-src blob: data: : recorded and synthesised audio played from blob: URLs.
const SUPABASE = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  .trim()
  .replace(/\/(rest|auth|storage|functions)\/v1.*$/, "")
  .replace(/\/+$/, "");
const isDev = process.env.NODE_ENV !== "production";

const supabaseConnect = /^https:\/\//.test(SUPABASE) ? `${SUPABASE} ${SUPABASE.replace(/^https/, "wss")}` : "";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data:${/^https:\/\//.test(SUPABASE) ? ` ${SUPABASE}` : ""}`,
  "media-src 'self' blob: data:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseConnect}${isDev ? " ws://localhost:* ws://127.0.0.1:* http://localhost:* http://127.0.0.1:*" : ""}`.replace(/\s+/g, " ").trim(),
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "report-uri /api/csp-report",
].join("; ");

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy-Report-Only", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Conversation mode and the pronunciation tools need the microphone on this site; nothing else is used.
          { key: "Permissions-Policy", value: "microphone=(self), camera=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), browsing-topics=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000" },
        ],
      },
    ];
  },
};

export default nextConfig;
