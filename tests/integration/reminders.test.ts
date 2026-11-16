// Runs against the test database (see `npm run test:integration`), freshly seeded.
import assert from "node:assert/strict";
import { after, test } from "node:test";
import { db } from "../../src/lib/db";
import { runTick } from "../../src/lib/reminders";

const HOUR = 3600_000;
after(() => db.$disconnect());

async function pairOf(email: string) {
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  const match = await db.match.findFirstOrThrow({ where: { menteeId: user.id, status: "ACTIVE" } });
  return { user, match };
}

test("session reminders go out at 24h and 1h, once each, to both people", async () => {
  const { user, match } = await pairOf("mentee@emp.local");
  const now = new Date();
  const s = await db.session.create({ data: { matchId: match.id, startsAt: new Date(now.getTime() + 30 * HOUR), endsAt: new Date(now.getTime() + 31 * HOUR), durationMin: 60, status: "CONFIRMED", proposedById: user.id, joinUrl: "https://meet.google.com/aaa-bbbb-ccc" } });
  const count = () => db.notification.count({ where: { type: "session_reminder", href: `/sessions/${s.id}` } });

  await runTick(now);
  assert.equal(await count(), 0, "nothing 30 hours before");

  const at23h = new Date(s.startsAt.getTime() - 23 * HOUR);
  await runTick(at23h);
  assert.equal(await count(), 2, "24h reminder to mentee and mentor");
  await runTick(new Date(at23h.getTime() + 60_000));
  assert.equal(await count(), 2, "no duplicates on the next tick");

  await runTick(new Date(s.startsAt.getTime() - 30 * 60_000));
  assert.equal(await count(), 4, "1h reminder to both");

  const mail = await db.emailMessage.findFirst({ where: { type: "session_reminder", to: user.email }, orderBy: { createdAt: "desc" } });
  assert.match(mail!.body, /meet\.google\.com\/aaa-bbbb-ccc/, "the email carries the join link");
  await db.session.delete({ where: { id: s.id } });
});

test("a cancelled session sends no reminders", async () => {
  const { user, match } = await pairOf("mentee@emp.local");
  const now = new Date();
  const s = await db.session.create({ data: { matchId: match.id, startsAt: new Date(now.getTime() + 20 * HOUR), endsAt: new Date(now.getTime() + 21 * HOUR), durationMin: 60, status: "CANCELLED", proposedById: user.id } });
  await runTick(now);
  assert.equal(await db.notification.count({ where: { href: `/sessions/${s.id}` } }), 0);
  await db.session.delete({ where: { id: s.id } });
});

test("a proposal whose time has passed expires", async () => {
  const { user, match } = await pairOf("mentee@emp.local");
  const now = new Date();
  const s = await db.session.create({ data: { matchId: match.id, startsAt: new Date(now.getTime() - HOUR), endsAt: now, durationMin: 60, status: "PROPOSED", proposedById: user.id } });
  await runTick(now);
  assert.equal((await db.session.findUniqueOrThrow({ where: { id: s.id } })).status, "EXPIRED");
  await db.session.delete({ where: { id: s.id } });
});

test("when both people clicked Join, the session is marked held with attendance", async () => {
  const { user, match } = await pairOf("mentee@emp.local");
  const now = new Date();
  const start = new Date(now.getTime() - 2 * HOUR);
  const s = await db.session.create({ data: { matchId: match.id, startsAt: start, endsAt: new Date(start.getTime() + HOUR), durationMin: 60, status: "CONFIRMED", proposedById: user.id, joinUrl: "https://meet.google.com/aaa-bbbb-ccc" } });
  await db.joinEvent.create({ data: { sessionId: s.id, userId: match.menteeId, at: new Date(start.getTime() - 60_000) } });
  await db.joinEvent.create({ data: { sessionId: s.id, userId: match.mentorId, at: new Date(start.getTime() + 20 * 60_000) } });
  await runTick(now);
  const after = await db.session.findUniqueOrThrow({ where: { id: s.id }, include: { attendance: true } });
  assert.equal(after.status, "HELD");
  assert.equal(after.attendance.find((a) => a.userId === match.menteeId)?.status, "PRESENT");
  assert.equal(after.attendance.find((a) => a.userId === match.mentorId)?.status, "LATE", "joined 20 minutes in, past the track's late threshold");
  await db.session.delete({ where: { id: s.id } });
});

test("an unanswered mentor request expires and the mentee is told", async () => {
  const req = await db.match.findFirstOrThrow({ where: { status: "REQUESTED" } });
  await db.match.update({ where: { id: req.id }, data: { createdAt: new Date(Date.now() - 6 * 24 * HOUR) } });
  await runTick();
  assert.equal((await db.match.findUniqueOrThrow({ where: { id: req.id } })).status, "EXPIRED");
  assert.equal(await db.notification.count({ where: { userId: req.menteeId, type: "request_expired" } }), 1);
});

test("unused invites are re-sent on day 3, and only once", async () => {
  const u = await db.user.findUniqueOrThrow({ where: { email: "new@emp.local" } });
  await db.user.update({ where: { id: u.id }, data: { invitedAt: new Date(Date.now() - 3.2 * 24 * HOUR) } });
  const sent = () => db.emailMessage.count({ where: { to: u.email, type: "invite_reminder" } });
  const before = await sent();
  await runTick();
  assert.equal(await sent(), before + 1);
  await runTick();
  assert.equal(await sent(), before + 1);
});
