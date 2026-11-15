// Demo data: two cohorts, ten tracks, mentors, mentees, pairs, sessions and feedback.
// Run with `npm run db:seed`. Safe to re-run: it wipes and rebuilds the database.
import { PrismaClient } from "@prisma/client";
import { DEFAULT_RULES } from "../src/lib/reminders";
import { FACULTIES, INTEREST_TAGS } from "../src/lib/constants";

const db = new PrismaClient();
let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
const some = <T,>(a: readonly T[], n: number) => [...a].sort(() => rnd() - 0.5).slice(0, n);
const DAY = 86400_000;
const now = Date.now();

const FIRST = ["Amara", "Chidi", "Fatima", "Tunde", "Ngozi", "Ibrahim", "Kemi", "Emeka", "Zainab", "Seun", "Aisha", "Bolu", "Halima", "Dayo", "Ifeoma", "Musa", "Tolu", "Uche", "Hauwa", "Femi", "Adaeze", "Yusuf", "Simi", "Kunle", "Maryam", "Obinna", "Rukayat", "Segun", "Chiamaka", "Abdul", "Funke", "Nnamdi", "Khadija", "Wale", "Blessing", "Sani", "Titi", "Ikenna", "Bisi", "Garba"];
const LAST = ["Okafor", "Bello", "Adeyemi", "Eze", "Abubakar", "Ogunleye", "Nwosu", "Lawal", "Okonkwo", "Balogun", "Ibrahim", "Adebayo", "Chukwu", "Yusuf", "Olawale", "Umeh", "Sule", "Afolabi", "Obi", "Mohammed"];
const HEADLINES = ["Software engineer at a fintech", "Product designer", "Final-year student and class rep", "Data analyst", "Graduate assistant", "Founder of a campus startup", "HR and careers advisor", "Cybersecurity analyst", "Research fellow", "Brand and content lead"];

const TRACKS = [
  { name: "100 Level", area: "ACADEMIC", icon: "GraduationCap", mode: "SUGGEST", desc: "Settling into university: study habits, course choices and finding your feet." },
  { name: "200 Level", area: "ACADEMIC", icon: "BookOpen", mode: "SUGGEST", desc: "Building depth in your course and planning ahead." },
  { name: "300 Level", area: "ACADEMIC", icon: "BookOpen", mode: "SUGGEST", desc: "Internships, industrial training and specialisation." },
  { name: "400 Level", area: "ACADEMIC", icon: "GraduationCap", mode: "ADMIN", desc: "Final-year project, graduation and what comes next." },
  { name: "Tech", area: "NON_ACADEMIC", icon: "Code", mode: "REQUEST", desc: "Software, data, product, cybersecurity and learning to code." },
  { name: "Design", area: "NON_ACADEMIC", icon: "Palette", mode: "PICK", desc: "UI and UX, graphic design, branding and portfolios." },
  { name: "Life Skills", area: "NON_ACADEMIC", icon: "Leaf", mode: "REQUEST", desc: "Time management, communication, personal finance and confidence." },
  { name: "Career and Employability", area: "NON_ACADEMIC", icon: "Briefcase", mode: "RANK", desc: "CVs, interviews, internships, LinkedIn and your first job." },
  { name: "Entrepreneurship and Business", area: "NON_ACADEMIC", icon: "Rocket", mode: "REQUEST", desc: "Ideas, startups, side businesses and pitching." },
  { name: "Leadership and Student Life", area: "NON_ACADEMIC", icon: "Users", mode: "REQUEST", desc: "Running clubs, teamwork, public speaking and campus involvement." },
] as const;

async function main() {
  for (const t of ["reminderLog", "auditLog", "emailMessage", "notification", "caseNote", "safetyCase", "attendance", "joinEvent", "feedback", "actionItem", "session", "mentorRanking", "exclusion", "match", "membership", "cohortTrack", "availabilityRule", "authSession", "otpChallenge", "consent", "track", "cohort", "user", "setting", "reminderRule"] as const) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic model access for a wipe
    await (db as any)[t].deleteMany();
  }
  for (const r of DEFAULT_RULES) {
    await db.reminderRule.create({ data: { key: r.key, label: r.label, audience: r.audience, offsets: JSON.stringify(r.offsets), subject: r.subject, body: r.body } });
  }

  const done = { status: "ACTIVE", termsAcceptedAt: new Date(now - 60 * DAY), onboardedAt: new Date(now - 60 * DAY), firstSignInAt: new Date(now - 60 * DAY), invitedAt: new Date(now - 62 * DAY), inviteCount: 1, approvedAt: new Date(now - 60 * DAY) };
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@emp.local").toLowerCase();
  const admin = await db.user.create({ data: { email: adminEmail, name: "Program Admin", role: "SUPER_ADMIN", avatar: 0, ...done } });
  const coord = await db.user.create({ data: { email: "coordinator@emp.local", name: "Grace Okafor", role: "COORDINATOR", avatar: 4, ...done } });

  const tracks = [];
  for (const t of TRACKS) {
    tracks.push(await db.track.create({
      data: {
        name: t.name, area: t.area, icon: t.icon, assignmentMode: t.mode, description: t.desc, status: "OPEN",
        fallback: t.mode === "RANK" ? "AUTO" : "QUEUE",
        windowOpen: ["PICK", "REQUEST", "RANK"].includes(t.mode) ? new Date(now - 5 * DAY) : null,
        windowClose: ["PICK", "REQUEST", "RANK"].includes(t.mode) ? new Date(now + 16 * DAY) : null,
        welcomeMessage: `Welcome to the ${t.name} track. Come to your first session with one thing you would like to get better at this term.`,
        coordinatorId: ["Tech", "Design"].includes(t.name) ? coord.id : null,
      },
    }));
  }
  const T = Object.fromEntries(tracks.map((t) => [t.name, t]));

  const prev = await db.cohort.create({ data: { name: "2025/26 Session", description: "Pilot cohort", startDate: new Date(now - 420 * DAY), endDate: new Date(now - 120 * DAY), status: "COMPLETED", tracks: { create: tracks.slice(0, 6).map((t) => ({ trackId: t.id })) } } });
  const cohort = await db.cohort.create({ data: { name: "2026/27 Session", description: "Main intake for the 2026/27 academic session", startDate: new Date(now - 56 * DAY), endDate: new Date(now + 180 * DAY), status: "ACTIVE", tracks: { create: tracks.map((t) => ({ trackId: t.id })) } } });

  let n = 0;
  const person = (role: string, extra: Record<string, unknown> = {}) => {
    const name = `${FIRST[n % FIRST.length]} ${LAST[(n * 7 + 3) % LAST.length]}`;
    n++;
    return {
      email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}${n}@example.edu`, name, role, avatar: n % 8, faculty: pick(FACULTIES),
      languages: JSON.stringify(["English", ...(rnd() > 0.5 ? [pick(["Yoruba", "Hausa", "Igbo"])] : [])]), ...extra,
    };
  };
  const windows = () => some([1, 2, 3, 4, 5, 6], 3 + Math.floor(rnd() * 2)).map((weekday) => {
    const startMin = pick([9, 12, 15, 16, 17, 18]) * 60;
    return { weekday, startMin, endMin: startMin + pick([120, 180, 240]) };
  });

  // ----- Mentors -----
  const mentorTracks: Record<string, string[]> = {};
  const mentors: Awaited<ReturnType<typeof db.user.create>>[] = [];
  const demoMentor = await db.user.create({
    data: { email: "mentor@emp.local", name: "David Adeyemi", role: "MENTOR", avatar: 1, faculty: "Engineering", level: "Graduate", headline: "Senior software engineer, alumnus (Class of 2017)", bio: "I build payment systems and mentor early-career engineers. I enjoy helping students turn curiosity into a first internship.", expertise: JSON.stringify(["Software", "Internships", "CV and interviews", "Career planning", "Study skills"]), capacity: 4, hoursPerMonth: 6, linkedin: "https://linkedin.com/in/example", ...done, availability: { create: [{ weekday: 1, startMin: 17 * 60, endMin: 20 * 60 }, { weekday: 3, startMin: 17 * 60, endMin: 20 * 60 }, { weekday: 6, startMin: 10 * 60, endMin: 14 * 60 }] } },
  });
  mentors.push(demoMentor);
  mentorTracks[demoMentor.id] = ["100 Level", "Tech"];
  for (let i = 0; i < 17; i++) {
    const tr = i < 8 ? [TRACKS[i % 4].name] : [TRACKS[4 + (i % 6)].name];
    if (i % 5 === 0) tr.push(TRACKS[4 + ((i + 2) % 6)].name);
    const invited = i === 16;
    const u = await db.user.create({
      data: {
        ...person("MENTOR", { level: pick(["400", "Graduate", "Postgraduate"]), headline: pick(HEADLINES), bio: "Happy to share what I have learned and to listen. I like practical, small next steps.", expertise: JSON.stringify(some(INTEREST_TAGS, 5)), capacity: 2 + Math.floor(rnd() * 3) }),
        ...(invited ? { status: "INVITED", invitedAt: new Date(now - 4 * DAY), inviteCount: 1 } : done),
        availability: invited ? undefined : { create: windows() },
      },
    });
    mentors.push(u);
    mentorTracks[u.id] = [...new Set(tr)];
  }
  for (const m of mentors) for (const tn of mentorTracks[m.id]) await db.membership.create({ data: { userId: m.id, cohortId: cohort.id, trackId: T[tn].id, role: "MENTOR" } });

  // ----- Mentees -----
  const mentees: { id: string; tracks: string[]; ready: boolean }[] = [];
  const demoMentee = await db.user.create({
    data: { email: "mentee@emp.local", name: "Amara Nwosu", role: "MENTEE", avatar: 4, faculty: "Engineering", level: "100", studentId: "EMS/26/0142", interests: JSON.stringify(["Software", "Internships", "Study skills", "Choosing a major"]), goalsText: "I am not sure which area of computing to focus on, and I would like to land an internship next year.", applicationNotes: "First in her family at university. Wants guidance on choosing between software and data.", ...done, availability: { create: [{ weekday: 1, startMin: 16 * 60, endMin: 20 * 60 }, { weekday: 3, startMin: 16 * 60, endMin: 20 * 60 }, { weekday: 5, startMin: 14 * 60, endMin: 18 * 60 }, { weekday: 6, startMin: 9 * 60, endMin: 13 * 60 }] } },
  });
  mentees.push({ id: demoMentee.id, tracks: ["100 Level", "Tech"], ready: true });
  const fresh = await db.user.create({ data: { email: "new@emp.local", name: "Tobi Lawal", role: "MENTEE", avatar: 2, level: "200", faculty: "Science", status: "INVITED", invitedAt: new Date(now - DAY), inviteCount: 1, applicationNotes: "Interested in design and branding." } });
  mentees.push({ id: fresh.id, tracks: ["200 Level", "Design"], ready: false });
  for (let i = 0; i < 44; i++) {
    const level = TRACKS[i % 4].name;
    const tr = [level];
    if (i % 4 !== 0) tr.push(TRACKS[4 + (i % 6)].name);
    const state = i % 11 === 10 ? "invited" : i % 13 === 12 ? "signed-in" : "ready";
    const u = await db.user.create({
      data: {
        ...person("MENTEE", { level: level.split(" ")[0], studentId: `EMS/26/${String(1000 + i)}`, interests: JSON.stringify(some(INTEREST_TAGS, 4)), goalsText: "I want to be more confident and plan my next steps.", applicationNotes: pick(["Wants help choosing a career path.", "Looking for study and exam strategies.", "Hopes to build a portfolio this year.", "Wants an accountability partner and honest advice."]) }),
        ...(state === "ready" ? done : state === "signed-in" ? { status: "ACTIVE", firstSignInAt: new Date(now - 3 * DAY), invitedAt: new Date(now - 6 * DAY), inviteCount: 1, termsAcceptedAt: new Date(now - 3 * DAY) } : { status: "INVITED", invitedAt: new Date(now - (2 + (i % 9)) * DAY), inviteCount: 1 }),
        availability: state === "ready" ? { create: windows() } : undefined,
      },
    });
    mentees.push({ id: u.id, tracks: tr, ready: state === "ready" });
  }
  for (const m of mentees) for (const tn of m.tracks) await db.membership.create({ data: { userId: m.id, cohortId: cohort.id, trackId: T[tn].id, role: "MENTEE" } });

  // ----- Pairs, sessions, feedback -----
  const load: Record<string, number> = {};
  const mentorsIn = (tn: string) => mentors.filter((m) => mentorTracks[m.id].includes(tn) && m.status === "ACTIVE");
  const topics = ["Getting to know each other", "Study plan for the term", "CV review", "Choosing electives", "Internship search", "Portfolio feedback", "Time management", "Mock interview", "Mid-term check-in"];
  let pairCount = 0;
  const makePair = async (menteeId: string, mentorId: string, tn: string, profile: "healthy" | "quiet" | "risk" | "new") => {
    const started = profile === "new" ? now - 4 * DAY : now - (40 + Math.floor(rnd() * 10)) * DAY;
    const match = await db.match.create({ data: { menteeId, mentorId, cohortId: cohort.id, trackId: T[tn].id, status: "ACTIVE", score: 62 + Math.floor(rnd() * 34), reasons: JSON.stringify(["Shares Study skills, Internships", "5 hours of overlapping availability a week", "Both speak English, same time zone"]), startedAt: new Date(started), createdAt: new Date(started), respondedAt: new Date(started), createdById: admin.id, rhythm: pick(["WEEKLY", "BIWEEKLY", "BIWEEKLY"]) } });
    load[mentorId] = (load[mentorId] ?? 0) + 1;
    pairCount++;
    const offsets = profile === "healthy" ? [35, 21, 7] : profile === "quiet" ? [36, 24] : profile === "risk" ? [38, 20, 9] : [];
    let k = 0;
    for (const d of offsets) {
      const startsAt = new Date(Math.floor((now - d * DAY) / 3600_000) * 3600_000 + pick([15, 16, 17]) * 3600_000 - 12 * 3600_000);
      const status = profile === "risk" && k > 0 ? (k === 1 ? "NO_SHOW_MENTEE" : "CANCELLED") : "HELD";
      const s = await db.session.create({
        data: {
          matchId: match.id, startsAt, endsAt: new Date(+startsAt + 45 * 60_000), durationMin: 45, status, topic: topics[k % topics.length], proposedById: menteeId,
          joinUrl: "https://meet.google.com/abc-defg-hij", linkSource: "manual", outcomeAt: status === "CANCELLED" ? null : new Date(+startsAt + 50 * 60_000),
          lateCancel: status === "CANCELLED", cancelReason: status === "CANCELLED" ? "Something came up" : null, cancelledById: status === "CANCELLED" ? menteeId : null,
          sharedNotes: status === "HELD" ? "Talked through goals for the term and agreed on two small next steps. Good energy, clear priorities." : null,
          privateNotes: status === "HELD" && k === 0 ? "Seems a little anxious about workload. Check in gently next time." : null,
        },
      });
      if (status === "HELD") {
        for (const uid of [menteeId, mentorId]) {
          const late = rnd() > 0.85;
          await db.joinEvent.create({ data: { sessionId: s.id, userId: uid, at: new Date(+startsAt + (late ? 14 : -2) * 60_000) } });
          await db.attendance.create({ data: { sessionId: s.id, userId: uid, status: late ? "LATE" : "PRESENT", minutes: 45, joinedAt: new Date(+startsAt + (late ? 14 : -2) * 60_000), source: "JOIN_CLICK" } });
          if (rnd() > 0.2) {
            const base = profile === "risk" ? 2 : 4;
            const sc = () => Math.min(5, base + Math.floor(rnd() * 2));
            const scores = [sc(), sc(), sc()];
            await db.feedback.create({ data: { sessionId: s.id, authorId: uid, usefulness: scores[0], preparedness: scores[1], connection: scores[2], flagged: Math.min(...scores) <= 2, comment: rnd() > 0.5 ? pick(["Really practical advice, thank you.", "Felt heard. Clear next steps.", "Good session, ran a bit short.", "Helpful, and I left with a plan."]) : null, createdAt: new Date(+startsAt + 3 * 3600_000) } });
          }
        }
      } else if (status === "NO_SHOW_MENTEE") {
        await db.attendance.create({ data: { sessionId: s.id, userId: menteeId, status: "ABSENT", minutes: 0, source: "MANUAL" } });
        await db.attendance.create({ data: { sessionId: s.id, userId: mentorId, status: "PRESENT", minutes: 45, source: "MANUAL" } });
      }
      k++;
    }
    if (profile === "healthy" || profile === "new") {
      const startsAt = new Date(Math.ceil((now + (2 + Math.floor(rnd() * 6)) * DAY) / DAY) * DAY + pick([15, 16, 17]) * 3600_000);
      await db.session.create({ data: { matchId: match.id, startsAt, endsAt: new Date(+startsAt + 45 * 60_000), durationMin: 45, status: profile === "new" ? "PROPOSED" : "CONFIRMED", topic: profile === "new" ? "Getting to know each other" : "Progress check-in", proposedById: menteeId, joinUrl: profile === "new" ? null : "https://meet.google.com/abc-defg-hij", linkSource: profile === "new" ? null : "manual" } });
    }
    if (profile !== "new") {
      await db.actionItem.create({ data: { matchId: match.id, ownerId: menteeId, text: "Draft a one-page CV and share it before the next session", dueDate: new Date(now + 5 * DAY), done: false } });
      await db.actionItem.create({ data: { matchId: match.id, ownerId: mentorId, text: "Send two internship programmes worth applying to", done: true } });
    }
    return match;
  };

  // The demo mentee and mentor are paired in 100 Level, with an upcoming confirmed session.
  await makePair(demoMentee.id, demoMentor.id, "100 Level", "healthy");
  const ready = mentees.filter((m) => m.ready && m.id !== demoMentee.id);
  let i = 0;
  for (const m of ready) {
    const tn = m.tracks[0];
    i++;
    if (i % 5 === 0) continue; // leave some unassigned for the queue
    const pool = mentorsIn(tn).filter((x) => (load[x.id] ?? 0) < x.capacity).sort((a, b) => (load[a.id] ?? 0) - (load[b.id] ?? 0));
    if (!pool.length) continue;
    await makePair(m.id, pool[0].id, tn, i % 9 === 0 ? "risk" : i % 4 === 0 ? "quiet" : i % 7 === 0 ? "new" : "healthy");
  }
  // One more mentee for the demo mentor in Tech, and a pending request.
  const techMentees = ready.filter((m) => m.tracks.includes("Tech"));
  if (techMentees[0]) await makePair(techMentees[0].id, demoMentor.id, "Tech", "quiet");
  if (techMentees[1]) await db.match.create({ data: { menteeId: techMentees[1].id, mentorId: demoMentor.id, cohortId: cohort.id, trackId: T.Tech.id, status: "REQUESTED", note: "I read that you work on payment systems. I am learning backend development and would love guidance on what to build first.", score: 81, reasons: JSON.stringify(["Shares Software, Internships", "4 hours of overlapping availability a week", "Both speak English, same time zone"]), createdById: techMentees[1].id, createdAt: new Date(now - DAY) } });

  // ----- Previous cohort (history) -----
  for (const m of mentors.slice(0, 6)) await db.membership.create({ data: { userId: m.id, cohortId: prev.id, trackId: T[mentorTracks[m.id][0]].id, role: "MENTOR", status: "COMPLETED" } }).catch(() => {});

  // ----- A safety case, notifications and settings -----
  await db.safetyCase.create({ data: { reporterId: ready[3].id, category: "Boundary or contact issue", details: "My mentor asked to move our chats to a personal messaging app. I would rather keep things on the platform.", severity: "MEDIUM", status: "OPEN", createdAt: new Date(now - 2 * DAY) } });
  await db.notification.create({ data: { userId: demoMentee.id, type: "match_confirmed", title: "You are paired with David Adeyemi", body: "David is your mentor in 100 Level.", href: "/mentor", createdAt: new Date(now - 45 * DAY), readAt: new Date(now - 44 * DAY) } });
  await db.notification.create({ data: { userId: demoMentor.id, type: "match_request", title: "A mentee asked you to be their mentor", body: "Please accept or decline within 5 days.", href: "/requests", createdAt: new Date(now - DAY) } });
  await db.auditLog.create({ data: { actorId: admin.id, actorName: admin.name, action: "cohort.create", target: cohort.name, createdAt: new Date(now - 56 * DAY) } });
  await db.auditLog.create({ data: { actorId: admin.id, actorName: admin.name, action: "allowlist.add", target: `${mentees.length + mentors.length} people`, detail: "import", createdAt: new Date(now - 55 * DAY) } });

  console.log(`Seeded: ${mentors.length} mentors, ${mentees.length} mentees, ${pairCount} pairs, ${tracks.length} tracks, 2 cohorts.`);
  console.log(`Sign in as ${adminEmail} (super admin), coordinator@emp.local, mentor@emp.local, mentee@emp.local or new@emp.local.`);
}

main().finally(() => db.$disconnect());
