import { requireStaff } from "./auth";
import { db } from "./db";
import { pairHealth } from "./health";
import { currentCohort, trackScope } from "./scope";

/** Everything an admin page needs to know about who is looking and at which cohort. */
export async function adminCtx() {
  const user = await requireStaff();
  const [{ cohort, cohorts }, scope] = await Promise.all([currentCohort(), trackScope(user)]);
  const tracks = cohort
    ? await db.track.findMany({ where: { cohorts: { some: { cohortId: cohort.id } }, status: { not: "ARCHIVED" }, ...(scope ? { id: { in: scope } } : {}) }, orderBy: [{ area: "asc" }, { name: "asc" }] })
    : [];
  return { user, cohort, cohorts, scope, tracks, trackIds: tracks.map((t) => t.id) };
}

/** Pairs in a cohort with their health score. */
export async function cohortPairs(cohortId: string, trackIds: string[], statuses = ["ACTIVE", "PAUSED"]) {
  const pairs = await db.match.findMany({
    where: { cohortId, trackId: { in: trackIds }, status: { in: statuses } },
    include: {
      mentee: { select: { id: true, name: true, avatar: true } }, mentor: { select: { id: true, name: true, avatar: true } }, track: { select: { name: true } },
      sessions: { include: { feedback: { select: { usefulness: true, preparedness: true, connection: true } } } },
    },
    orderBy: { startedAt: "desc" },
  });
  const now = new Date();
  return pairs.map((p) => ({ ...p, health: pairHealth(p, now) }));
}

/** Where each person in the cohort is on the way from invite to first session. */
export async function onboardingFunnel(cohortId: string, trackIds: string[]) {
  const members = await db.membership.findMany({
    where: { cohortId, trackId: { in: trackIds }, status: { not: "REMOVED" }, user: { status: { not: "REMOVED" } } },
    include: { user: { select: { id: true, status: true, firstSignInAt: true, onboardedAt: true, role: true } } },
  });
  const matches = await db.match.findMany({ where: { cohortId, trackId: { in: trackIds }, status: { in: ["ACTIVE", "PAUSED"] } }, select: { menteeId: true, mentorId: true, trackId: true, sessions: { where: { status: "HELD" }, select: { id: true }, take: 1 } } });
  const mentees = members.filter((m) => m.role === "MENTEE");
  const mentors = members.filter((m) => m.role === "MENTOR");
  const uniq = <T extends { user: { id: string } }>(a: T[]) => [...new Map(a.map((x) => [x.user.id, x])).values()];
  const paired = new Set(matches.map((m) => `${m.menteeId}:${m.trackId}`));
  const met = new Set(matches.filter((m) => m.sessions.length).map((m) => `${m.menteeId}:${m.trackId}`));
  const um = uniq(mentees), ut = uniq(mentors);
  return {
    mentees: {
      invited: um.length,
      signedIn: um.filter((m) => m.user.firstSignInAt).length,
      onboarded: um.filter((m) => m.user.onboardedAt).length,
      seats: mentees.length,
      paired: mentees.filter((m) => paired.has(`${m.userId}:${m.trackId}`)).length,
      met: mentees.filter((m) => met.has(`${m.userId}:${m.trackId}`)).length,
    },
    mentors: { invited: ut.length, signedIn: ut.filter((m) => m.user.firstSignInAt).length, onboarded: ut.filter((m) => m.user.onboardedAt).length },
    unassigned: mentees.filter((m) => !paired.has(`${m.userId}:${m.trackId}`) && m.user.onboardedAt).length,
  };
}

export const pct = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
