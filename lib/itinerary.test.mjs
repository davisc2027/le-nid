// Unit tests for lib/itinerary.ts. Run: npm run test:itinerary
import assert from "node:assert/strict";
import {
  zonedInstant, localParts, fmt12, formatRange, itemWindow, buildDays, dayStatus, dayLabel, todayDayKey,
  anchorDay, nowAndNext, isRecentlyUpdated, addDays, dayChip, parseTime, offsetMs,
} from "./itinerary.ts";

const P = "Europe/Paris", C = "America/Chicago";
const Z = (s) => Date.parse(s);
const H = 3600_000;
let n = 0;
const it = (name, fn) => { fn(); n++; };
const item = (id, day, start, end, tz, extra = {}) => ({ id, day, start_time: start, end_time: end, title: id, location: null, map_url: null, notes: null, tz, ...extra });

it("offsets around the March 2027 DST changes", () => {
  assert.equal(offsetMs(Z("2027-03-13T18:00:00Z"), C), -6 * H); // CST
  assert.equal(offsetMs(Z("2027-03-14T08:00:00Z"), C), -5 * H); // CDT after 14 Mar
  assert.equal(offsetMs(Z("2027-03-13T12:00:00Z"), P), 1 * H); // CET
  assert.equal(offsetMs(Z("2027-03-27T12:00:00Z"), P), 1 * H);
  assert.equal(offsetMs(Z("2027-03-28T12:00:00Z"), P), 2 * H); // CEST after 28 Mar
});

it("zoned instants", () => {
  assert.equal(zonedInstant("2027-03-13", 12 * 60, C), Z("2027-03-13T18:00:00Z"));
  assert.equal(zonedInstant("2027-03-14", 12 * 60, C), Z("2027-03-14T17:00:00Z"));
  assert.equal(zonedInstant("2027-03-13", 12 * 60, P), Z("2027-03-13T11:00:00Z"));
  assert.equal(zonedInstant("2027-03-28", 12 * 60, P), Z("2027-03-28T10:00:00Z"));
  // spring-forward gap: 02:30 Chicago on 14 Mar does not exist; result is still a valid instant near 03:30 CDT / 01:30 CST
  const gap = zonedInstant("2027-03-14", 150, C);
  assert.ok(gap === Z("2027-03-14T07:30:00Z") || gap === Z("2027-03-14T08:30:00Z"));
  // midnight edges
  assert.equal(zonedInstant("2027-03-13", 0, P), Z("2027-03-12T23:00:00Z"));
  assert.equal(zonedInstant("2027-03-14", 0, C), Z("2027-03-14T06:00:00Z"));
  assert.equal(zonedInstant("nope", 0, P), null);
  assert.equal(zonedInstant("2027-02-30", 0, P), null);
});

it("local parts follow the zone, not the server", () => {
  const t = Z("2027-03-14T05:30:00Z"); // 11:30 pm CST on the 13th, 6:30 am Paris on the 14th
  assert.deepEqual(localParts(t, C), { date: "2027-03-13", minutes: 23 * 60 + 30 });
  assert.deepEqual(localParts(t, P), { date: "2027-03-14", minutes: 6 * 60 + 30 });
  assert.equal(addDays("2027-02-28", 1), "2027-03-01");
});

it("12-hour text", () => {
  assert.equal(fmt12(0), "12:00 AM");
  assert.equal(fmt12(12 * 60), "12:00 PM");
  assert.equal(fmt12(15 * 60), "3:00 PM");
  assert.equal(fmt12(23 * 60 + 59), "11:59 PM");
  assert.equal(formatRange("15:00:00", "17:00"), "3:00 PM – 5:00 PM");
  assert.equal(formatRange("07:30", null), "7:30 AM");
  assert.equal(formatRange(null, "10:00"), "All day");
  assert.equal(parseTime("24:00"), null);
  assert.equal(dayChip("2027-03-12"), "Fri 12");
});

it("windows: default 60 minutes, overnight, null start", () => {
  const a = itemWindow(item("a", "2027-03-13", "11:00", null, P));
  assert.equal(a.end - a.start, H);
  const b = itemWindow(item("b", "2027-03-13", "23:00", "01:00", P));
  assert.equal(b.end - b.start, 2 * H);
  const c = itemWindow(item("c", "2027-03-13", "10:00", "10:00", P));
  assert.equal(c.end - c.start, H);
  assert.deepEqual(itemWindow(item("d", "2027-03-13", null, "10:00", P)), { start: null, end: null });
  // an item spanning the Paris DST jump is 1 real hour shorter than its wall time
  const e = itemWindow(item("e", "2027-03-28", "01:00", "04:00", P));
  assert.equal(e.end - e.start, 2 * H);
});

const days = () => buildDays([
  item("fly", "2027-03-12", "07:30", "09:00", C),
  item("allday", "2027-03-13", null, null, P),
  item("walk", "2027-03-13", "15:00", "17:00", P),
  item("arrive", "2027-03-13", "08:45", "10:00", P),
  item("rest", "2027-03-13", "11:00", null, P),
  item("service", "2027-03-14", "10:00", "12:00", P),
]);

it("sorting: all-day last, days ascending, Day N", () => {
  const d = days();
  assert.deepEqual(d.map((x) => x.day), ["2027-03-12", "2027-03-13", "2027-03-14"]);
  assert.deepEqual(d[1].items.map((x) => x.id), ["arrive", "rest", "walk", "allday"]);
  assert.deepEqual(d.map((x) => x.index), [1, 2, 3]);
  assert.equal(d[0].tz, C);
  assert.equal(d[1].tz, P);
});

it("day status, labels, anchor around the trip", () => {
  const d = days();
  const before = Z("2027-02-01T12:00:00Z");
  assert.deepEqual(d.map((x) => dayStatus(x, before)), ["future", "future", "future"]);
  assert.equal(anchorDay(d, before), "2027-03-12");
  assert.equal(dayLabel(d[0], before, todayDayKey(d, before)), "Day 1");

  // 12 March 10:00 Chicago (16:00Z): Friday is today, Saturday is tomorrow
  const fri = Z("2027-03-12T16:00:00Z");
  assert.deepEqual(d.map((x) => dayStatus(x, fri)), ["today", "future", "future"]);
  assert.equal(dayLabel(d[0], fri, todayDayKey(d, fri)), "Today");
  assert.equal(dayLabel(d[1], fri, todayDayKey(d, fri)), "Tomorrow");
  assert.equal(dayLabel(d[2], fri, todayDayKey(d, fri)), "Day 3");

  // Saturday 16:00 Paris = 15:00Z: Friday past, Saturday today
  const sat = Z("2027-03-13T15:00:00Z");
  assert.deepEqual(d.map((x) => dayStatus(x, sat)), ["past", "today", "future"]);
  assert.equal(anchorDay(d, sat), "2027-03-13");
  assert.equal(dayLabel(d[0], sat, todayDayKey(d, sat)), "Day 1");

  const after = Z("2027-04-01T00:00:00Z");
  assert.deepEqual(d.map((x) => dayStatus(x, after)), ["past", "past", "past"]);
  assert.equal(anchorDay(d, after), "2027-03-14");
  assert.equal(anchorDay([], after), null);
});

it("today comes from the zone of the day, not the server clock", () => {
  const d = buildDays([item("x", "2027-03-13", "20:00", "21:00", C), item("y", "2027-03-14", "09:00", null, P)]);
  // 05:30Z on the 14th = 11:30 pm Chicago on the 13th = 6:30 am Paris on the 14th
  const t = Z("2027-03-14T05:30:00Z");
  assert.equal(dayStatus(d[0], t), "today"); // Chicago day 13 is still on
  assert.equal(dayStatus(d[1], t), "today"); // Paris day 14 has begun
  assert.equal(todayDayKey(d, t), "2027-03-13"); // only the earliest gets "Today"
  assert.equal(dayLabel(d[1], t, todayDayKey(d, t)), "Day 2");
  // midnight edge in Chicago: 05:59Z is 11:59 pm CST, 06:00Z is midnight on the 14th
  assert.equal(localParts(Z("2027-03-14T05:59:00Z"), C).date, "2027-03-13");
  assert.equal(localParts(Z("2027-03-14T06:00:00Z"), C).date, "2027-03-14");
});

it("a day with a late item is not past until the item ends", () => {
  const d = buildDays([item("late", "2027-03-13", "23:00", "01:00", P)]);
  assert.equal(dayStatus(d[0], Z("2027-03-14T00:30:00+01:00")), "today");
  assert.equal(dayStatus(d[0], Z("2027-03-14T01:00:00+01:00")), "past");
});

it("now and next", () => {
  const d = days();
  // Saturday 15:30 Paris = 14:30Z -> walk (15:00-17:00) is Now; next is the service on Sunday
  let r = nowAndNext(d, Z("2027-03-13T14:30:00Z"));
  assert.deepEqual([...r.nowIds], ["walk"]);
  assert.equal(r.nextId, "service");
  // 10:30 Paris Saturday: between arrive (ended 10:00) and rest (11:00)
  r = nowAndNext(d, Z("2027-03-13T09:30:00Z"));
  assert.equal(r.nowIds.size, 0);
  assert.equal(r.nextId, "rest");
  // rest has no end: 60 minutes -> still Now at 11:59, over at 12:00
  assert.ok(nowAndNext(d, Z("2027-03-13T10:59:00Z")).nowIds.has("rest"));
  assert.ok(!nowAndNext(d, Z("2027-03-13T11:00:00Z")).nowIds.has("rest"));
  // boundaries: start is inclusive, end exclusive
  assert.ok(nowAndNext(d, Z("2027-03-13T14:00:00Z")).nowIds.has("walk"));
  assert.ok(!nowAndNext(d, Z("2027-03-13T16:00:00Z")).nowIds.has("walk"));
  // before the trip: next is the first flight; after: nothing
  assert.equal(nowAndNext(d, Z("2027-01-01T00:00:00Z")).nextId, "fly");
  assert.equal(nowAndNext(d, Z("2027-05-01T00:00:00Z")).nextId, null);
  // all-day item is never Now or Next, even on its day when it is the only one left
  const only = buildDays([item("ad", "2027-03-13", null, null, P)]);
  r = nowAndNext(only, Z("2027-03-13T10:00:00Z"));
  assert.equal(r.nowIds.size, 0);
  assert.equal(r.nextId, null);
});

it("tz mixes: Texas time item vs Strasbourg time item", () => {
  const d = buildDays([item("tx", "2027-03-13", "15:00", "17:00", C), item("fr", "2027-03-13", "20:00", "21:00", P)]);
  assert.ok(d[0].mixed);
  // 15:00 Chicago (CST) = 21:00Z; 20:00 Paris = 19:00Z -> Paris item sorts first by real time
  assert.deepEqual(d[0].items.map((x) => x.id), ["fr", "tx"]);
  const r = nowAndNext(d, Z("2027-03-13T21:30:00Z"));
  assert.deepEqual([...r.nowIds], ["tx"]);
  // missing / unknown tz means Strasbourg
  assert.equal(itemWindow(item("m", "2027-03-13", "12:00", null, undefined)).start, Z("2027-03-13T11:00:00Z"));
  assert.equal(itemWindow(item("m", "2027-03-13", "12:00", null, "Mars/Base")).start, Z("2027-03-13T11:00:00Z"));
});

it("Updated tag window", () => {
  const now = Z("2027-03-12T12:00:00Z");
  const base = { created_at: "2027-03-01T00:00:00.000000+00:00" };
  assert.ok(isRecentlyUpdated(item("u", "2027-03-12", null, null, P, { ...base, updated_at: "2027-03-11T13:00:00.123456+00:00" }), now));
  assert.ok(!isRecentlyUpdated(item("u", "2027-03-12", null, null, P, { ...base, updated_at: "2027-03-11T11:59:00Z" }), now));
  assert.ok(!isRecentlyUpdated(item("u", "2027-03-12", null, null, P, base), now)); // no updated_at (pre-migration)
  const fresh = "2027-03-12T11:00:00.5+00:00";
  assert.ok(!isRecentlyUpdated(item("u", "2027-03-12", null, null, P, { created_at: fresh, updated_at: fresh }), now)); // just created
  assert.ok(!isRecentlyUpdated(item("u", "2027-03-12", null, null, P, { ...base, updated_at: "garbage" }), now));
});

console.log(`itinerary: ${n} groups ok`);
