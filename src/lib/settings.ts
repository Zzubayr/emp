import { cache } from "react";
import { db } from "./db";

export const DEFAULT_SETTINGS = {
  orgName: "EMSS Mentorship Programme",
  shortName: "EMSS",
  society: "Engineering Muslim Students' Society (EMSS)",
  parentOrg: "An organ of MSSN Unilag Branch",
  tagline: "Guidance from those who have walked the path before you.",
  instagram: "emss_unilag",
  linkedin: "emss_unilag",
  supportEmail: "mentorship@emss.example",
  safeguardingEmail: "",
  defaultTimezone: "Africa/Lagos",
  labelMentor: "Mentor",
  labelMentee: "Mentee",
  minNoticeHours: 24,
  maxOpenRequests: 3,
  requestExpiryDays: 5,
  sessionDays: 30,
  adminSessionDays: 7,
  requireMentorApproval: false,
  mentorChangesPerCohort: 1,
  retentionYears: 2,
  quietStart: 21,
  quietEnd: 7,
  weights: { fit: 40, availability: 25, language: 15, preference: 10, capacity: 10 },
  modules: {
    scheduling: true,
    reminders: true,
    notes: true,
    feedback: true,
    attendance: true,
    safety: true,
  },
};

export type Settings = typeof DEFAULT_SETTINGS;

export const MODULE_INFO: { key: keyof Settings["modules"]; label: string; help: string }[] = [
  { key: "scheduling", label: "Scheduling and Google Meet", help: "Availability, booking and meeting links." },
  { key: "reminders", label: "Reminders", help: "Timed emails and in-app nudges from the reminder rules." },
  { key: "notes", label: "Session notes and action items", help: "Shared and private notes, follow-ups." },
  { key: "feedback", label: "Feedback", help: "Three quick ratings after every held session." },
  { key: "attendance", label: "Attendance tracking", help: "Join logs, attendance results and overrides." },
  { key: "safety", label: "Safety reporting", help: "Report a concern from any screen; case management." },
];

export const PLANNED_MODULES = [
  "Goals and milestones", "Questions and help desk", "In-app messaging",
  "Resource library", "Training and certificates", "Surveys and reports builder",
];

export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await db.setting.findMany();
  const out: Record<string, unknown> = structuredClone(DEFAULT_SETTINGS);
  for (const r of rows) {
    try {
      const v = JSON.parse(r.value);
      if (r.key === "modules" || r.key === "weights") out[r.key] = { ...(out[r.key] as object), ...v };
      else out[r.key] = v;
    } catch {}
  }
  return out as Settings;
});

export async function saveSettings(patch: Partial<Settings>, userId?: string) {
  for (const [key, value] of Object.entries(patch)) {
    await db.setting.upsert({
      where: { key },
      create: { key, value: JSON.stringify(value), updatedBy: userId },
      update: { value: JSON.stringify(value), updatedBy: userId },
    });
  }
}
