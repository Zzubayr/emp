import { expect, test, type Page } from "@playwright/test";
import { db, signIn, toast, userByEmail } from "./helpers";

test.describe.configure({ mode: "serial" });

let admin: Page, mentee: Page;
const activePairs = () => db.match.count({ where: { status: "ACTIVE" } });
const track = (name: string) => db.track.findUniqueOrThrow({ where: { name } });

test.beforeAll(async ({ browser }) => {
  admin = await signIn(browser, "admin@emp.local");
  mentee = await signIn(browser, "mentee@emp.local");
});
test.afterAll(() => db.$disconnect());

test("sign-in never reveals who is on the list, and locks after five wrong codes", async ({ browser }) => {
  const page = await (await browser.newContext()).newPage();
  await page.goto("/sign-in");
  await page.fill("input[type=email]", "stranger@nowhere.example");
  await page.click("button[type=submit]");
  await expect(page.getByText("is on the list, we sent a 6-digit code")).toBeVisible();
  await expect(page.getByText("not on the allow list, so no code was sent")).toBeVisible(); // demo-mode hint only
  expect(await db.emailMessage.count({ where: { to: "stranger@nowhere.example" } })).toBe(0);

  await page.getByText("Use a different email").click();
  await page.fill("input[type=email]", "new@emp.local");
  await page.click("button[type=submit]");
  const code = page.locator("input[inputmode=numeric]");
  for (let i = 0; i < 5; i++) {
    await code.fill("000000");
    await toast(page, i < 5 ? /not right|locked/ : /locked/);
    await expect(code).toHaveValue("");
    await page.waitForTimeout(300);
  }
  await code.fill("000000");
  await toast(page, "locked for 15 minutes");
  expect(page.url()).toContain("/sign-in");
});

test("members cannot reach admin screens, other people's pairs, or exports", async ({ browser }) => {
  await mentee.goto("/admin");
  await expect(mentee).toHaveURL(/\/home$/);
  await mentee.goto("/admin/people");
  await expect(mentee).toHaveURL(/\/home$/);
  expect((await mentee.request.get("/api/export/people")).status()).toBe(403);
  const me = await userByEmail("mentee@emp.local");
  const other = await db.match.findFirstOrThrow({ where: { menteeId: { not: me.id }, mentorId: { not: me.id } }, include: { sessions: { take: 1 } } });
  await mentee.goto(`/pairs/${other.id}`);
  await expect(mentee.getByText("We could not find that page")).toBeVisible();
  if (other.sessions[0]) {
    await mentee.goto(`/sessions/${other.sessions[0].id}`);
    await expect(mentee.getByText("We could not find that page")).toBeVisible();
    expect((await mentee.request.get(`/api/sessions/${other.sessions[0].id}/ics`)).status()).toBe(404);
  }

  const coord = await signIn(browser, "coordinator@emp.local");
  await coord.goto(`/admin/tracks/${(await track("100 Level")).id}`);
  await expect(coord.getByText("We could not find that page")).toBeVisible();
  await coord.goto("/admin/settings");
  await expect(coord).toHaveURL(/\/admin$/);
  const csv = await (await coord.request.get("/api/export/pairs")).text();
  expect(csv).toContain("Tech");
  expect(csv).not.toContain("100 Level");
  await coord.context().close();
});

test("admin confirms one suggestion, then the best match for everyone left", async () => {
  let t = await track("200 Level");
  // Make sure there is room: give this track's mentors spare capacity.
  t = await db.track.update({ where: { id: t.id }, data: { maxMenteesPerMentor: 6 } });
  await db.user.updateMany({ where: { role: "MENTOR", memberships: { some: { trackId: t.id } } }, data: { capacity: 6 } });
  const before = await activePairs();
  await admin.goto(`/admin/matching?track=${t.id}`);
  await admin.getByRole("button", { name: "Pair", exact: true }).first().click();
  await toast(admin, "Pair confirmed");
  await expect.poll(activePairs).toBe(before + 1);

  const bulk = admin.getByRole("button", { name: "Confirm best match for all" });
  if (await bulk.isVisible()) {
    await bulk.click();
    await admin.getByRole("button", { name: "Confirm all" }).click();
    await toast(admin, /pairs? confirmed/);
    expect(await activePairs()).toBeGreaterThan(before + 1);
  }
  // No mentor may end up over their own capacity or the track's cap
  const mentors = await db.user.findMany({ where: { role: "MENTOR" }, include: { mentorMatches: { where: { status: "ACTIVE", trackId: t.id } } } });
  for (const m of mentors) expect(m.mentorMatches.length).toBeLessThanOrEqual(Math.min(m.capacity, t.maxMenteesPerMentor));
  // Both people were told
  const last = await db.match.findFirstOrThrow({ where: { trackId: t.id, status: "ACTIVE" }, orderBy: { startedAt: "desc" } });
  expect(await db.notification.count({ where: { type: "match_confirmed", href: `/pairs/${last.id}` } })).toBe(2);
});

test("rank and allocate honours a student's first choice", async ({ browser }) => {
  const t = await track("Career and Employability");
  const cohort = await db.cohort.findFirstOrThrow({ where: { status: "ACTIVE" } });
  const m = await db.membership.findFirstOrThrow({
    where: { trackId: t.id, cohortId: cohort.id, role: "MENTEE", user: { onboardedAt: { not: null }, menteeMatches: { none: { trackId: t.id, status: { in: ["ACTIVE", "PAUSED"] } } } } },
    include: { user: true },
  });
  const page = await signIn(browser, m.user.email);
  await page.goto("/mentor");
  await page.getByRole("button", { name: "Add to ranking" }).first().click();
  await page.getByRole("button", { name: "Add to ranking" }).first().click();
  await page.getByRole("button", { name: "Save ranking" }).click();
  await toast(page, "Your choices are saved");
  const ranks = await db.mentorRanking.findMany({ where: { menteeId: m.userId, trackId: t.id }, orderBy: { rank: "asc" } });
  expect(ranks).toHaveLength(2);
  await page.context().close();

  await db.user.updateMany({ where: { role: "MENTOR", memberships: { some: { trackId: t.id } } }, data: { capacity: 6 } });
  await admin.goto(`/admin/matching?track=${t.id}`);
  await admin.getByRole("button", { name: "Confirm best match for all" }).click();
  await admin.getByRole("button", { name: "Confirm all" }).click();
  await toast(admin, /pairs? confirmed/);
  const match = await db.match.findFirstOrThrow({ where: { menteeId: m.userId, trackId: t.id, status: "ACTIVE" } });
  expect(ranks.map((r) => r.mentorId)).toContain(match.mentorId);
  expect(match.reasons).toContain("Ranked choice");
  expect(await db.mentorRanking.count({ where: { menteeId: m.userId, trackId: t.id } })).toBe(0);
});

test("feedback is saved, once, and a low score alerts the admins", async () => {
  const me = await userByEmail("mentee@emp.local");
  const s = await db.session.findFirstOrThrow({ where: { status: "HELD", match: { menteeId: me.id } }, orderBy: { startsAt: "desc" } });
  await db.feedback.deleteMany({ where: { sessionId: s.id, authorId: me.id } });
  await mentee.goto(`/sessions/${s.id}`);
  await mentee.locator('[aria-label="Usefulness"] button').nth(1).click(); // 2 stars
  await mentee.locator('[aria-label="Preparedness"] button').nth(3).click();
  await mentee.locator('[aria-label="Connection"] button').nth(4).click();
  await mentee.fill("textarea[name=comment]", "Ran short on time.");
  await mentee.getByRole("button", { name: "Send feedback" }).click();
  await toast(mentee, "Your feedback is in");
  const fb = await db.feedback.findUniqueOrThrow({ where: { sessionId_authorId: { sessionId: s.id, authorId: me.id } } });
  expect([fb.usefulness, fb.preparedness, fb.connection, fb.comment, fb.flagged]).toEqual([2, 4, 5, "Ran short on time.", true]);
  await expect(mentee.getByText("Thank you. Your feedback is in.")).toBeVisible();
  await expect(mentee.getByRole("button", { name: "Send feedback" })).toHaveCount(0);
  const adminUser = await userByEmail("admin@emp.local");
  expect(await db.notification.count({ where: { userId: adminUser.id, type: "feedback_flag" } })).toBe(1);
});

test("a session can be rescheduled and then cancelled, and the partner is told", async () => {
  const me = await userByEmail("mentee@emp.local");
  const old = await db.session.findFirstOrThrow({ where: { status: "CONFIRMED", startsAt: { gt: new Date() }, match: { menteeId: me.id } }, include: { match: true } });
  await mentee.goto(`/sessions/${old.id}`);
  await mentee.getByRole("link", { name: "Reschedule" }).click();
  await mentee.waitForURL(/sessions\/book/);
  await mentee.locator("button", { hasText: /^(Mon|Wed)/ }).first().click();
  const box = (await mentee.getByText("6pm", { exact: true }).first().boundingBox())!;
  await mentee.mouse.click(box.x + 250, box.y + 20);
  await mentee.getByRole("button", { name: /Confirm/ }).click();
  await mentee.waitForURL((u) => /\/sessions\/c/.test(u.pathname) && !u.pathname.endsWith(old.id));
  const next = mentee.url().split("/").pop()!;
  const [was, now] = await Promise.all([db.session.findUniqueOrThrow({ where: { id: old.id } }), db.session.findUniqueOrThrow({ where: { id: next } })]);
  expect(was.status).toBe("CANCELLED");
  expect(was.cancelReason).toMatch(/^Rescheduled/);
  expect(now.status).toBe("PROPOSED");
  expect(now.joinUrl).toBe(old.joinUrl); // the meeting link carries over
  expect(await db.notification.count({ where: { userId: old.match.mentorId, type: "session_proposed", href: `/sessions/${next}` } })).toBe(1);
  // The slot is no longer offered to anyone else
  const clash = await db.session.count({ where: { id: { not: next }, status: { in: ["PROPOSED", "CONFIRMED"] }, startsAt: { lt: now.endsAt }, endsAt: { gt: now.startsAt }, match: { OR: [{ mentorId: old.match.mentorId }, { menteeId: me.id }] } } });
  expect(clash).toBe(0);

  await mentee.getByRole("button", { name: "Cancel session" }).first().click();
  await mentee.locator("[role=dialog] select[name=reason]").selectOption("Exams or coursework");
  await mentee.locator("[role=dialog] button[type=submit]").click();
  await toast(mentee, "Session cancelled");
  const cancelled = await db.session.findUniqueOrThrow({ where: { id: next } });
  expect([cancelled.status, cancelled.cancelReason, cancelled.lateCancel]).toEqual(["CANCELLED", "Exams or coursework", false]);
  expect(await db.notification.count({ where: { userId: old.match.mentorId, type: "session_cancelled" } })).toBe(1);
});

test("a serious safety report pauses the pair, opens a case, and unlocks private notes for admins only then", async () => {
  const me = await userByEmail("mentee@emp.local");
  const pair = await db.match.findFirstOrThrow({ where: { menteeId: me.id, status: "ACTIVE" } });
  const withPrivate = await db.session.findFirstOrThrow({ where: { matchId: pair.id, privateNotes: { not: null } } });

  await admin.goto(`/sessions/${withPrivate.id}`);
  await expect(admin.getByText("Mentor's private notes")).toHaveCount(0);
  await mentee.goto(`/sessions/${withPrivate.id}`);
  await expect(mentee.getByText(withPrivate.privateNotes!)).toHaveCount(0); // never shown to the mentee

  await mentee.goto(`/report?pair=${pair.id}`);
  await mentee.selectOption("select[name=category]", "Harassment or bullying");
  await mentee.fill("textarea[name=details]", "Test report: repeated messages late at night after I asked them to stop.");
  await mentee.check("input[name=anonymous]");
  await mentee.getByRole("button", { name: "Send report" }).click();
  await toast(mentee, "safeguarding lead has been alerted");
  const c = await db.safetyCase.findFirstOrThrow({ where: { reporterId: me.id } });
  expect([c.severity, c.status, c.matchId, c.subjectId, c.anonymous]).toEqual(["HIGH", "OPEN", pair.id, pair.mentorId, true]);
  expect((await db.match.findUniqueOrThrow({ where: { id: pair.id } })).status).toBe("PAUSED");
  expect(await db.session.count({ where: { matchId: pair.id, status: { in: ["PROPOSED", "CONFIRMED"] }, startsAt: { gt: new Date() } } })).toBe(0);

  await admin.goto(`/sessions/${withPrivate.id}`);
  await expect(admin.getByText("Mentor's private notes")).toBeVisible();

  await admin.goto(`/admin/safety/${c.id}`);
  await expect(admin.getByText("Test report: repeated messages")).toBeVisible();
  await admin.fill("textarea[name=body]", "Called the reporter; agreed next steps.");
  await admin.getByRole("button", { name: "Add note" }).click();
  await toast(admin, "Note added");
  await admin.selectOption("select[name=status]", "RESOLVED");
  await admin.getByRole("button", { name: "Update case" }).click();
  await toast(admin, "Write the outcome before resolving");
  await admin.fill("textarea[name=outcome]", "Mentor changed; both parties informed.");
  await admin.getByRole("button", { name: "Update case" }).click();
  await toast(admin, "Case updated");
  expect((await db.safetyCase.findUniqueOrThrow({ where: { id: c.id } })).status).toBe("RESOLVED");
  expect(await db.caseNote.count({ where: { caseId: c.id } })).toBe(2);
  expect(await db.auditLog.count({ where: { action: "safety.view", target: c.id } })).toBeGreaterThan(0);

  await admin.goto(`/sessions/${withPrivate.id}`);
  await expect(admin.getByText("Mentor's private notes")).toHaveCount(0); // locked again once resolved
});
