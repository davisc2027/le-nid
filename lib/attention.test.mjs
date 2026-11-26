// Unit tests for lib/attention.ts. Run: npm run test:attention  (node --experimental-strip-types lib/attention.test.mjs)
import assert from "node:assert/strict";
import { computeAttention, parisToday, reminderBody, throttleMinutes } from "./attention.ts";

const today = "2027-02-10";
const person = (id, name, status = "approved") => ({ id, name, email: `${id}@x.org`, status });
const todos = [
  { id: "a", title: "Passport", due_date: "2027-02-01" },
  { id: "b", title: "Waiver", due_date: "2027-02-05" },
  { id: "c", title: "Packing list", due_date: "2027-03-01" },
];
const done = "2027-01-01T00:00:00Z";
const good = { emergency_name: "Mom", emergency_phone: "+1 555", privacy_ack_at: done };

// everyone fine -> empty
let r = computeAttention({
  people: [person("1", "Anna")], todos,
  assignments: todos.map((t) => ({ todo_id: t.id, user_id: "1", completed_at: done })),
  pushOn: new Set(["1"]), extras: new Map([["1", good]]), today,
});
assert.deepEqual(r, []);

// ordering and chips
const people = [person("1", "Anna"), person("2", "Ben"), person("3", "Cleo"), person("4", "Dan", "pending"), person("5", "Eve", "rejected"), person("6", "Finn")];
const assignments = [
  { todo_id: "a", user_id: "2", completed_at: null }, { todo_id: "b", user_id: "2", completed_at: null }, { todo_id: "c", user_id: "2", completed_at: null },
  { todo_id: "c", user_id: "3", completed_at: null },
  { todo_id: "a", user_id: "6", completed_at: null },
];
r = computeAttention({
  people, todos, assignments,
  pushOn: new Set(["1", "2"]),
  extras: new Map([["1", good], ["2", good], ["3", { emergency_name: "Dad", emergency_phone: " " , privacy_ack_at: null }], ["6", good]]),
  today,
});
assert.deepEqual(r.map((x) => x.name), ["Ben", "Cleo", "Finn", "Dan"]);
const ben = r[0];
assert.equal(ben.overdue.count, 2);
assert.equal(ben.overdue.first, "Passport", "earliest overdue title");
assert.equal(ben.open, 3);
assert.equal(ben.score, 3 + 2);
const cleo = r[1];
assert.equal(cleo.notificationsOff, true);
assert.equal(cleo.privacyMissing, true);
assert.equal(cleo.noEmergency, true, "a name without a phone is not an emergency contact");
assert.equal(cleo.overdue.count, 0);
assert.equal(r[2].name, "Finn");
assert.equal(r[2].notificationsOff, true);
assert.equal(r[3].notApproved, true);
assert.ok(!r.some((x) => x.name === "Eve" || x.name === "Anna"), "denied and fine people are left out");

// unknown data: chips are skipped rather than flagged for everyone
r = computeAttention({ people: [person("1", "Anna")], todos, assignments: [], pushOn: null, extras: null, today });
assert.deepEqual(r, []);

// due today is not overdue; retired (missing) to-dos are ignored
r = computeAttention({ people: [person("1", "Anna")], todos: [{ id: "a", title: "Today", due_date: today }], assignments: [{ todo_id: "a", user_id: "1", completed_at: null }, { todo_id: "zzz", user_id: "1", completed_at: null }], pushOn: null, extras: null, today });
assert.equal(r[0].overdue.count, 0);
assert.equal(r[0].open, 1);

// tie-break: equal score -> more overdue first -> name
r = computeAttention({
  people: [person("1", "Zed"), person("2", "Amy")], todos,
  assignments: [{ todo_id: "a", user_id: "1", completed_at: null }, { todo_id: "c", user_id: "2", completed_at: null }, { todo_id: "c", user_id: "1", completed_at: null }],
  pushOn: null, extras: null, today,
});
assert.deepEqual(r.map((x) => x.name), ["Zed", "Amy"]);

// Paris date
assert.equal(parisToday(new Date("2027-03-01T23:30:00Z")), "2027-03-02");
assert.equal(parisToday(new Date("2027-07-01T21:59:00Z")), "2027-07-01");

// reminder text and throttle
assert.equal(reminderBody([], today), "");
assert.equal(reminderBody([{ title: "Passport", due_date: "2027-02-01" }], today), "Passport (was due 2027-02-01). Tap to finish.");
assert.equal(reminderBody([{ title: "B", due_date: "2027-03-01" }, { title: "A", due_date: "2027-02-20" }], today), "2 to-dos are open. First up: A (due 2027-02-20). Tap to finish.");
assert.ok(reminderBody([{ title: "x".repeat(300), due_date: "2027-03-01" }], today).length <= 140);
assert.equal(throttleMinutes(null, 1000), 0);
assert.equal(throttleMinutes(0, 59 * 60_000), 1);
assert.equal(throttleMinutes(0, 60 * 60_000), 0);
assert.equal(throttleMinutes(0, 10 * 60_000), 50);

console.log("attention tests passed");
