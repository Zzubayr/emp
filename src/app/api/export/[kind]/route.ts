import { audit } from "@/lib/audit";
import { getUser, isStaffRole } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { db } from "@/lib/db";
import { pairHealth } from "@/lib/health";
import { currentCohort, trackScope } from "@/lib/scope";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : "");

export async function GET(_: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const user = await getUser();
  if (!user || !isStaffRole(user.role)) return new Response("Not allowed", { status: 403 });
  const [{ cohort }, scope] = await Promise.all([currentCohort(), trackScope(user)]);
  if (!cohort) return new Response("No cohort", { status: 404 });
  const inMatch = { cohortId: cohort.id, ...(scope ? { trackId: { in: scope } } : {}) };
  let rows: (string | number | null | undefined)[][];

  if (kind === "people") {
    const ms = await db.membership.findMany({ where: inMatch, include: { user: true, track: true }, orderBy: { user: { name: "asc" } } });
    rows = [["name", "email", "role", "track", "level", "faculty", "student_id", "status", "invited_at", "first_sign_in", "profile_finished"], ...ms.map((m) => [m.user.name, m.user.email, m.role, m.track.name, m.user.level, m.user.faculty, m.user.studentId, m.user.status, iso(m.user.invitedAt), iso(m.user.firstSignInAt), iso(m.user.onboardedAt)])];
  } else if (kind === "pairs") {
    const ps = await db.match.findMany({ where: { ...inMatch, status: { in: ["ACTIVE", "PAUSED", "ENDED"] } }, include: { mentee: true, mentor: true, track: true, sessions: { include: { feedback: true } } } });
    rows = [["mentee", "mentee_email", "mentor", "mentor_email", "track", "status", "paired_on", "sessions_held", "no_shows", "health_score", "health_band"], ...ps.map((p) => { const h = pairHealth(p); return [p.mentee.name, p.mentee.email, p.mentor.name, p.mentor.email, p.track.name, p.status, iso(p.startedAt), p.sessions.filter((s) => s.status === "HELD").length, p.sessions.filter((s) => s.status.startsWith("NO_SHOW")).length, h.score, h.band]; })];
  } else if (kind === "sessions" || kind === "attendance") {
    const ss = await db.session.findMany({ where: { match: inMatch }, include: { match: { include: { mentee: true, mentor: true, track: true } }, attendance: true, joins: { orderBy: { at: "asc" } } }, orderBy: { startsAt: "asc" } });
    if (kind === "sessions") rows = [["starts_at_utc", "minutes", "status", "track", "mentee", "mentor", "topic", "late_cancel", "cancel_reason"], ...ss.map((s) => [iso(s.startsAt), s.durationMin, s.status, s.match.track.name, s.match.mentee.name, s.match.mentor.name, s.topic, s.lateCancel ? "yes" : "", s.cancelReason])];
    else rows = [["session_start_utc", "track", "person", "email", "role", "result", "first_join_click_utc", "all_join_clicks_utc", "source", "override_reason"], ...ss.flatMap((s) => s.attendance.map((a) => { const u = a.userId === s.match.menteeId ? s.match.mentee : s.match.mentor; const j = s.joins.filter((x) => x.userId === a.userId); return [iso(s.startsAt), s.match.track.name, u.name, u.email, a.userId === s.match.menteeId ? "mentee" : "mentor", a.status, iso(j[0]?.at), j.map((x) => iso(x.at)).join(" "), a.source, a.overrideReason]; }))];
  } else if (kind === "mentors") {
    const ms = await db.user.findMany({ where: { memberships: { some: { ...inMatch, role: "MENTOR" } } }, include: { mentorMatches: { where: inMatch, include: { sessions: { include: { feedback: true } } } } } });
    rows = [["mentor", "email", "active_mentees", "sessions_held", "verified_hours", "no_shows_by_mentor", "avg_rating_received"], ...ms.map((m) => { const ses = m.mentorMatches.flatMap((x) => x.sessions); const held = ses.filter((s) => s.status === "HELD"); const fb = held.flatMap((s) => s.feedback.filter((f) => f.authorId !== m.id)); return [m.name, m.email, m.mentorMatches.filter((x) => x.status === "ACTIVE").length, held.length, (held.reduce((n, s) => n + s.durationMin, 0) / 60).toFixed(1), ses.filter((s) => s.status === "NO_SHOW_MENTOR").length, fb.length ? (fb.reduce((n, f) => n + (f.usefulness + f.preparedness + f.connection) / 3, 0) / fb.length).toFixed(2) : ""]; })];
  } else if (kind === "feedback") {
    const fb = await db.feedback.findMany({ where: { session: { match: inMatch } }, include: { author: true, session: { include: { match: { include: { track: true } } } } }, orderBy: { createdAt: "asc" } });
    rows = [["submitted_utc", "track", "author", "author_role", "usefulness", "preparedness", "connection", "flagged", "comment"], ...fb.map((f) => [iso(f.createdAt), f.session.match.track.name, f.author.name, f.authorId === f.session.match.menteeId ? "mentee" : "mentor", f.usefulness, f.preparedness, f.connection, f.flagged ? "yes" : "", f.comment])];
  } else return new Response("Unknown export", { status: 404 });

  await audit(user, "data.export", kind, `${rows.length - 1} rows · ${cohort.name}`);
  return new Response(toCsv(rows), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="emp-${kind}-${cohort.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv"` } });
}
