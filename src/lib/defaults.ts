import { db } from "./db";

/** The recommended starting tracks from the product plan. */
export const DEFAULT_TRACKS = [
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

/** On a brand-new deployment, create the starting tracks so the first admin can open a cohort. */
export async function ensureDefaultTracks() {
  if ((await db.track.count()) > 0) return;
  for (const t of DEFAULT_TRACKS) {
    await db.track.create({ data: { name: t.name, area: t.area, icon: t.icon, assignmentMode: t.mode, description: t.desc, status: "OPEN", fallback: t.mode === "RANK" ? "AUTO" : "QUEUE" } });
  }
}
