// "Needs attention" list for the Admin Overview: one row per person with what is still open, worst first. Pure
// functions (no imports) computed from data the Admin page already loads, so there are no per-person queries.
// Tested by lib/attention.test.mjs (npm run test:attention).

export type PersonIn = { id: string; name: string | null; email: string | null; status: string };
export type TodoIn = { id: string; title: string; due_date: string };
export type AssignmentIn = { todo_id: string; user_id: string; completed_at: string | null };
export type ExtrasIn = { emergency_name?: string | null; emergency_phone?: string | null; privacy_ack_at?: string | null };

export type Attention = {
  id: string;
  name: string;
  /** Open to-dos judged overdue on the Paris date, the earliest-due title first. */
  overdue: { count: number; first: string | null };
  open: number;
  notificationsOff: boolean;
  privacyMissing: boolean;
  noEmergency: boolean;
  notApproved: boolean;
  /** Sort key: each open to-do counts 1 (overdue ones count 2) and every other chip counts 1. */
  score: number;
};

/** Today's date in Paris as YYYY-MM-DD (the app judges "overdue" on the Paris calendar date). */
export function parisToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/**
 * pushOn: ids with notifications on, or null when that could not be read (the chip is then skipped).
 * extras: id -> emergency/privacy fields, or null when migration 0021 has not run (those chips are then skipped).
 * Pending people only get the "not approved yet" chip; denied people are left out.
 */
export function computeAttention(input: {
  people: PersonIn[]; todos: TodoIn[]; assignments: AssignmentIn[];
  pushOn: Set<string> | null; extras: Map<string, ExtrasIn> | null; today: string;
}): Attention[] {
  const { people, todos, assignments, pushOn, extras, today } = input;
  const todoById = new Map(todos.map((t) => [t.id, t]));
  const openBy = new Map<string, TodoIn[]>();
  for (const a of assignments) {
    const t = todoById.get(a.todo_id);
    if (!t || a.completed_at) continue;
    const list = openBy.get(a.user_id);
    if (list) list.push(t); else openBy.set(a.user_id, [t]);
  }
  const out: Attention[] = [];
  for (const p of people) {
    if (p.status !== "approved" && p.status !== "pending") continue;
    const name = p.name || p.email || "(no name)";
    if (p.status === "pending") {
      out.push({ id: p.id, name, overdue: { count: 0, first: null }, open: 0, notificationsOff: false, privacyMissing: false, noEmergency: false, notApproved: true, score: 1 });
      continue;
    }
    const open = (openBy.get(p.id) ?? []).slice().sort((a, b) => a.due_date.localeCompare(b.due_date) || a.title.localeCompare(b.title));
    const late = open.filter((t) => t.due_date < today);
    const x = extras?.get(p.id);
    const notificationsOff = pushOn ? !pushOn.has(p.id) : false;
    const privacyMissing = extras ? !x?.privacy_ack_at : false;
    const noEmergency = extras ? !(x?.emergency_name?.trim() && x?.emergency_phone?.trim()) : false;
    const score = open.length + late.length + Number(notificationsOff) + Number(privacyMissing) + Number(noEmergency);
    if (score === 0) continue;
    out.push({ id: p.id, name, overdue: { count: late.length, first: late[0]?.title ?? null }, open: open.length, notificationsOff, privacyMissing, noEmergency, notApproved: false, score });
  }
  return out.sort((a, b) => b.score - a.score || b.overdue.count - a.overdue.count || a.name.localeCompare(b.name));
}

/** The text of a reminder push for one person's open to-dos. */
export function reminderBody(open: { title: string; due_date: string }[], today: string): string {
  const sorted = open.slice().sort((a, b) => a.due_date.localeCompare(b.due_date));
  const first = sorted[0];
  if (!first) return "";
  const late = first.due_date < today;
  const lead = sorted.length === 1 ? `${first.title} (${late ? "was due" : "due"} ${first.due_date}).` : `${sorted.length} to-dos are open. First up: ${first.title} (${late ? "was due" : "due"} ${first.due_date}).`;
  return `${lead} Tap to finish.`.slice(0, 140);
}

/** Minutes left before another reminder is allowed, 0 when it may be sent. */
export function throttleMinutes(lastAt: number | null, now: number, windowMs = 3_600_000): number {
  if (lastAt === null) return 0;
  const left = windowMs - (now - lastAt);
  return left > 0 ? Math.ceil(left / 60_000) : 0;
}
