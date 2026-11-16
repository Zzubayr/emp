import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCsv, toCsv } from "../../src/lib/csv";
import { pairHealth } from "../../src/lib/health";
import { fmtOffset, parseOffsets } from "../../src/lib/reminders";
import { isFree, toSlotDays } from "../../src/lib/slots";
import { addDaysIso, localParts, tzOffset, zonedToUtc } from "../../src/lib/time";

const DAY = 86400_000;

test("time: wall-clock to UTC round-trips in a fixed-offset zone", () => {
  const d = zonedToUtc("2026-11-17", 16 * 60, "Africa/Lagos");
  assert.equal(d.toISOString(), "2026-11-17T15:00:00.000Z");
  assert.deepEqual({ iso: localParts(d, "Africa/Lagos").iso, minutes: localParts(d, "Africa/Lagos").minutes }, { iso: "2026-11-17", minutes: 960 });
  assert.equal(tzOffset(d, "Africa/Lagos"), 60);
});

test("time: daylight saving changes are handled on both sides", () => {
  // London: GMT in January, BST in July
  assert.equal(zonedToUtc("2026-01-15", 9 * 60, "Europe/London").toISOString(), "2026-01-15T09:00:00.000Z");
  assert.equal(zonedToUtc("2026-07-15", 9 * 60, "Europe/London").toISOString(), "2026-07-15T08:00:00.000Z");
  // New York spring forward (8 Mar 2026): 10:00 local is EDT, UTC-4
  assert.equal(zonedToUtc("2026-03-08", 10 * 60, "America/New_York").toISOString(), "2026-03-08T14:00:00.000Z");
  assert.equal(zonedToUtc("2026-03-07", 10 * 60, "America/New_York").toISOString(), "2026-03-07T15:00:00.000Z");
});

test("time: date arithmetic crosses months and years", () => {
  assert.equal(addDaysIso("2026-12-31", 1), "2027-01-01");
  assert.equal(addDaysIso("2028-03-01", -1), "2028-02-29");
});

test("slots: free intervals become per-day rails in the viewer's zone", () => {
  const a = zonedToUtc("2026-11-17", 17 * 60, "Africa/Lagos").getTime();
  const days = toSlotDays([[a, a + 3 * 3600_000]], "Africa/Lagos");
  assert.deepEqual(days, [{ date: "2026-11-17", open: [1020, 1200], busy: [] }]);
  // The same interval seen from New York is earlier the same day
  assert.deepEqual(toSlotDays([[a, a + 3 * 3600_000]], "America/New_York")[0].open, [660, 840]);
});

test("slots: an interval crossing midnight is split, gaps become busy", () => {
  const a = zonedToUtc("2026-11-17", 23 * 60, "Africa/Lagos").getTime();
  const split = toSlotDays([[a, a + 2 * 3600_000]], "Africa/Lagos");
  assert.deepEqual(split.map((d) => [d.date, d.open]), [["2026-11-17", [1380, 1440]], ["2026-11-18", [0, 60]]]);
  const m = zonedToUtc("2026-11-17", 9 * 60, "Africa/Lagos").getTime();
  const gap = toSlotDays([[m, m + 3600_000], [m + 3 * 3600_000, m + 4 * 3600_000]], "Africa/Lagos");
  assert.deepEqual(gap[0], { date: "2026-11-17", open: [540, 780], busy: [[600, 720]] });
});

test("slots: a booking must sit wholly inside a free interval", () => {
  const free: [number, number][] = [[1000, 2000]];
  assert.equal(isFree(free, 1000, 2000), true);
  assert.equal(isFree(free, 900, 1500), false);
  assert.equal(isFree(free, 1500, 2001), false);
});

test("csv: quoted fields, embedded commas, tabs and blank lines", () => {
  assert.deepEqual(parseCsv('name,email\n"Obi, Ada",ada@x.edu\n\n"Say ""hi""",b@x.edu\r\n'), [["name", "email"], ["Obi, Ada", "ada@x.edu"], ['Say "hi"', "b@x.edu"]]);
  assert.deepEqual(parseCsv("Ada Obi\tada@x.edu"), [["Ada Obi", "ada@x.edu"]]);
});

test("csv: export escapes quotes and neutralises spreadsheet formulas", () => {
  assert.equal(toCsv([["a,b", 'c"d', "=SUM(A1)", null, 5]]), `"a,b","c""d",'=SUM(A1),,5`);
});

test("reminders: timings parse and print", () => {
  assert.deepEqual(parseOffsets("24h, 1h,15m, 3d"), [1440, 60, 15, 4320]);
  assert.deepEqual([1440, 60, 15, 90].map(fmtOffset), ["1d", "1h", "15m", "90m"]);
  assert.throws(() => parseOffsets("soon"));
});

test("health: a pair that meets on plan is healthy; a silent one is at risk", () => {
  const now = new Date("2026-11-16T12:00:00Z");
  const held = (daysAgo: number) => ({ status: "HELD", startsAt: new Date(now.getTime() - daysAgo * DAY), lateCancel: false, sharedNotes: "notes", feedback: [{ usefulness: 5, preparedness: 4, connection: 5 }] });
  const base = { status: "ACTIVE", rhythm: "BIWEEKLY", startedAt: new Date(now.getTime() - 60 * DAY), createdAt: new Date(now.getTime() - 60 * DAY) };
  const good = pairHealth({ ...base, sessions: [held(20), held(6)] }, now);
  assert.equal(good.band, "Healthy");
  const silent = pairHealth({ ...base, sessions: [] }, now);
  assert.equal(silent.band, "At risk");
  const flaky = pairHealth({ ...base, sessions: [{ ...held(25), feedback: [{ usefulness: 2, preparedness: 2, connection: 2 }] }, { status: "NO_SHOW_MENTEE", startsAt: new Date(now.getTime() - 10 * DAY), lateCancel: false, sharedNotes: null }, { status: "CANCELLED", startsAt: new Date(now.getTime() - 3 * DAY), lateCancel: true, sharedNotes: null }] }, now);
  assert.ok(flaky.score < good.score && flaky.band !== "Healthy");
});

test("health: a brand-new pair is given time to start", () => {
  const now = new Date("2026-11-16T12:00:00Z");
  const fresh = pairHealth({ status: "ACTIVE", rhythm: "WEEKLY", startedAt: new Date(now.getTime() - 3 * DAY), createdAt: new Date(now.getTime() - 3 * DAY), sessions: [] }, now);
  assert.equal(fresh.band, "Healthy");
});
