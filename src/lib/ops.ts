import { audit } from "./audit";
import { db } from "./db";
import { createMeetLink } from "./meet";
import { notify, notifyAdmins } from "./notify";
import { fmtDateTime } from "./time";

type Actor = { id: string; name: string } | null;

/** Makes a pair active, closes the mentee's other open requests in that track, and introduces both people. */
export async function activateMatch(
  input: { menteeId: string; mentorId: string; cohortId: string; trackId: string; score?: number; reasons?: string[]; existingId?: string },
  actor: Actor,
) {
  const now = new Date();
  const data = { status: "ACTIVE", startedAt: now, respondedAt: now, score: input.score, reasons: JSON.stringify(input.reasons ?? []) };
  const existing = input.existingId
    ? await db.match.findUnique({ where: { id: input.existingId } })
    : await db.match.findFirst({ where: { menteeId: input.menteeId, mentorId: input.mentorId, cohortId: input.cohortId, trackId: input.trackId, status: { in: ["REQUESTED", "SUGGESTED"] } } });
  const match = existing
    ? await db.match.update({ where: { id: existing.id }, data: { ...data, score: input.score ?? existing.score, reasons: input.reasons ? data.reasons : existing.reasons } })
    : await db.match.create({ data: { ...data, menteeId: input.menteeId, mentorId: input.mentorId, cohortId: input.cohortId, trackId: input.trackId, createdById: actor?.id } });
  await db.match.updateMany({
    where: { id: { not: match.id }, menteeId: input.menteeId, cohortId: input.cohortId, trackId: input.trackId, status: { in: ["REQUESTED", "SUGGESTED"] } },
    data: { status: "EXPIRED", respondedAt: now, endReason: "Paired with another mentor" },
  });
  await db.mentorRanking.deleteMany({ where: { menteeId: input.menteeId, cohortId: input.cohortId, trackId: input.trackId } });
  const [mentee, mentor, track] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: input.menteeId } }),
    db.user.findUniqueOrThrow({ where: { id: input.mentorId } }),
    db.track.findUniqueOrThrow({ where: { id: input.trackId } }),
  ]);
  const agenda = "A good first session: introduce yourselves, share what you each hope for, agree how often to meet, and pick one thing to work on first.";
  await notify(mentee.id, { type: "match_confirmed", title: `You are paired with ${mentor.name}`, body: `${mentor.name} is your mentor in ${track.name}. ${agenda}`, href: `/pairs/${match.id}`, cta: "Book your first session" });
  await notify(mentor.id, { type: "match_confirmed", title: `New mentee: ${mentee.name}`, body: `${mentee.name} has been paired with you in ${track.name}. ${agenda}`, href: `/pairs/${match.id}`, cta: "Open pair space" });
  await audit(actor, "match.activate", `${mentee.name} ↔ ${mentor.name}`, track.name);
  return match;
}

/** Ends or pauses a pair and cancels its future sessions. */
export async function closeMatch(matchId: string, status: "ENDED" | "PAUSED", reason: string, actor: Actor) {
  const match = await db.match.update({
    where: { id: matchId },
    data: { status, endReason: reason, endedAt: status === "ENDED" ? new Date() : null },
    include: { mentee: true, mentor: true },
  });
  await db.session.updateMany({
    where: { matchId, status: { in: ["PROPOSED", "CONFIRMED"] }, startsAt: { gt: new Date() } },
    data: { status: "CANCELLED", cancelReason: status === "ENDED" ? "Pair ended" : "Pair paused", cancelledById: actor?.id },
  });
  const verb = status === "ENDED" ? "ended" : "paused";
  for (const u of [match.mentee, match.mentor]) {
    await notify(u.id, { type: "match_changed", title: `Your pairing has been ${verb}`, body: `Your pairing (${match.mentee.name} and ${match.mentor.name}) has been ${verb}. Upcoming sessions were cancelled. The program team will follow up if anything else is needed.`, href: "/home" });
  }
  await audit(actor, `match.${verb}`, `${match.mentee.name} ↔ ${match.mentor.name}`, reason);
  return match;
}

/** Confirms a session and attaches a meeting link (Google Meet, the pair's fixed room, or none yet). */
export async function confirmSession(sessionId: string, actor: Actor) {
  const s = await db.session.findUniqueOrThrow({ where: { id: sessionId }, include: { match: { include: { mentee: true, mentor: true } } } });
  const link = s.joinUrl ? null : await createMeetLink(s.match.fixedMeetUrl);
  const updated = await db.session.update({
    where: { id: s.id },
    data: { status: "CONFIRMED", ...(link ? { joinUrl: link.joinUrl, meetCode: link.meetCode, meetSpace: link.space, linkSource: link.source } : {}) },
  });
  for (const u of [s.match.mentee, s.match.mentor]) {
    const other = u.id === s.match.menteeId ? s.match.mentor : s.match.mentee;
    await notify(u.id, {
      type: "session_confirmed",
      title: `Session confirmed with ${other.name}`,
      body: `${fmtDateTime(s.startsAt, u.timezone)} (${s.durationMin} minutes)${s.topic ? `\nTopic: ${s.topic}` : ""}\n\n${updated.joinUrl ? `Meeting link: ${updated.joinUrl}` : "The meeting link will be added before the session."}\n\nYou can add it to your calendar from the session page.`,
      href: `/sessions/${s.id}`, cta: "View session",
    });
  }
  if (!updated.joinUrl) {
    await notify(s.match.mentorId, { type: "link_needed", title: "Add a meeting link", body: `The session on ${fmtDateTime(s.startsAt, s.match.mentor.timezone)} has no Google Meet link yet. Create one in Google Meet and paste it on the session page.`, href: `/sessions/${s.id}`, email: false });
  }
  await audit(actor, "session.confirm", `${s.match.mentee.name} ↔ ${s.match.mentor.name}`, s.startsAt.toISOString());
  return updated;
}

/** Records the outcome of a session and derives attendance from join clicks. */
export async function recordOutcome(sessionId: string, status: "HELD" | "NO_SHOW_MENTEE" | "NO_SHOW_MENTOR", actor: Actor, source = "MANUAL") {
  const s = await db.session.findUniqueOrThrow({ where: { id: sessionId }, include: { match: { include: { track: true, mentee: true, mentor: true } }, joins: true } });
  await db.session.update({ where: { id: s.id }, data: { status, outcomeAt: new Date() } });
  const late = s.match.track.lateMinutes * 60_000;
  for (const uid of [s.match.menteeId, s.match.mentorId]) {
    const first = s.joins.filter((j) => j.userId === uid).sort((a, b) => +a.at - +b.at)[0];
    const absent = (status === "NO_SHOW_MENTEE" && uid === s.match.menteeId) || (status === "NO_SHOW_MENTOR" && uid === s.match.mentorId);
    const st = absent ? "ABSENT" : first && first.at.getTime() > s.startsAt.getTime() + late ? "LATE" : "PRESENT";
    const existing = await db.attendance.findUnique({ where: { sessionId_userId: { sessionId: s.id, userId: uid } } });
    if (existing?.source === "OVERRIDE") continue;
    const data = { status: st, joinedAt: first?.at ?? null, minutes: absent ? 0 : s.durationMin, source: first ? "JOIN_CLICK" : source };
    await db.attendance.upsert({ where: { sessionId_userId: { sessionId: s.id, userId: uid } }, create: { sessionId: s.id, userId: uid, ...data }, update: data });
  }
  if (status !== "HELD") {
    const missing = status === "NO_SHOW_MENTEE" ? s.match.mentee : s.match.mentor;
    const streak = await db.session.findMany({ where: { matchId: s.matchId, startsAt: { lte: s.startsAt }, status: { in: ["HELD", "NO_SHOW_MENTEE", "NO_SHOW_MENTOR"] } }, orderBy: { startsAt: "desc" }, take: 2 });
    await notify(missing.id, { type: "no_show", title: "We missed you at your session", body: "Your session was marked as missed. If something came up, let your partner know and book a new time.", href: `/pairs/${s.matchId}` });
    if (streak.length === 2 && streak.every((x) => x.status === status)) {
      await notifyAdmins({ type: "no_show_alert", title: `Two missed sessions in a row: ${missing.name}`, body: `${missing.name} missed two sessions in a row with ${missing.id === s.match.menteeId ? s.match.mentor.name : s.match.mentee.name}.`, href: `/pairs/${s.matchId}` }, s.match.trackId);
    }
  }
  await audit(actor, "session.outcome", `${s.match.mentee.name} ↔ ${s.match.mentor.name}`, status);
}
