import { db } from "./db";

const partner = { select: { id: true, name: true, avatar: true, headline: true, timezone: true, email: true, level: true, faculty: true } } as const;

/** Pairs this person is in (as mentee or mentor), newest first. */
export function myPairs(userId: string, statuses = ["ACTIVE", "PAUSED"]) {
  return db.match.findMany({
    where: { status: { in: statuses }, OR: [{ menteeId: userId }, { mentorId: userId }] },
    include: {
      mentee: partner, mentor: partner, track: true, cohort: true,
      sessions: { orderBy: { startsAt: "asc" }, include: { feedback: { select: { authorId: true, usefulness: true, preparedness: true, connection: true } } } },
    },
    orderBy: { startedAt: "desc" },
  });
}

export function mySessions(userId: string, where: object = {}) {
  return db.session.findMany({
    where: { match: { OR: [{ menteeId: userId }, { mentorId: userId }] }, ...where },
    include: { match: { include: { mentee: partner, mentor: partner, track: true } }, feedback: { select: { authorId: true } } },
    orderBy: { startsAt: "asc" },
  });
}

export type PairRow = Awaited<ReturnType<typeof myPairs>>[number];
export type SessionRow = Awaited<ReturnType<typeof mySessions>>[number];
export const otherOf = (m: { menteeId: string; mentee: PairRow["mentee"]; mentor: PairRow["mentor"] }, userId: string) => (m.menteeId === userId ? m.mentor : m.mentee);
