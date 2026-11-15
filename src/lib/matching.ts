import { parseList } from "./constants";
import { db } from "./db";
import { getSettings } from "./settings";
import { weeklyOverlapMinutes } from "./slots";
import { tzOffset } from "./time";

type U = {
  id: string; name: string; timezone: string; interests: string; expertise: string; languages: string;
  faculty: string | null; level: string | null; capacity: number;
  availability: { weekday: number; startMin: number; endMin: number }[];
};

export type Suggestion = { mentorId: string; score: number; reasons: string[]; spots: number };

export function scorePair(mentee: U, mentor: U, spots: number, cap: number, w: { fit: number; availability: number; language: number; preference: number; capacity: number }) {
  const want = new Set([...parseList(mentee.interests)].map((x) => x.toLowerCase()));
  const has = parseList(mentor.expertise);
  const shared = has.filter((x) => want.has(x.toLowerCase()));
  const fit = want.size ? Math.min(1, shared.length / Math.min(3, want.size)) : 0.5;

  const overlap = weeklyOverlapMinutes(mentee, mentor);
  const avail = Math.min(1, overlap / 240);

  const ml = new Set(parseList(mentee.languages));
  const sharedLang = parseList(mentor.languages).filter((l) => ml.has(l));
  const now = new Date();
  const tzGap = Math.abs(tzOffset(now, mentee.timezone) - tzOffset(now, mentor.timezone)) / 60;
  const lang = (sharedLang.length ? 0.6 : 0) + 0.4 * Math.max(0, 1 - tzGap / 8);

  const pref = mentee.faculty && mentee.faculty === mentor.faculty ? 1 : 0.4;
  const capS = cap > 0 ? Math.min(1, spots / cap) : 0;

  const total = w.fit + w.availability + w.language + w.preference + w.capacity || 1;
  const score = Math.round((100 * (w.fit * fit + w.availability * avail + w.language * lang + w.preference * pref + w.capacity * capS)) / total);

  const reasons: [number, string][] = [
    [w.fit * fit, shared.length ? `Shares ${shared.slice(0, 3).join(", ")}` : "General fit for the track"],
    [w.availability * avail, overlap >= 60 ? `${Math.round(overlap / 60)} hours of overlapping availability a week` : "Limited overlapping availability"],
    [w.language * lang, sharedLang.length ? `Both speak ${sharedLang[0]}${tzGap < 1 ? ", same time zone" : ""}` : "Different languages listed"],
    [w.preference * pref, pref === 1 ? `Same faculty (${mentor.faculty})` : "Different faculty"],
    [w.capacity * capS, `${spots} of ${cap} spots open`],
  ];
  return { score, reasons: reasons.sort((a, b) => b[0] - a[0]).slice(0, 3).map((r) => r[1]) };
}

const userSelect = {
  id: true, name: true, timezone: true, interests: true, expertise: true, languages: true,
  faculty: true, level: true, capacity: true, availability: { select: { weekday: true, startMin: true, endMin: true } },
} as const;

/** Mentors in a track and cohort who can take mentees, with spots left. */
export async function trackMentors(cohortId: string, trackId: string) {
  const s = await getSettings();
  const track = await db.track.findUniqueOrThrow({ where: { id: trackId } });
  const members = await db.membership.findMany({
    where: { cohortId, trackId, role: "MENTOR", status: "ACTIVE", user: { status: { in: ["ACTIVE", "INVITED"] } } },
    include: { user: { include: { availability: true, mentorMatches: { where: { cohortId, status: { in: ["ACTIVE", "PAUSED"] } }, select: { trackId: true } } } } },
  });
  return members
    .filter((m) => !s.requireMentorApproval || m.user.approvedAt)
    .filter((m) => !m.user.pausedUntil || m.user.pausedUntil < new Date())
    .map((m) => {
      const all = m.user.mentorMatches.length;
      const inTrack = m.user.mentorMatches.filter((x) => x.trackId === trackId).length;
      const cap = Math.min(m.user.capacity, track.maxMenteesPerMentor);
      const spots = Math.max(0, Math.min(m.user.capacity - all, track.maxMenteesPerMentor - inTrack));
      return { user: m.user, spots, cap };
    });
}

export async function suggestionsFor(menteeId: string, cohortId: string, trackId: string): Promise<Suggestion[]> {
  const s = await getSettings();
  const mentee = await db.user.findUniqueOrThrow({ where: { id: menteeId }, select: userSelect });
  const mentors = await trackMentors(cohortId, trackId);
  const excluded = new Set((await db.exclusion.findMany({ where: { menteeId } })).map((e) => e.mentorId));
  const past = new Set((await db.match.findMany({ where: { menteeId, status: { in: ["ENDED", "DECLINED"] } }, select: { mentorId: true } })).map((m) => m.mentorId));
  return mentors
    .filter((m) => m.spots > 0 && !excluded.has(m.user.id) && !past.has(m.user.id) && m.user.id !== menteeId)
    .map((m) => ({ mentorId: m.user.id, spots: m.spots, ...scorePair(mentee, m.user, m.spots, m.cap, s.weights) }))
    .sort((a, b) => b.score - a.score);
}

/** Mentees in a track and cohort with no active or paused pair. */
export async function unmatchedMentees(cohortId: string, trackId: string) {
  const members = await db.membership.findMany({
    where: { cohortId, trackId, role: "MENTEE", status: "ACTIVE", user: { status: { in: ["ACTIVE", "INVITED"] } } },
    include: { user: { include: { menteeMatches: { where: { cohortId, trackId, status: { in: ["ACTIVE", "PAUSED"] } }, select: { id: true } } } } },
  });
  return members.filter((m) => m.user.menteeMatches.length === 0).map((m) => m.user);
}

/**
 * Rank and allocate: serial dictatorship in random order over each student's ranked choices,
 * then best-score fill for anyone left. Returns [menteeId, mentorId, score, reasons].
 */
export async function allocate(cohortId: string, trackId: string, useRanks: boolean) {
  const mentees = await unmatchedMentees(cohortId, trackId);
  const mentors = await trackMentors(cohortId, trackId);
  const spots = new Map(mentors.map((m) => [m.user.id, m.spots]));
  const ranks = useRanks ? await db.mentorRanking.findMany({ where: { cohortId, trackId }, orderBy: { rank: "asc" } }) : [];
  const order = [...mentees].sort(() => Math.random() - 0.5);
  const out: { menteeId: string; mentorId: string; score: number; reasons: string[] }[] = [];
  for (const mentee of order) {
    const sug = await suggestionsFor(mentee.id, cohortId, trackId);
    const byId = new Map(sug.map((x) => [x.mentorId, x]));
    const prefs = ranks.filter((r) => r.menteeId === mentee.id).map((r) => r.mentorId);
    const pick = [...prefs, ...sug.map((x) => x.mentorId)].find((id) => (spots.get(id) ?? 0) > 0 && byId.has(id));
    if (!pick) continue;
    spots.set(pick, (spots.get(pick) ?? 0) - 1);
    const sg = byId.get(pick)!;
    out.push({ menteeId: mentee.id, mentorId: pick, score: sg.score, reasons: prefs.includes(pick) ? [`Ranked choice ${prefs.indexOf(pick) + 1}`, ...sg.reasons.slice(0, 2)] : sg.reasons });
  }
  return out;
}
