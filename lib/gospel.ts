// Three Circles content: shape, limits, merge of the shipped defaults with the admin's saved overrides, and strict
// validation of what an admin saves. Pure functions, no imports, so node can run the tests directly
// (npm run test:gospel) and the same limits drive the editor, the server action and scripts/check-gospel.mjs.

export type Lang = "en" | "fr";
export const LANGS: Lang[] = ["en", "fr"];
export type Bi = { en: string; fr: string };

export const STEP_IDS = ["start", "design", "brokenness", "gospel", "believe", "recover"] as const;
export type StepId = (typeof STEP_IDS)[number];

export type Step = { title: Bi; say: Bi; key: Bi; verses: string[] };
export type Word = Bi & { step: StepId };
export type GospelContent = {
  title: Bi;
  intro: Bi;
  circles: { design: Bi; brokenness: Bi; gospel: Bi };
  arrows: { believe: Bi; recover: Bi };
  steps: Record<StepId, Step>;
  words: Word[];
  openers: Bi[];
  listening: Bi[];
  closing: Bi[];
};

export const SLUG = "three-circles";

/** Character limits. Circle and arrow labels have to fit inside the drawing. */
export const LIMITS = {
  title: 40, intro: 200, circle: 24, arrow: 24, stepTitle: 40, say: 320, key: 120,
  verses: 3, word: 60, words: 60, opener: 160, openers: 6, listening: 120, listeningN: 8, closing: 160, closingN: 4,
} as const;

type Node =
  | { kind: "obj"; children: Record<string, Node> }
  | { kind: "bi"; max: number; label: string }
  | { kind: "verses" }
  | { kind: "words" }
  | { kind: "pairs"; max: number; maxItems: number; label: string };

const bi = (max: number, label: string): Node => ({ kind: "bi", max, label });
const step = (id: string): Node => ({
  kind: "obj",
  children: { title: bi(LIMITS.stepTitle, `${id} title`), say: bi(LIMITS.say, `${id} what to say`), key: bi(LIMITS.key, `${id} key sentence`), verses: { kind: "verses" } },
});

export const SCHEMA: Node = {
  kind: "obj",
  children: {
    title: bi(LIMITS.title, "Title"),
    intro: bi(LIMITS.intro, "Intro"),
    circles: {
      kind: "obj",
      children: { design: bi(LIMITS.circle, "Design circle"), brokenness: bi(LIMITS.circle, "Brokenness circle"), gospel: bi(LIMITS.circle, "Gospel circle") },
    },
    arrows: { kind: "obj", children: { believe: bi(LIMITS.arrow, "Repent and believe arrow"), recover: bi(LIMITS.arrow, "Recover and pursue arrow") } },
    steps: { kind: "obj", children: Object.fromEntries(STEP_IDS.map((id) => [id, step(id)])) },
    words: { kind: "words" },
    openers: { kind: "pairs", max: LIMITS.opener, maxItems: LIMITS.openers, label: "Openers" },
    listening: { kind: "pairs", max: LIMITS.listening, maxItems: LIMITS.listeningN, label: "Listening phrases" },
    closing: { kind: "pairs", max: LIMITS.closing, maxItems: LIMITS.closingN, label: "Closing questions" },
  },
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
const isStep = (v: unknown): v is StepId => typeof v === "string" && (STEP_IDS as readonly string[]).includes(v);
const VERSE_KEY = /^\w{3} \d+:\d+(?:-\d+)?$/;

// ---- reading (lenient: never throws, bad pieces fall back to the shipped text) --------------------------------

function mergeNode(node: Node, base: unknown, ov: unknown): unknown {
  if (node.kind === "obj") {
    const b = isObj(base) ? base : {};
    const o = isObj(ov) ? ov : {};
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(node.children)) out[k] = mergeNode(node.children[k], b[k], o[k]);
    return out;
  }
  if (node.kind === "bi") {
    const b = isObj(base) ? base : {};
    const o = isObj(ov) ? ov : {};
    return { en: str(o.en) ?? b.en ?? "", fr: str(o.fr) ?? b.fr ?? "" };
  }
  if (node.kind === "verses") {
    if (!Array.isArray(ov)) return base;
    return ov.filter((x): x is string => typeof x === "string" && VERSE_KEY.test(x));
  }
  if (!Array.isArray(ov)) return base;
  const good = ov.flatMap((x) => {
    if (!isObj(x)) return [];
    const en = str(x.en), fr = str(x.fr);
    if (!en || !fr) return [];
    if (node.kind === "words") return isStep(x.step) ? [{ fr, en, step: x.step }] : [];
    return [{ fr, en }];
  });
  return good.length > 0 || ov.length === 0 ? good : base;
}

/** Shipped defaults with the admin's saved overrides laid over them. Garbage or a missing override changes nothing. */
export function mergeGospel(defaults: GospelContent, override: unknown): GospelContent {
  return mergeNode(SCHEMA, defaults, override) as GospelContent;
}

// ---- writing (strict) ------------------------------------------------------------------------------------------

export type PatchInput = { data?: unknown; reviewed?: unknown; reset?: unknown };
export type Checked = { data: Record<string, unknown>; reviewed?: boolean; reset: string[] };
type Opts = { parseVerse: (s: string) => string | null };

function checkNode(node: Node, v: unknown, path: string, opts: Opts): unknown {
  if (node.kind === "obj") {
    if (!isObj(v)) throw new Error(`Bad shape at ${path || "content"}`);
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v)) {
      const child = node.children[k];
      if (!child) throw new Error(`Unknown field ${path ? path + "." : ""}${k}`);
      out[k] = checkNode(child, v[k], path ? `${path}.${k}` : k, opts);
    }
    return out;
  }
  if (node.kind === "bi") return checkBi(node, v);
  if (node.kind === "verses") {
    if (!Array.isArray(v) || v.length > LIMITS.verses) throw new Error(`Use at most ${LIMITS.verses} verses`);
    return v.map((x) => {
      const raw = typeof x === "string" ? x.trim() : "";
      const key = raw && (VERSE_KEY.test(raw) ? raw : opts.parseVerse(raw));
      if (!key) throw new Error(`I do not recognise the verse "${raw}". Try a form like Romans 3:23 or Romains 3:23`);
      return key;
    });
  }
  if (!Array.isArray(v)) throw new Error("Bad list");
  if (node.kind === "words") {
    if (v.length < 1 || v.length > LIMITS.words) throw new Error(`Keep between 1 and ${LIMITS.words} words`);
    return v.map((x, i) => {
      if (!isObj(x) || !isStep(x.step)) throw new Error(`Word ${i + 1}: pick a step`);
      const fr = str(x.fr), en = str(x.en);
      if (!fr || !en) throw new Error(`Word ${i + 1}: both French and English are needed`);
      if (fr.length > LIMITS.word || en.length > LIMITS.word) throw new Error(`Word ${i + 1}: at most ${LIMITS.word} characters`);
      return { fr, en, step: x.step };
    });
  }
  if (v.length < 1 || v.length > node.maxItems) throw new Error(`${node.label}: keep between 1 and ${node.maxItems}`);
  return v.map((x, i) => checkBi({ ...node, label: `${node.label} ${i + 1}` }, x));
}

function checkBi(node: { max: number; label: string }, v: unknown): Bi {
  if (!isObj(v)) throw new Error(`${node.label}: bad value`);
  const out = {} as Bi;
  for (const l of LANGS) {
    const s = str(v[l]);
    if (!s) throw new Error(`${node.label}: the ${l === "en" ? "English" : "French"} text is empty`);
    if (s.length > node.max) throw new Error(`${node.label}: the ${l === "en" ? "English" : "French"} text is ${s.length} characters, the limit is ${node.max}`);
    out[l] = s;
  }
  return out;
}

function nodeAt(path: string): Node | null {
  let n: Node = SCHEMA;
  for (const part of path.split(".")) {
    if (n.kind !== "obj" || !n.children[part]) return null;
    n = n.children[part];
  }
  return n;
}

/** Validates an admin's patch. Throws an Error with a plain message when anything is off. */
export function checkPatch(input: PatchInput, opts: Opts): Checked {
  if (!isObj(input)) throw new Error("Bad request");
  const data = input.data === undefined ? {} : (checkNode(SCHEMA, input.data, "", opts) as Record<string, unknown>);
  if (input.reviewed !== undefined && typeof input.reviewed !== "boolean") throw new Error("Bad review flag");
  const reset = input.reset === undefined ? [] : input.reset;
  if (!Array.isArray(reset) || reset.length > 12 || reset.some((p) => typeof p !== "string" || !nodeAt(p))) throw new Error("Bad reset");
  return { data, reviewed: input.reviewed as boolean | undefined, reset: reset as string[] };
}

function setIn(target: Record<string, unknown>, patch: Record<string, unknown>) {
  for (const k of Object.keys(patch)) {
    const v = patch[k];
    if (isObj(v) && !("en" in v && "fr" in v)) {
      if (!isObj(target[k])) target[k] = {};
      setIn(target[k] as Record<string, unknown>, v);
    } else target[k] = v;
  }
}

/** The stored override after removing the reset paths and laying the validated patch over it. */
export function applyPatch(stored: unknown, checked: Checked): Record<string, unknown> {
  const out: Record<string, unknown> = isObj(stored) ? clone(stored) : {};
  for (const p of checked.reset) {
    const parts = p.split(".");
    let cur: unknown = out;
    for (let i = 0; i < parts.length - 1 && isObj(cur); i++) cur = cur[parts[i]];
    if (isObj(cur)) delete cur[parts[parts.length - 1]];
  }
  setIn(out, checked.data);
  return out;
}

// ---- checks used by scripts/check-gospel.mjs -------------------------------------------------------------------

/** Problems found in a full content object (empty strings, overlong text, missing parts). Empty array = fine. */
export function problems(c: unknown): string[] {
  const out: string[] = [];
  const walk = (node: Node, v: unknown, path: string) => {
    try {
      if (node.kind === "obj") {
        if (!isObj(v)) return void out.push(`${path || "content"}: missing`);
        for (const k of Object.keys(node.children)) walk(node.children[k], v[k], path ? `${path}.${k}` : k);
      } else if (node.kind === "verses") {
        if (!Array.isArray(v) || v.length > LIMITS.verses || v.some((x) => typeof x !== "string" || !VERSE_KEY.test(x))) out.push(`${path}: bad verse list`);
      } else checkNode(node, v, path, { parseVerse: () => null });
    } catch (e) {
      out.push(`${path}: ${e instanceof Error ? e.message : "invalid"}`);
    }
  };
  walk(SCHEMA, c, "");
  return out;
}
