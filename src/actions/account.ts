"use server";

import { audit } from "@/lib/audit";
import { TERMS_VERSION } from "@/lib/constants";
import { db } from "@/lib/db";
import { safeTz } from "@/lib/time";
import { done, fail, int, list, me, opt, safe, str } from "./util";

export const acceptTerms = safe(async () => {
  const user = await me();
  await db.user.update({ where: { id: user.id }, data: { termsAcceptedAt: new Date() } });
  for (const type of ["terms", "privacy", "conduct", "attendance"]) {
    await db.consent.create({ data: { userId: user.id, type, version: TERMS_VERSION } });
  }
  return done();
});

function profileData(fd: FormData, role: string) {
  const mentor = role === "MENTOR";
  return {
    name: str(fd, "name").slice(0, 80),
    timezone: safeTz(str(fd, "timezone")),
    level: opt(fd, "level"),
    faculty: opt(fd, "faculty"),
    phone: opt(fd, "phone"),
    headline: opt(fd, "headline")?.slice(0, 120) ?? null,
    bio: opt(fd, "bio")?.slice(0, 1200) ?? null,
    goalsText: opt(fd, "goalsText")?.slice(0, 1200) ?? null,
    linkedin: opt(fd, "linkedin"),
    meetingPref: opt(fd, "meetingPref"),
    languages: JSON.stringify(list(fd, "languages")),
    avatar: int(fd, "avatar", 0),
    ...(mentor
      ? { expertise: JSON.stringify(list(fd, "expertise")), capacity: Math.min(10, Math.max(0, int(fd, "capacity", 3))), hoursPerMonth: Math.min(40, Math.max(1, int(fd, "hoursPerMonth", 4))) }
      : { interests: JSON.stringify(list(fd, "interests")) }),
  };
}

export const saveProfile = safe(async (fd: FormData) => {
  const user = await me();
  const data = profileData(fd, user.role);
  if (data.name.length < 2) return fail("Please enter your full name.");
  if (data.linkedin && !/^https:\/\/([a-z]+\.)?linkedin\.com\//i.test(data.linkedin)) return fail("The LinkedIn link should start with https://linkedin.com/");
  const finishing = str(fd, "finish") === "1";
  if (finishing) {
    if (!user.termsAcceptedAt) return fail("Please accept the terms first.");
    if (user.role === "MENTOR") {
      if (list(fd, "expertise").length === 0) return fail("Pick at least one area you can help with.");
      if (str(fd, "agreement") !== "on") return fail("Please agree to the mentor agreement.");
    }
    if (user.role === "MENTEE" && list(fd, "interests").length === 0) return fail("Pick at least one thing you would like help with.");
  }
  await db.user.update({
    where: { id: user.id },
    data: { ...data, ...(finishing ? { onboardedAt: new Date(), ...(user.role === "MENTOR" ? { trainingDoneAt: new Date() } : {}) } : {}) },
  });
  if (finishing && user.role === "MENTOR") await db.consent.create({ data: { userId: user.id, type: "mentor_agreement", version: TERMS_VERSION } });
  if (str(fd, "availability")) await writeAvailability(user.id, str(fd, "availability"));
  if (finishing) await audit(user, "user.onboarded", user.email);
  return done(finishing ? "Welcome aboard!" : "Profile saved", finishing ? "/home" : undefined);
});

async function writeAvailability(userId: string, json: string) {
  let rules: { weekday: number; startMin: number; endMin: number }[] = [];
  try {
    rules = JSON.parse(json);
  } catch {}
  const clean = (Array.isArray(rules) ? rules : [])
    .filter((r) => Number.isInteger(r.weekday) && r.weekday >= 0 && r.weekday <= 6 && r.startMin >= 0 && r.endMin <= 1440 && r.endMin - r.startMin >= 30)
    .slice(0, 40);
  await db.$transaction([
    db.availabilityRule.deleteMany({ where: { userId } }),
    ...clean.map((r) => db.availabilityRule.create({ data: { userId, weekday: r.weekday, startMin: r.startMin, endMin: r.endMin } })),
  ]);
}

export const saveAvailability = safe(async (fd: FormData) => {
  const user = await me();
  await writeAvailability(user.id, str(fd, "availability"));
  return done("Availability saved");
});

export const markAllRead = safe(async () => {
  const user = await me();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  return done();
});

export const pauseMentoring = safe(async (fd: FormData) => {
  const user = await me();
  const until = str(fd, "until");
  const date = until ? new Date(`${until}T00:00:00Z`) : null;
  await db.user.update({ where: { id: user.id }, data: { pausedUntil: date && date > new Date() ? date : null } });
  await audit(user, date ? "mentor.pause" : "mentor.resume", user.email, str(fd, "reason"));
  return done(date ? "You will not receive new mentees until then." : "You are open to new mentees again.");
});
