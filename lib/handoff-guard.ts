/**
 * True when a POST was made by a page on this same site. The hand-off POST signs a browser in, so a form on
 * another website must not be able to submit it. Browsers send Sec-Fetch-Site and/or Origin on form posts; with
 * neither header present the request is refused.
 */
export function isSameOriginPost(h: { get(name: string): string | null }): boolean {
  const site = h.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = h.get("origin");
  if (!origin) return false;
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(",")[0].trim().toLowerCase();
  try { return host !== "" && new URL(origin).host.toLowerCase() === host; } catch { return false; }
}
