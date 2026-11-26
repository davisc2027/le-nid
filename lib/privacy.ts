// Privacy notice: shipped wording (content/privacy.json) plus the admin's edits (app_content row "privacy"). Pure
// functions with no imports, so node can test them directly (npm run test:privacy). Same approach as lib/emergency.ts.

export const SLUG = "privacy";

export const SECTIONS = [
  { id: "summary", title: "Short summary (shown on the first-time consent screen)", max: 700 },
  { id: "collect", title: "What we collect", max: 2000 },
  { id: "why", title: "Why we collect it", max: 2000 },
  { id: "who", title: "Who can see what", max: 2000 },
  { id: "third", title: "Other services that handle your data", max: 2000 },
  { id: "retention", title: "How long we keep it", max: 2000 },
  { id: "rights", title: "Your rights", max: 2000 },
  { id: "contact", title: "Who to ask", max: 2000 },
] as const;
export type SectionId = (typeof SECTIONS)[number]["id"];
export const SECTION_IDS = SECTIONS.map((x) => x.id) as SectionId[];
export type PrivacyContent = Record<SectionId, string>;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const text = (v: unknown) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim() : "");

/** Shipped wording with the admin's saved sections laid over it. Empty, overlong or non-text values change nothing. */
export function mergePrivacy(defaults: PrivacyContent, override: unknown): PrivacyContent {
  const o = isObj(override) ? override : {};
  const out = {} as PrivacyContent;
  for (const sec of SECTIONS) {
    const v = text(o[sec.id]);
    out[sec.id] = v && v.length <= sec.max ? v : defaults[sec.id];
  }
  return out;
}

/** Validates the admin's form (section id -> text). Every section is required; unknown fields are refused. */
export function checkPrivacyForm(form: Record<string, unknown>): PrivacyContent {
  for (const k of Object.keys(form)) if (!SECTION_IDS.includes(k as SectionId)) throw new Error("Unknown section");
  const out = {} as PrivacyContent;
  for (const sec of SECTIONS) {
    const raw = form[sec.id];
    if (typeof raw !== "string") throw new Error(`${sec.title}: missing`);
    const v = text(raw);
    if (!v) throw new Error(`${sec.title}: can't be empty (use Reset to defaults to get the original wording back)`);
    if (v.length > sec.max) throw new Error(`${sec.title} is too long (${v.length} characters; the limit is ${sec.max}).`);
    out[sec.id] = v;
  }
  return out;
}

/** Only the sections that differ from the shipped wording are stored. */
export function overrideOf(defaults: PrivacyContent, checked: PrivacyContent): Partial<PrivacyContent> {
  const out: Partial<PrivacyContent> = {};
  for (const id of SECTION_IDS) if (checked[id] !== defaults[id]) out[id] = checked[id];
  return out;
}

/** Placeholders look like [REGION: ...]. The editor warns while any are left in the notice. */
export const placeholders = (c: PrivacyContent): string[] => SECTION_IDS.flatMap((id) => c[id].match(/\[[A-Z][A-Z ]*(?::[^\]]*)?\]/g) ?? []);

export type Block = { type: "p"; text: string } | { type: "ul"; items: string[] };

/** Plain text to blocks: lines starting with "- " become a bullet list, other lines paragraphs. */
export function toBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  for (const line of body.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const m = /^[-*•]\s+(.*)$/.exec(line);
    const last = blocks[blocks.length - 1];
    if (m) {
      if (last?.type === "ul") last.items.push(m[1]); else blocks.push({ type: "ul", items: [m[1]] });
    } else blocks.push({ type: "p", text: line });
  }
  return blocks;
}
