"use server";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { allocate, suggestionsFor, trackMentors } from "@/lib/matching";
import { notify } from "@/lib/notify";
import { activateMatch, closeMatch } from "@/lib/ops";
import { getSettings } from "@/lib/settings";
import { validMeetingUrl } from "@/lib/meet";
import { done, fail, list, me, pair, safe, staff, str } from "./util";

async function menteeContext(cohortId: string, trackId: string) {
  const user = await me();
  const membership = await db.membership.findFirst({
    where: { userId: user.id, cohortId, trackId, role: "MENTEE", status: "ACTIVE" }, include: { track: true },
  });
  if (!membership) return { user, error: "You are not a mentee in that track." as const };
  const track = membership.track;
  const now = new Date();
  if (track.windowOpen && now < track.windowOpen) return { user, error: "Choosing a mentor has not opened yet." as const };
  if (track.windowClose && now > track.windowClose) return { user, error: "The window for choosing a mentor has closed." as const };
  const active = await db.match.findFirst({ where: { menteeId: user.id, cohortId, trackId, status: { in: ["ACTIVE", "PAUSED"] } } });
  if (active) return { user, error: "You already have a mentor in this track." as const };
  return { user, track, error: null };
}

export const pickMentor = safe(async (cohortId: string, trackId: string, mentorId: string) => {
  const ctx = await menteeContext(cohortId, trackId);
  if (ctx.error) return fail(ctx.error);
  if (ctx.track.assignmentMode !== "PICK") return fail("This track does not use instant picking.");
  const sug = (await suggestionsFor(ctx.user.id, cohortId, trackId)).find((s) => s.mentorId === mentorId);
  if (!sug) return fail("That mentor is full or not available. Please choose another.");
  const m = await activateMatch({ menteeId: ctx.user.id, mentorId, cohortId, trackId, score: sug.score, reasons: sug.reasons }, ctx.user);
  return done("You are paired!", `/pairs/${m.id}`);
});

export const requestMentor = safe(async (cohortId: string, trackId: string, mentorId: string, fd: FormData) => {
  const ctx = await menteeContext(cohortId, trackId);
  if (ctx.error) return fail(ctx.error);
  if (ctx.track.assignmentMode !== "REQUEST") return fail("This track does not use requests.");
  const s = await getSettings();
  const open = await db.match.findMany({ where: { menteeId: ctx.user.id, cohortId, trackId, status: "REQUESTED" } });
  if (open.some((o) => o.mentorId === mentorId)) return fail("You have already sent this mentor a request.");
  if (open.length >= s.maxOpenRequests) return fail(`You can have ${s.maxOpenRequests} open requests at once. Withdraw one first.`);
  const sug = (await suggestionsFor(ctx.user.id, cohortId, trackId)).find((x) => x.mentorId === mentorId);
  if (!sug) return fail("That mentor is full or not available. Please choose another.");
  const note = str(fd, "note").slice(0, 600);
  if (note.length < 20) return fail("Write a short note (at least 20 characters) so the mentor knows why you chose them.");
  await db.match.create({ data: { menteeId: ctx.user.id, mentorId, cohortId, trackId, status: "REQUESTED", note, score: sug.score, reasons: JSON.stringify(sug.reasons), createdById: ctx.user.id } });
  await notify(mentorId, { type: "match_request", title: `${ctx.user.name} asked you to be their mentor`, body: `"${note}"\n\nPlease accept or decline within ${s.requestExpiryDays} days.`, href: "/requests", cta: "Review request" });
  return done("Request sent");
});

export const withdrawRequest = safe(async (matchId: string) => {
  const user = await me();
  const m = await db.match.findFirst({ where: { id: matchId, menteeId: user.id, status: "REQUESTED" } });
  if (!m) return fail("That request is no longer open.");
  await db.match.update({ where: { id: m.id }, data: { status: "EXPIRED", endReason: "Withdrawn by mentee", respondedAt: new Date() } });
  return done("Request withdrawn");
});

export const respondRequest = safe(async (matchId: string, accept: boolean, fd?: FormData) => {
  const user = await me();
  const m = await db.match.findFirst({ where: { id: matchId, mentorId: user.id, status: "REQUESTED" }, include: { mentee: true } });
  if (!m) return fail("That request is no longer open.");
  if (!accept) {
    const reason = fd ? str(fd, "reason").slice(0, 300) : "";
    await db.match.update({ where: { id: m.id }, data: { status: "DECLINED", endReason: reason || "Declined", respondedAt: new Date() } });
    await notify(m.menteeId, { type: "request_declined", title: `${user.name} cannot take your request`, body: "This is usually about time or fit, not about you. You can choose another mentor now.", href: "/mentor", cta: "Choose another mentor" });
    await audit(user, "match.decline", m.mentee.name);
    return done("Request declined");
  }
  const mentors = await trackMentors(m.cohortId, m.trackId);
  const mine = mentors.find((x) => x.user.id === user.id);
  if (!mine || mine.spots <= 0) return fail("You are at capacity. Raise your capacity in your profile or decline the request.");
  const already = await db.match.findFirst({ where: { menteeId: m.menteeId, cohortId: m.cohortId, trackId: m.trackId, status: { in: ["ACTIVE", "PAUSED"] } } });
  if (already) {
    await db.match.update({ where: { id: m.id }, data: { status: "EXPIRED", endReason: "Paired with another mentor" } });
    return fail("This mentee has already been paired with another mentor.");
  }
  const act = await activateMatch({ menteeId: m.menteeId, mentorId: user.id, cohortId: m.cohortId, trackId: m.trackId, existingId: m.id }, user);
  return done(`You are now mentoring ${m.mentee.name}`, `/pairs/${act.id}`);
});

export const saveRanking = safe(async (cohortId: string, trackId: string, fd: FormData) => {
  const ctx = await menteeContext(cohortId, trackId);
  if (ctx.error) return fail(ctx.error);
  if (ctx.track.assignmentMode !== "RANK") return fail("This track does not use ranking.");
  const ids = [...new Set(list(fd, "ranking"))].slice(0, 3);
  if (!ids.length) return fail("Choose at least one mentor.");
  const valid = new Set((await trackMentors(cohortId, trackId)).map((m) => m.user.id));
  if (ids.some((id) => !valid.has(id))) return fail("One of those mentors is no longer available.");
  await db.$transaction([
    db.mentorRanking.deleteMany({ where: { menteeId: ctx.user.id, cohortId, trackId } }),
    ...ids.map((mentorId, i) => db.mentorRanking.create({ data: { menteeId: ctx.user.id, mentorId, cohortId, trackId, rank: i + 1 } })),
  ]);
  return done("Your choices are saved. You will be matched when the window closes.");
});

// ---------- Staff ----------

export const assignPair = safe(async (cohortId: string, trackId: string, menteeId: string, mentorId: string) => {
  const user = await staff(trackId);
  const [mem, men] = await Promise.all([
    db.membership.findFirst({ where: { userId: menteeId, cohortId, trackId, role: "MENTEE" } }),
    db.membership.findFirst({ where: { userId: mentorId, cohortId, trackId, role: "MENTOR" } }),
  ]);
  if (!mem || !men) return fail("Both people must be in this track and cohort.");
  if (await db.exclusion.findFirst({ where: { menteeId, mentorId } })) return fail("These two people are excluded from being paired.");
  if (await db.match.findFirst({ where: { menteeId, cohortId, trackId, status: { in: ["ACTIVE", "PAUSED"] } } })) return fail("This mentee already has a mentor in this track.");
  const mentor = (await trackMentors(cohortId, trackId)).find((m) => m.user.id === mentorId);
  if (!mentor || mentor.spots <= 0) return fail("That mentor has no spots left.");
  const sug = (await suggestionsFor(menteeId, cohortId, trackId)).find((s) => s.mentorId === mentorId);
  await activateMatch({ menteeId, mentorId, cohortId, trackId, score: sug?.score, reasons: sug?.reasons }, user);
  return done("Pair confirmed");
});

/** Confirms the top suggestion for every unassigned mentee in a track, within capacity. */
export const autoAssign = safe(async (cohortId: string, trackId: string) => {
  const user = await staff(trackId);
  const track = await db.track.findUniqueOrThrow({ where: { id: trackId } });
  const pairs = await allocate(cohortId, trackId, track.assignmentMode === "RANK");
  for (const p of pairs) await activateMatch({ ...p, cohortId, trackId }, user);
  await audit(user, "match.bulk_assign", track.name, `${pairs.length} pairs`);
  return pairs.length ? done(`${pairs.length} pair${pairs.length > 1 ? "s" : ""} confirmed`) : fail("No one could be paired. Check that mentors have spots left.");
});

export const endPair = safe(async (matchId: string, fd: FormData) => {
  const { user, match } = await pair(matchId);
  await staff(match.trackId);
  const reason = str(fd, "reason");
  if (reason.length < 3) return fail("Please give a reason.");
  await closeMatch(matchId, "ENDED", reason, user);
  return done("Pair ended");
});

export const pausePair = safe(async (matchId: string) => {
  const { user, match } = await pair(matchId);
  await staff(match.trackId);
  await closeMatch(matchId, "PAUSED", "Paused by the program team", user);
  return done("Pair paused");
});

export const resumePair = safe(async (matchId: string) => {
  const { user, match } = await pair(matchId);
  await staff(match.trackId);
  await db.match.update({ where: { id: matchId }, data: { status: "ACTIVE", endReason: null } });
  for (const id of [match.menteeId, match.mentorId]) await notify(id, { type: "match_changed", title: "Your pairing is active again", body: "You can book sessions again.", href: `/pairs/${matchId}` });
  await audit(user, "match.resume", `${match.mentee.name} ↔ ${match.mentor.name}`);
  return done("Pair resumed");
});

export const swapMentor = safe(async (matchId: string, fd: FormData) => {
  const { user, match } = await pair(matchId);
  await staff(match.trackId);
  const mentorId = str(fd, "mentorId");
  const mentor = (await trackMentors(match.cohortId, match.trackId)).find((m) => m.user.id === mentorId);
  if (!mentor || mentor.spots <= 0) return fail("That mentor has no spots left.");
  await closeMatch(matchId, "ENDED", str(fd, "reason") || "Mentor changed by the program team", user);
  const m = await activateMatch({ menteeId: match.menteeId, mentorId, cohortId: match.cohortId, trackId: match.trackId }, user);
  return done("Mentor changed", `/pairs/${m.id}`);
});

export const savePairSettings = safe(async (matchId: string, fd: FormData) => {
  const { user, match, member } = await pair(matchId);
  const room = str(fd, "fixedMeetUrl");
  if (room && !validMeetingUrl(room)) return fail("Paste a Google Meet link that starts with https://meet.google.com/");
  const rhythm = ["WEEKLY", "BIWEEKLY", "MONTHLY"].includes(str(fd, "rhythm")) ? str(fd, "rhythm") : match.rhythm;
  await db.match.update({
    where: { id: matchId },
    data: { rhythm, fixedMeetUrl: room || null, ...(member ? {} : { adminNotes: str(fd, "adminNotes") || null }) },
  });
  await audit(user, "match.settings", `${match.mentee.name} ↔ ${match.mentor.name}`);
  return done("Saved");
});

export const nudgePair = safe(async (matchId: string) => {
  const { user, match } = await pair(matchId);
  await staff(match.trackId);
  for (const [id, other] of [[match.menteeId, match.mentor.name], [match.mentorId, match.mentee.name]] as const) {
    await notify(id, { type: "nudge", title: `Time to catch up with ${other}?`, body: "The program team noticed it has been a little while. Booking your next session only takes a minute.", href: `/sessions/book?pair=${matchId}`, cta: "Book a session" });
  }
  await audit(user, "match.nudge", `${match.mentee.name} ↔ ${match.mentor.name}`);
  return done("Nudge sent to both people");
});

export const addExclusion = safe(async (fd: FormData) => {
  const user = await staff(str(fd, "trackId"));
  const menteeId = str(fd, "menteeId"), mentorId = str(fd, "mentorId");
  if (!menteeId || !mentorId) return fail("Choose both people.");
  await db.exclusion.upsert({ where: { menteeId_mentorId: { menteeId, mentorId } }, create: { menteeId, mentorId, reason: str(fd, "reason") || null }, update: {} });
  await audit(user, "match.exclusion", `${menteeId} × ${mentorId}`);
  return done("Exclusion added. These two will never be suggested or paired.");
});
