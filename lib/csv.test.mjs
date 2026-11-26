// Unit tests for lib/csv.ts. Run: npm run test:csv  (node --experimental-strip-types lib/csv.test.mjs)
import assert from "node:assert/strict";
import { csvCell, csvLine, toCsv, rosterRows, todoRows, BOM, ROSTER_HEADER } from "./csv.ts";

// plain, quoting
assert.equal(csvCell("Anna"), "Anna");
assert.equal(csvCell(null), "");
assert.equal(csvCell(undefined), "");
assert.equal(csvCell(7), "7");
assert.equal(csvCell(0), "0");
assert.equal(csvCell(true), "yes");
assert.equal(csvCell(false), "no");
assert.equal(csvCell("a,b"), '"a,b"');
assert.equal(csvCell('say "hi"'), '"say ""hi"""');
assert.equal(csvCell("two\nlines"), '"two\nlines"');
assert.equal(csvCell("Zoë, François"), '"Zoë, François"', "accents survive");

// formula injection: every dangerous first character gets a single quote
for (const bad of ["=1+1", "+33 6 12", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd", '=HYPERLINK("http://x","y")']) {
  assert.ok(csvCell(bad).replace(/^"/, "").startsWith("'"), JSON.stringify(bad));
}
assert.equal(csvCell("=1+1"), "'=1+1");
assert.equal(csvCell('=HYPERLINK("http://x","y")'), `"'=HYPERLINK(""http://x"",""y"")"`, "quoted AND neutralised");
assert.equal(csvCell("a=b"), "a=b", "only the first character matters");
assert.equal(csvCell(" =1"), " =1", "a leading space is not a formula start");
assert.equal(csvCell("\r\n=1"), `"'\r\n=1"`);
assert.equal(csvCell(Infinity), "");
assert.equal(csvCell(NaN), "");

// lines and files
assert.equal(csvLine(["a", "b,c", 3]), 'a,"b,c",3');
assert.equal(toCsv([["x"], ["y"]]), "x\r\ny\r\n");
assert.equal(BOM, "﻿");

// roster
const people = [
  { id: "1", name: "=Evil", email: "e@x.org", team: "Blue", role: "member", status: "approved", emergency_name: "Mom, Jane", emergency_phone: "+1 555 0100", medical_notes: "peanuts", privacy_ack_at: "2026-01-01T00:00:00Z" },
  { id: "2", name: "Zoë", email: "z@x.org", team: null, role: "admin", status: "approved" },
];
const todos = [{ id: "t1", title: "Passport", due_date: "2027-01-10", requires_upload: true }, { id: "t2", title: "Waiver", due_date: "2027-01-20" }];
const asg = [
  { todo_id: "t1", user_id: "1", completed_at: "2026-12-01T00:00:00Z", upload_path: "1/t1" },
  { todo_id: "t2", user_id: "1", completed_at: null },
  { todo_id: "t1", user_id: "2", completed_at: null },
  { todo_id: "gone", user_id: "2", completed_at: null }, // retired to-do: not counted
];
const r = rosterRows(people, todos, asg, new Set(["1"]));
assert.deepEqual(r[0], [...ROSTER_HEADER]);
assert.equal(r.length, 3);
assert.deepEqual(r[1].slice(9), ["yes", "yes", 1, 2]);
assert.deepEqual(r[2].slice(9), ["no", "no", 0, 1]);
const csv = toCsv(r);
assert.ok(csv.includes("'=Evil,"), "name neutralised");
assert.ok(csv.includes('"Mom, Jane"'));
assert.ok(csv.includes("'+1 555 0100"), "phone starting with + is neutralised too");
assert.equal(rosterRows(people, todos, asg, null)[1][10], "", "unknown notification status stays empty");

// to-dos: one row per person per assigned live to-do, sorted by name then to-do order
const t = todoRows(people, todos, asg);
assert.equal(t.length, 1 + 3);
assert.deepEqual(t[1].slice(3, 6), ["Passport", "2027-01-10", "yes"]);
assert.equal(t[1][8], "yes");
assert.deepEqual(t[2].slice(3, 6), ["Waiver", "2027-01-20", "no"]);
assert.equal(t[3][0], "Zoë");
assert.ok(toCsv(t).startsWith("name,email,team,todo"));

console.log("csv tests passed");
