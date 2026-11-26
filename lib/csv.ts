// CSV export helpers for the admin roster and to-do status. Pure functions (no imports) so node can test them
// directly (npm run test:csv). Every text cell is protected against spreadsheet formula injection: a person could type
// "=HYPERLINK(...)" as their name or notes, and Excel or Sheets would run it when a leader opens the export.

export type Cell = string | number | boolean | null | undefined;

/** First characters a spreadsheet may read as the start of a formula (OWASP list: = + - @ tab, carriage return). */
const FORMULA_START = /^[=+\-@\t\r]/;

/** One CSV cell: formula-safe, quoted when it holds a comma, quote or line break. Finite numbers are written as they are. */
export function csvCell(v: Cell): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  let s = String(v);
  if (FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const csvLine = (cells: Cell[]) => cells.map(csvCell).join(",");

/** The whole file as lines (CRLF between them, as Excel expects). The caller adds the UTF-8 byte order mark. */
export const toCsv = (rows: Cell[][]) => rows.map(csvLine).join("\r\n") + "\r\n";

export const BOM = "﻿";

export const ROSTER_HEADER = [
  "name", "email", "team", "role", "status", "emergency_name", "emergency_phone", "emergency_relation", "medical_notes",
  "privacy_accepted", "notifications_on", "todos_done", "todos_total",
] as const;

export type RosterPerson = {
  id: string; name: string | null; email: string | null; team: string | null; role: string | null; status: string | null;
  emergency_name?: string | null; emergency_phone?: string | null; emergency_relation?: string | null; medical_notes?: string | null;
  privacy_ack_at?: string | null;
};
export type TodoLite = { id: string; title: string; due_date: string; requires_upload?: boolean };
export type AssignmentLite = { todo_id: string; user_id: string; completed_at: string | null; upload_path?: string | null };

/** Roster rows. `pushOn` is null when notification status could not be read (the column is then left empty). */
export function rosterRows(people: RosterPerson[], todos: TodoLite[], assignments: AssignmentLite[], pushOn: Set<string> | null): Cell[][] {
  const live = new Set(todos.map((t) => t.id));
  const done = new Map<string, number>(), total = new Map<string, number>();
  for (const a of assignments) {
    if (!live.has(a.todo_id)) continue;
    total.set(a.user_id, (total.get(a.user_id) ?? 0) + 1);
    if (a.completed_at) done.set(a.user_id, (done.get(a.user_id) ?? 0) + 1);
  }
  return [
    [...ROSTER_HEADER],
    ...people.map((p) => [
      p.name, p.email, p.team, p.role, p.status, p.emergency_name, p.emergency_phone, p.emergency_relation, p.medical_notes,
      p.privacy_ack_at ? "yes" : "no", pushOn ? (pushOn.has(p.id) ? "yes" : "no") : "",
      done.get(p.id) ?? 0, total.get(p.id) ?? 0,
    ]),
  ];
}

export const TODO_HEADER = ["name", "email", "team", "todo", "due_date", "completed", "completed_at", "upload_required", "uploaded"] as const;

/** One row per person per to-do they are assigned. */
export function todoRows(people: RosterPerson[], todos: TodoLite[], assignments: AssignmentLite[]): Cell[][] {
  const byId = new Map(people.map((p) => [p.id, p]));
  const order = new Map(todos.map((t, i) => [t.id, i]));
  const rows = assignments
    .filter((a) => order.has(a.todo_id) && byId.has(a.user_id))
    .sort((a, b) => (byId.get(a.user_id)!.name ?? "").localeCompare(byId.get(b.user_id)!.name ?? "") || order.get(a.todo_id)! - order.get(b.todo_id)!);
  const tById = new Map(todos.map((t) => [t.id, t]));
  return [
    [...TODO_HEADER],
    ...rows.map((a) => {
      const p = byId.get(a.user_id)!, t = tById.get(a.todo_id)!;
      return [p.name, p.email, p.team, t.title, t.due_date, a.completed_at ? "yes" : "no", a.completed_at ?? "", t.requires_upload ? "yes" : "no", a.upload_path ? "yes" : "no"];
    }),
  ];
}
