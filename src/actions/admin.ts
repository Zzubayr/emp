"use server";

import { cookies } from "next/headers";
import { audit } from "@/lib/audit";
import { ASSIGNMENT_MODES, TRACK_ICONS } from "@/lib/constants";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { parseOffsets, runTick } from "@/lib/reminders";
import { DEFAULT_SETTINGS, saveSettings, type Settings } from "@/lib/settings";
import { safeTz } from "@/lib/time";
import { admin, done, fail, int, list, me, opt, safe, staff, str } from "./util";
import { isStaffRole } from "@/lib/auth";

const day = (s: string) => (/^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T00:00:00Z`) : null);

export const switchCohort = safe(async (cohortId: string) => {
  const user = await me();
  if (!isStaffRole(user.role)) return fail("Only staff can switch cohorts.");
  (await cookies()).set("emp_cohort", cohortId, { path: "/", maxAge: 86400 * 365, sameSite: "lax" });
  return done();
});

export const createCohort = safe(async (fd: FormData) => {
  const user = await admin();
  const name = str(fd, "name");
  const start = day(str(fd, "startDate")), end = day(str(fd, "endDate"));
  if (name.length < 3) return fail("Give the cohort a name, for example 2026/27 Session.");
  if (!start || !end || end <= start) return fail("Choose a start date and a later end date.");
  if (await db.cohort.findUnique({ where: { name } })) return fail("A cohort with that name already exists.");
  const trackIds = list(fd, "trackIds");
  if (!trackIds.length) return fail("Choose at least one track for this cohort.");
  const cohort = await db.cohort.create({
    data: { name, description: opt(fd, "description"), startDate: start, endDate: end, status: "ONBOARDING", tracks: { create: trackIds.map((trackId) => ({ trackId })) } },
  });
  const from = str(fd, "carryFrom");
  let carried = 0;
  if (from) {
    const mentors = await db.membership.findMany({ where: { cohortId: from, role: "MENTOR", trackId: { in: trackIds }, user: { status: { in: ["ACTIVE", "INVITED"] } } } });
    for (const m of mentors) {
      await db.membership.create({ data: { userId: m.userId, cohortId: cohort.id, trackId: m.trackId, role: "MENTOR" } });
      carried++;
    }
  }
  (await cookies()).set("emp_cohort", cohort.id, { path: "/", maxAge: 86400 * 365, sameSite: "lax" });
  await audit(user, "cohort.create", name, carried ? `${carried} mentors carried over` : undefined);
  return done(`${name} created${carried ? `, ${carried} mentors carried over` : ""}`, `/admin/cohorts/${cohort.id}`);
});

export const updateCohort = safe(async (cohortId: string, fd: FormData) => {
  const user = await admin();
  const start = day(str(fd, "startDate")), end = day(str(fd, "endDate"));
  const name = str(fd, "name");
  if (name.length < 3 || !start || !end || end <= start) return fail("Check the name and dates.");
  const clash = await db.cohort.findFirst({ where: { name, id: { not: cohortId } } });
  if (clash) return fail("Another cohort already has that name.");
  const trackIds = list(fd, "trackIds");
  await db.cohort.update({ where: { id: cohortId }, data: { name, description: opt(fd, "description"), startDate: start, endDate: end } });
  if (fd.has("trackIds")) {
    const current = (await db.cohortTrack.findMany({ where: { cohortId } })).map((c) => c.trackId);
    for (const id of trackIds.filter((t) => !current.includes(t))) await db.cohortTrack.create({ data: { cohortId, trackId: id } });
    for (const id of current.filter((t) => !trackIds.includes(t))) {
      const used = await db.membership.count({ where: { cohortId, trackId: id } });
      if (used) return fail("A track with people in it cannot be removed from the cohort. Move or remove them first.");
      await db.cohortTrack.delete({ where: { cohortId_trackId: { cohortId, trackId: id } } });
    }
  }
  await audit(user, "cohort.update", name);
  return done("Cohort saved");
});

export const setCohortStatus = safe(async (cohortId: string, status: "ONBOARDING" | "ACTIVE" | "COMPLETED" | "ARCHIVED") => {
  const user = await admin();
  const c = await db.cohort.update({ where: { id: cohortId }, data: { status } });
  if (status === "COMPLETED") {
    await db.match.updateMany({ where: { cohortId, status: { in: ["ACTIVE", "PAUSED"] } }, data: { status: "ENDED", endReason: "Cohort completed", endedAt: new Date() } });
    await db.match.updateMany({ where: { cohortId, status: { in: ["REQUESTED", "SUGGESTED"] } }, data: { status: "EXPIRED", endReason: "Cohort completed" } });
    await db.session.updateMany({ where: { match: { cohortId }, status: { in: ["PROPOSED", "CONFIRMED"] }, startsAt: { gt: new Date() } }, data: { status: "CANCELLED", cancelReason: "Cohort completed" } });
    await db.membership.updateMany({ where: { cohortId, status: "ACTIVE" }, data: { status: "COMPLETED" } });
  }
  await audit(user, "cohort.status", c.name, status);
  return done(`${c.name} is now ${status.toLowerCase()}`);
});

function trackData(fd: FormData) {
  const lengths = list(fd, "sessionLengths").map(Number).filter((n) => [15, 30, 45, 60, 90].includes(n));
  return {
    name: str(fd, "name"),
    area: str(fd, "area") === "ACADEMIC" ? "ACADEMIC" : "NON_ACADEMIC",
    description: opt(fd, "description"),
    welcomeMessage: opt(fd, "welcomeMessage"),
    icon: (TRACK_ICONS as readonly string[]).includes(str(fd, "icon")) ? str(fd, "icon") : "GraduationCap",
    assignmentMode: str(fd, "assignmentMode") in ASSIGNMENT_MODES ? str(fd, "assignmentMode") : "SUGGEST",
    fallback: str(fd, "fallback") === "AUTO" ? "AUTO" : "QUEUE",
    windowOpen: day(str(fd, "windowOpen")),
    windowClose: day(str(fd, "windowClose")) ? new Date(day(str(fd, "windowClose"))!.getTime() + 86399_000) : null,
    maxMenteesPerMentor: Math.min(20, Math.max(1, int(fd, "maxMenteesPerMentor", 3))),
    showFullMentors: str(fd, "showFullMentors") === "on",
    sessionLengths: JSON.stringify(lengths.length ? lengths : [30, 45, 60]),
    minSessions: Math.max(0, int(fd, "minSessions", 4)),
    cancelWindowHours: Math.max(0, int(fd, "cancelWindowHours", 24)),
    presentPct: Math.min(100, Math.max(10, int(fd, "presentPct", 70))),
    lateMinutes: Math.max(1, int(fd, "lateMinutes", 10)),
    noShowMinutes: Math.max(1, int(fd, "noShowMinutes", 15)),
    heldOverlapMinutes: Math.max(1, int(fd, "heldOverlapMinutes", 15)),
    coordinatorId: opt(fd, "coordinatorId"),
  };
}

export const createTrack = safe(async (fd: FormData) => {
  const user = await admin();
  const name = str(fd, "name");
  if (name.length < 2) return fail("Give the track a name.");
  if (await db.track.findUnique({ where: { name } })) return fail("A track with that name already exists.");
  const cohortId = str(fd, "cohortId");
  const t = await db.track.create({
    data: {
      name, area: str(fd, "area") === "ACADEMIC" ? "ACADEMIC" : "NON_ACADEMIC", description: opt(fd, "description"),
      assignmentMode: str(fd, "area") === "ACADEMIC" ? "SUGGEST" : "REQUEST", status: "OPEN",
      ...(cohortId ? { cohorts: { create: { cohortId } } } : {}),
    },
  });
  await audit(user, "track.create", name);
  return done("Track created", `/admin/tracks/${t.id}`);
});

export const updateTrack = safe(async (trackId: string, fd: FormData) => {
  const user = await staff(trackId);
  const data = trackData(fd);
  if (data.name.length < 2) return fail("Give the track a name.");
  if (await db.track.findFirst({ where: { name: data.name, id: { not: trackId } } })) return fail("Another track already has that name.");
  if (data.windowOpen && data.windowClose && data.windowClose <= data.windowOpen) return fail("The selection window must close after it opens.");
  if (user.role === "COORDINATOR") data.coordinatorId = user.id;
  else if (data.coordinatorId) {
    const c = await db.user.findUnique({ where: { id: data.coordinatorId } });
    if (!c || !isStaffRole(c.role)) return fail("The coordinator must be a track coordinator or admin.");
  }
  await db.track.update({ where: { id: trackId }, data });
  await audit(user, "track.update", data.name, `mode ${data.assignmentMode}`);
  return done("Track saved. Changes apply to new assignments and sessions.");
});

export const cloneTrack = safe(async (trackId: string) => {
  const user = await admin();
  const { id: _id, createdAt: _c, coordinatorId: _co, ...t } = await db.track.findUniqueOrThrow({ where: { id: trackId } });
  let name = `${t.name} (copy)`;
  for (let i = 2; await db.track.findUnique({ where: { name } }); i++) name = `${t.name} (copy ${i})`;
  const copy = await db.track.create({ data: { ...t, name, status: "DRAFT", windowOpen: null, windowClose: null } });
  await audit(user, "track.clone", t.name, name);
  return done("Track cloned as a draft", `/admin/tracks/${copy.id}`);
});

export const setTrackStatus = safe(async (trackId: string, status: "DRAFT" | "OPEN" | "CLOSED" | "ARCHIVED") => {
  const user = await admin();
  const t = await db.track.update({ where: { id: trackId }, data: { status } });
  await audit(user, "track.status", t.name, status);
  return done(`${t.name} is now ${status.toLowerCase()}`);
});

export const saveOrgSettings = safe(async (fd: FormData) => {
  const user = await admin();
  const num = (k: keyof Settings, min: number, max: number) => Math.min(max, Math.max(min, int(fd, k, DEFAULT_SETTINGS[k] as number)));
  const patch: Partial<Settings> = {
    orgName: str(fd, "orgName") || DEFAULT_SETTINGS.orgName,
    shortName: str(fd, "shortName").slice(0, 8) || DEFAULT_SETTINGS.shortName,
    tagline: str(fd, "tagline"),
    society: str(fd, "society") || DEFAULT_SETTINGS.society,
    parentOrg: str(fd, "parentOrg"),
    instagram: str(fd, "instagram").replace(/^@/, ""),
    linkedin: str(fd, "linkedin").replace(/^@/, ""),
    supportEmail: str(fd, "supportEmail"),
    safeguardingEmail: str(fd, "safeguardingEmail"),
    defaultTimezone: safeTz(str(fd, "defaultTimezone")),
    labelMentor: str(fd, "labelMentor") || "Mentor",
    labelMentee: str(fd, "labelMentee") || "Mentee",
    minNoticeHours: num("minNoticeHours", 0, 168),
    maxOpenRequests: num("maxOpenRequests", 1, 10),
    requestExpiryDays: num("requestExpiryDays", 1, 30),
    sessionDays: num("sessionDays", 1, 90),
    adminSessionDays: num("adminSessionDays", 1, 30),
    retentionYears: num("retentionYears", 1, 10),
    requireMentorApproval: str(fd, "requireMentorApproval") === "on",
  };
  await saveSettings(patch, user.id);
  await audit(user, "settings.update", "Organization and program rules");
  return done("Settings saved");
});

export const saveModules = safe(async (fd: FormData) => {
  const user = await admin();
  const modules = Object.fromEntries(Object.keys(DEFAULT_SETTINGS.modules).map((k) => [k, str(fd, k) === "on"])) as Settings["modules"];
  await saveSettings({ modules }, user.id);
  await audit(user, "settings.modules", Object.entries(modules).filter(([, v]) => !v).map(([k]) => k).join(", ") || "all on");
  return done("Modules saved");
});

export const saveWeights = safe(async (fd: FormData) => {
  const user = await admin();
  const weights = Object.fromEntries(Object.keys(DEFAULT_SETTINGS.weights).map((k) => [k, Math.min(100, Math.max(0, int(fd, k, 0)))])) as Settings["weights"];
  if (Object.values(weights).reduce((a, b) => a + b, 0) === 0) return fail("At least one weight must be above zero.");
  await saveSettings({ weights }, user.id);
  await audit(user, "settings.weights", JSON.stringify(weights));
  return done("Matching weights saved");
});

export const saveRule = safe(async (key: string, fd: FormData) => {
  const user = await admin();
  let offsets: number[];
  try {
    offsets = parseOffsets(str(fd, "offsets"));
  } catch (e) {
    return fail(e instanceof Error ? e.message : "Check the timings.");
  }
  if (!offsets.length) return fail("Add at least one timing.");
  await db.reminderRule.update({
    where: { key },
    data: { offsets: JSON.stringify(offsets), enabled: str(fd, "enabled") === "on", email: str(fd, "email") === "on", ...(fd.has("subject") ? { subject: str(fd, "subject"), body: str(fd, "body") } : {}) },
  });
  await audit(user, "reminders.rule", key);
  return done("Rule saved");
});

export const runTickNow = safe(async () => {
  await admin();
  const r = await runTick();
  return done(`Reminder run finished: ${r.sent} sent, ${r.expired} expired, ${r.autoHeld} auto-marked held.`);
});

export const sendTestEmail = safe(async () => {
  const user = await admin();
  const row = await sendMail({ to: user.email, subject: "EMP test email", body: "If you can read this in your inbox, email delivery is working.", type: "test" });
  return row.status === "SENT" ? done(`Test email sent to ${user.email}`) : row.status === "FAILED" ? fail(`Sending failed: ${row.error}`) : done("No email service is configured, so the email was written to the email log only.");
});
