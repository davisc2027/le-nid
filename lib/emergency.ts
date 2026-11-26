// Emergency screen content: the shipped defaults (content/emergency/defaults.json) with the admin's saved edits laid
// over them (app_content row "emergency"), plus strict validation of what an admin saves. Pure functions with no
// imports, so node can run the tests directly (npm run test:emergency). Same approach as lib/gospel.ts.

export const SLUG = "emergency";

export const GROUPS = [
  { id: "leaders", title: "Leaders", hint: "Name | role or note | phone" },
  { id: "staying", title: "Where we are staying", hint: "Place | address | phone | map link" },
  { id: "meeting", title: "Meeting point if we get separated", hint: "Place | how to find it | phone | map link" },
  { id: "embassy", title: "Embassy or consulate", hint: "Name | address or note | phone | map link" },
  { id: "insurance", title: "Insurance", hint: "Name | policy number or note | 24-hour phone" },
  { id: "notes", title: "Notes", hint: "Heading | text" },
] as const;
export type GroupId = (typeof GROUPS)[number]["id"];
export const GROUP_IDS = GROUPS.map((g) => g.id) as GroupId[];

export type Item = { label: string; value: string; phone: string; map: string };
export type EmergencyContent = Record<GroupId, Item[]>;

export const LIMITS = { label: 60, value: 200, phone: 24, map: 500, items: 10 } as const;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const isGroup = (k: string): k is GroupId => (GROUP_IDS as string[]).includes(k);

/** A phone number as typed (digits, spaces, + ( ) . -), or null when it does not look like one. Empty is allowed (""). */
export function cleanPhone(raw: string): string | null {
  const p = raw.trim();
  if (!p) return "";
  if (p.length > LIMITS.phone || !/^\+?[0-9 ().-]+$/.test(p)) return null;
  const digits = p.replace(/\D/g, "").length;
  return digits >= 2 && digits <= 15 ? p : null;
}

/** A web link (https://...), "" when empty, null when it is not a normal web address. Only http(s) is ever allowed. */
export function cleanMap(raw: string): string | null {
  const m = raw.trim();
  if (!m) return "";
  if (m.length > LIMITS.map) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(m) ? m : `https://${m}`;
  try {
    const u = new URL(withScheme);
    return (u.protocol === "https:" || u.protocol === "http:") && u.hostname.includes(".") ? u.href : null;
  } catch { return null; }
}

/** The tel: link for a phone number typed any way ("+33 3 88 00 00 00" -> "tel:+33388000000"). */
export function telHref(phone: string): string {
  return `tel:${phone.trim().startsWith("+") ? "+" : ""}${phone.replace(/\D/g, "")}`;
}

/** One stored item, repaired or dropped (never throws). Used when reading what is in the database. */
function readItem(v: unknown): Item | null {
  if (!isObj(v)) return null;
  const label = s(v.label), value = s(v.value);
  const phone = cleanPhone(s(v.phone)), map = cleanMap(s(v.map));
  if (!label || label.length > LIMITS.label || value.length > LIMITS.value || phone === null || map === null) return null;
  if (!value && !phone && !map) return null;
  return { label, value, phone, map };
}

/** Shipped defaults with the admin's saved groups laid over them. Garbage or a missing override changes nothing. */
export function mergeEmergency(defaults: EmergencyContent, override: unknown): EmergencyContent {
  const o = isObj(override) ? override : {};
  const out = {} as EmergencyContent;
  for (const id of GROUP_IDS) {
    const ov = o[id];
    if (!Array.isArray(ov)) { out[id] = defaults[id]; continue; }
    const good = ov.slice(0, LIMITS.items).map(readItem).filter((x): x is Item => x !== null);
    // An empty list is the admin clearing the group on purpose. A non-empty list of junk falls back to the defaults.
    out[id] = good.length > 0 || ov.length === 0 ? good : defaults[id];
  }
  return out;
}

// ---- the editor's text format: one line per item, "Label | value | optional phone | optional map link" -------------

export const itemToLine = (i: Item) => [i.label, i.value, i.phone, i.map].join(" | ").replace(/( \| )+$/, "");
export const itemsToText = (items: Item[]) => items.map(itemToLine).join("\n");

/** Parses one group's textarea. Throws an Error naming the group and line when anything is off. */
export function parseLines(text: string, groupTitle: string): Item[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > LIMITS.items) throw new Error(`${groupTitle}: at most ${LIMITS.items} lines`);
  return lines.map((line, n) => {
    const where = `${groupTitle}, line ${n + 1}`;
    const parts = line.split("|").map((p) => p.trim());
    if (parts.length > 4) throw new Error(`${where}: use at most 3 | separators (Label | value | phone | map link). A | can't be part of the text.`);
    const [label = "", value = "", phoneRaw = "", mapRaw = ""] = parts;
    if (!label) throw new Error(`${where}: start with a label, then |`);
    if (label.length > LIMITS.label) throw new Error(`${where}: the label is ${label.length} characters, the limit is ${LIMITS.label}`);
    if (value.length > LIMITS.value) throw new Error(`${where}: the text is ${value.length} characters, the limit is ${LIMITS.value}`);
    const phone = cleanPhone(phoneRaw);
    if (phone === null) throw new Error(`${where}: the phone number does not look right (use digits, spaces, + ( ) - only)`);
    const map = cleanMap(mapRaw);
    if (map === null) throw new Error(`${where}: the map link is not a normal web address (it should start with https://)`);
    if (!value && !phone && !map) throw new Error(`${where}: add some text, a phone number or a map link after the label`);
    return { label, value, phone, map };
  });
}

/** Validates a whole form (group id -> textarea text). Unknown groups are refused. */
export function checkForm(form: Record<string, unknown>): EmergencyContent {
  const out = {} as EmergencyContent;
  for (const k of Object.keys(form)) if (!isGroup(k)) throw new Error("Unknown group");
  for (const g of GROUPS) {
    const raw = form[g.id];
    if (typeof raw !== "string") throw new Error(`${g.title}: missing`);
    if (raw.length > 4000) throw new Error(`${g.title}: that is too much text`);
    out[g.id] = parseLines(raw, g.title);
  }
  return out;
}

/** What to store: only the groups that differ from the shipped defaults (so a later change to the defaults still shows). */
export function overrideOf(defaults: EmergencyContent, checked: EmergencyContent): Partial<EmergencyContent> {
  const out: Partial<EmergencyContent> = {};
  for (const id of GROUP_IDS) if (JSON.stringify(checked[id]) !== JSON.stringify(defaults[id])) out[id] = checked[id];
  return out;
}
