"use server";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { validMeetingUrl } from "@/lib/meet";
import { notify, notifyAdmins } from "@/lib/notify";
import { confirmSession, recordOutcome } from "@/lib/ops";
import { getSettings } from "@/lib/settings";
import { isFree, mutualFree } from "@/lib/slots";
import { fmtDateTime, zonedToUtc } from "@/lib/time";
import { parseList } from "@/lib/constants";
import { done, fail, int, pair, safe, staff, str } from "./util";

async function sessionCtx(sessionId: string) {
  const s = await db.session.findUnique({ where: { id: sessionId } });
  if (!s) return null;
  const ctx = await pair(s.matchId);
  return { ...ctx, session: s };
}

const withAvail = { include: { availability: true } } as const;

export const bookSession = safe(async (matchId: string, slot: { date: string; start: number; minutes: number }, fd: FormData) => {
  const { user, match, member } = await pair(matchId);
  if (!member) return fail("Only the mentor or mentee can book a session.");
  if (match.status !== "ACTIVE") return fail("This pairing is not active, so sessions cannot be booked.");
  const lengths = parseList(match.track.sessionLengths).map(Number);
  if (!lengths.includes(slot.minutes)) return fail("That session length is not allowed in this track.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(slot.date) || slot.start < 0 || slot.start >= 1440) return fail("Pick a time first.");
  const startsAt = zonedToUtc(slot.date, slot.start, user.timezone);
  const endsAt = new Date(startsAt.getTime() + slot.minutes * 60_000);
  const replaceId = str(fd, "replace") || undefined;
  const [mentor, mentee] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: match.mentorId }, ...withAvail }),
    db.user.findUniqueOrThrow({ where: { id: match.menteeId }, ...withAvail }),
  ]);
  const free = await mutualFree(mentor, mentee, 21, replaceId);
  if (!isFree(free, startsAt.getTime(), endsAt.getTime())) return fail("That time is no longer free for both of you. Please pick another.");

  let old = null;
  if (replaceId) {
    old = await db.session.findFirst({ where: { id: replaceId, matchId, status: { in: ["PROPOSED", "CONFIRMED"] } } });
    if (!old) return fail("The session you are moving can no longer be changed.");
  }
  const session = await db.session.create({
    data: {
      matchId, startsAt, endsAt, durationMin: slot.minutes, status: "PROPOSED", proposedById: user.id,
      topic: str(fd, "topic").slice(0, 120) || old?.topic || null, agenda: str(fd, "agenda").slice(0, 1500) || old?.agenda || null,
      joinUrl: old?.joinUrl, meetCode: old?.meetCode, meetSpace: old?.meetSpace, linkSource: old?.linkSource,
    },
  });
  if (old) {
    const late = old.status === "CONFIRMED" && old.startsAt.getTime() - Date.now() < match.track.cancelWindowHours * 3600_000;
    await db.session.update({ where: { id: old.id }, data: { status: "CANCELLED", cancelReason: `Rescheduled${str(fd, "reason") ? `: ${str(fd, "reason")}` : ""}`, cancelledById: user.id, lateCancel: late } });
  }
  const other = user.id === match.menteeId ? match.mentor : match.mentee;
  await notify(other.id, {
    type: "session_proposed",
    title: old ? `${user.name} asked to move your session` : `${user.name} proposed a session`,
    body: `${fmtDateTime(startsAt, other.timezone)} (${slot.minutes} minutes)${session.topic ? `\nTopic: ${session.topic}` : ""}\n\nPlease confirm or suggest another time.`,
    href: `/sessions/${session.id}`, cta: "Confirm session",
  });
  await audit(user, old ? "session.reschedule" : "session.propose", `${match.mentee.name} ↔ ${match.mentor.name}`, startsAt.toISOString());
  return done(old ? "New time proposed" : "Session proposed", `/sessions/${session.id}`);
});

export const confirmSessionAction = safe(async (sessionId: string) => {
  const ctx = await sessionCtx(sessionId);
  if (!ctx) return fail("That session no longer exists.");
  if (ctx.session.status !== "PROPOSED") return fail("This session is not waiting for confirmation.");
  if (ctx.member && ctx.session.proposedById === ctx.user.id) return fail("Your partner needs to confirm this time.");
  if (ctx.session.startsAt < new Date()) return fail("This time has already passed.");
  await confirmSession(sessionId, ctx.user);
  return done("Session confirmed");
});

export const cancelSession = safe(async (sessionId: string, fd: FormData) => {
  const ctx = await sessionCtx(sessionId);
  if (!ctx) return fail("That session no longer exists.");
  const { session: s, match, user } = ctx;
  if (!["PROPOSED", "CONFIRMED"].includes(s.status)) return fail("This session can no longer be cancelled.");
  const reason = str(fd, "reason").slice(0, 300);
  if (!reason) return fail("Please choose a reason.");
  const late = s.status === "CONFIRMED" && s.startsAt.getTime() - Date.now() < match.track.cancelWindowHours * 3600_000;
  await db.session.update({ where: { id: s.id }, data: { status: "CANCELLED", cancelReason: reason, cancelledById: user.id, lateCancel: late } });
  for (const u of [match.mentee, match.mentor]) {
    if (u.id === user.id) continue;
    await notify(u.id, { type: "session_cancelled", title: `Session cancelled: ${fmtDateTime(s.startsAt, u.timezone)}`, body: `${user.name} cancelled this session.\nReason: ${reason}\n\nYou can book a new time whenever you are ready.`, href: `/sessions/book?pair=${match.id}`, cta: "Book a new time" });
  }
  await audit(user, "session.cancel", `${match.mentee.name} ↔ ${match.mentor.name}`, `${reason}${late ? " (late)" : ""}`);
  return done(late ? "Session cancelled. This counts as a late cancellation." : "Session cancelled", `/pairs/${match.id}`);
});

export const setMeetingLink = safe(async (sessionId: string, fd: FormData) => {
  const ctx = await sessionCtx(sessionId);
  if (!ctx) return fail("That session no longer exists.");
  const url = str(fd, "joinUrl");
  if (!validMeetingUrl(url)) return fail("Paste a Google Meet link that starts with https://meet.google.com/");
  await db.session.update({ where: { id: sessionId }, data: { joinUrl: url, linkSource: "manual" } });
  const other = ctx.user.id === ctx.match.menteeId ? ctx.match.mentor : ctx.match.mentee;
  if (ctx.member) await notify(other.id, { type: "link_added", title: "Meeting link added to your session", body: `Join link: ${url}`, href: `/sessions/${sessionId}`, email: false });
  return done("Meeting link saved");
});

export const saveNotes = safe(async (sessionId: string, fd: FormData) => {
  const ctx = await sessionCtx(sessionId);
  if (!ctx || !ctx.member) return fail("Only the pair can edit session notes.");
  if (!(await getSettings()).modules.notes) return fail("Session notes are switched off.");
  const data: { sharedNotes?: string; privateNotes?: string; agenda?: string; notesUpdatedAt: Date } = { notesUpdatedAt: new Date() };
  if (fd.has("sharedNotes")) data.sharedNotes = str(fd, "sharedNotes").slice(0, 8000);
  if (fd.has("agenda")) data.agenda = str(fd, "agenda").slice(0, 1500);
  if (ctx.isMentor && fd.has("privateNotes")) data.privateNotes = str(fd, "privateNotes").slice(0, 8000);
  await db.session.update({ where: { id: sessionId }, data });
  return done("Notes saved");
});

export const logOutcome = safe(async (sessionId: string, status: "HELD" | "NO_SHOW_MENTEE" | "NO_SHOW_MENTOR") => {
  const ctx = await sessionCtx(sessionId);
  if (!ctx) return fail("That session no longer exists.");
  const { session: s, user, isMentee } = ctx;
  if (!["CONFIRMED", "HELD", "NO_SHOW_MENTEE", "NO_SHOW_MENTOR"].includes(s.status)) return fail("Only confirmed sessions can be logged.");
  if (s.startsAt > new Date()) return fail("You can log this once the session has started.");
  if (isMentee && status === "NO_SHOW_MENTEE") return fail("You cannot mark yourself as absent. Cancel the session instead.");
  if (ctx.isMentor && status === "NO_SHOW_MENTOR") return fail("You cannot mark yourself as absent. Cancel the session instead.");
  await recordOutcome(sessionId, status, user);
  return done(status === "HELD" ? "Marked as held. Nice work!" : "Marked as a no-show");
});

export const addActionItem = safe(async (matchId: string, fd: FormData) => {
  const { user, match, member } = await pair(matchId);
  if (!member) return fail("Only the pair can add action items.");
  const text = str(fd, "text").slice(0, 240);
  if (!text) return fail("Write what needs doing.");
  const owner = str(fd, "ownerId") === match.mentorId ? match.mentorId : match.menteeId;
  const due = str(fd, "dueDate");
  await db.actionItem.create({ data: { matchId, sessionId: str(fd, "sessionId") || null, ownerId: owner, text, dueDate: due ? new Date(`${due}T12:00:00Z`) : null } });
  if (owner !== user.id) await notify(owner, { type: "action_item", title: "New action item", body: text, href: `/pairs/${matchId}`, email: false });
  return done("Action item added");
});

export const toggleActionItem = safe(async (itemId: string) => {
  const item = await db.actionItem.findUnique({ where: { id: itemId } });
  if (!item) return fail("That item no longer exists.");
  const { member } = await pair(item.matchId);
  if (!member) return fail("Only the pair can update action items.");
  await db.actionItem.update({ where: { id: itemId }, data: { done: !item.done } });
  return done();
});

export const submitFeedback = safe(async (sessionId: string, fd: FormData) => {
  const ctx = await sessionCtx(sessionId);
  if (!ctx || !ctx.member) return fail("Only the pair can give feedback on a session.");
  if (ctx.session.status !== "HELD") return fail("Feedback opens once the session is marked as held.");
  const scores = ["usefulness", "preparedness", "connection"].map((k) => int(fd, k, 0));
  if (scores.some((n) => n < 1 || n > 5)) return fail("Please give all three ratings.");
  const comment = str(fd, "comment").slice(0, 1000) || null;
  const flagged = Math.min(...scores) <= 2 || /unsafe|harass|uncomfortable|threat|scared|inappropriate/i.test(comment ?? "");
  const exists = await db.feedback.findUnique({ where: { sessionId_authorId: { sessionId, authorId: ctx.user.id } } });
  if (exists) return fail("You have already given feedback for this session.");
  await db.feedback.create({ data: { sessionId, authorId: ctx.user.id, usefulness: scores[0], preparedness: scores[1], connection: scores[2], comment, flagged } });
  if (flagged) {
    await notifyAdmins({ type: "feedback_flag", title: `Low session rating from ${ctx.user.name}`, body: `Ratings: ${scores.join(", ")} out of 5.${comment ? `\n"${comment}"` : ""}`, href: `/pairs/${ctx.match.id}` }, ctx.match.trackId);
  }
  return done("Thank you. Your feedback is in.");
});

export const overrideAttendance = safe(async (sessionId: string, userId: string, fd: FormData) => {
  const s = await db.session.findUnique({ where: { id: sessionId }, include: { match: true } });
  if (!s) return fail("That session no longer exists.");
  const user = await staff(s.match.trackId);
  const status = str(fd, "status");
  const reason = str(fd, "reason");
  if (!["PRESENT", "LATE", "LEFT_EARLY", "ABSENT"].includes(status)) return fail("Choose a result.");
  if (reason.length < 3) return fail("Give a reason for the override.");
  if (![s.match.menteeId, s.match.mentorId].includes(userId)) return fail("That person is not in this session.");
  const data = { status, source: "OVERRIDE", overrideReason: reason, overriddenById: user.id, minutes: status === "ABSENT" ? 0 : s.durationMin };
  await db.attendance.upsert({ where: { sessionId_userId: { sessionId, userId } }, create: { sessionId, userId, ...data }, update: data });
  await audit(user, "attendance.override", sessionId, `${status}: ${reason}`);
  return done("Attendance updated");
});
