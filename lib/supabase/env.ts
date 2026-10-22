// Tolerates a pasted Project URL with a trailing slash or an API path (e.g. ".../rest/v1/"), which Supabase rejects
// with "Invalid path specified in request URL".
export const SUPABASE_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")
  .trim()
  .replace(/\/(rest|auth|storage|functions)\/v1.*$/, "")
  .replace(/\/+$/, "");
export const SUPABASE_ANON_KEY = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
