export const ROLES = ["MENTEE", "MENTOR", "COORDINATOR", "ADMIN", "SUPER_ADMIN"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<string, string> = {
  MENTEE: "Mentee",
  MENTOR: "Mentor",
  COORDINATOR: "Track coordinator",
  ADMIN: "Program admin",
  SUPER_ADMIN: "Super admin",
};

export const ASSIGNMENT_MODES: Record<string, { label: string; short: string; help: string }> = {
  ADMIN: { label: "Admin assigns", short: "Assigned", help: "An admin pairs each mentee with a mentor by hand or in bulk." },
  SUGGEST: { label: "Suggest, then admin confirms", short: "Suggested", help: "EMP ranks mentors for each mentee; an admin confirms in one click or in bulk." },
  PICK: { label: "Student picks instantly", short: "Pick", help: "Students take a mentor in their track. Spots are first come, first served." },
  REQUEST: { label: "Student requests, mentor accepts", short: "Request", help: "Students send up to 3 requests with a short note; mentors accept or decline within 5 days." },
  RANK: { label: "Rank and allocate", short: "Rank", help: "Students rank their top 3; EMP allocates everyone fairly when the window closes." },
};

export const TRACK_ICONS = [
  "GraduationCap", "BookOpen", "Code", "Palette", "HeartHandshake", "Briefcase",
  "Rocket", "Users", "FlaskConical", "Camera", "Leaf", "Sparkles",
] as const;

export const INTEREST_TAGS = [
  "Study skills", "Exam prep", "Choosing a major", "Research", "Scholarships", "Internships",
  "CV and interviews", "Software", "Data", "Product", "Cybersecurity", "UI/UX", "Graphic design",
  "Branding", "Entrepreneurship", "Pitching", "Personal finance", "Time management",
  "Public speaking", "Leadership", "Communication", "Confidence", "Writing", "Content creation",
  "Wellbeing", "Campus life", "Graduate school", "Career planning",
];

export const LANGUAGES = ["English", "Yoruba", "Hausa", "Igbo", "Pidgin", "French", "Arabic"];
export const LEVELS = ["100", "200", "300", "400", "500", "Postgraduate", "Graduate"];
export const FACULTIES = [
  "Engineering", "Science", "Arts", "Law", "Social Sciences", "Education",
  "Management Sciences", "Medicine", "Environmental Sciences", "Agriculture",
];

export const CONCERN_CATEGORIES = [
  "Inappropriate behaviour", "Harassment or bullying", "Safety or wellbeing worry",
  "Boundary or contact issue", "Discrimination", "Something else",
];

export const TIMEZONES = [
  "Africa/Lagos", "Africa/Accra", "Africa/Nairobi", "Africa/Johannesburg", "Africa/Cairo",
  "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles",
  "America/Toronto", "Asia/Dubai", "Asia/Kolkata", "Asia/Singapore", "Australia/Sydney", "UTC",
];

export const RHYTHMS: Record<string, { label: string; perMonth: number }> = {
  WEEKLY: { label: "Weekly", perMonth: 4 },
  BIWEEKLY: { label: "Every 2 weeks", perMonth: 2 },
  MONTHLY: { label: "Monthly", perMonth: 1 },
};

/** Flat avatar colours, all from the EMSS navy/cyan family plus a few muted partners. */
export const AVATAR_COLORS = [
  { name: "Navy", cls: "bg-[#182346] text-white" },
  { name: "Cyan", cls: "bg-[#3ED9D9] text-[#182346]" },
  { name: "Teal", cls: "bg-[#0E7C86] text-white" },
  { name: "Slate", cls: "bg-[#4A5573] text-white" },
  { name: "Ocean", cls: "bg-[#2F5D8C] text-white" },
  { name: "Mist", cls: "bg-[#C9EEF0] text-[#182346]" },
  { name: "Ink", cls: "bg-[#0B1120] text-white" },
  { name: "Sand", cls: "bg-[#E7DFCF] text-[#182346]" },
];

export const TERMS_VERSION = "2026-11";

export const parseList = (s: string | null | undefined): string[] => {
  try {
    const v = JSON.parse(s || "[]");
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};
