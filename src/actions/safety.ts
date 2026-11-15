"use server";

import { audit } from "@/lib/audit";
import { CONCERN_CATEGORIES } from "@/lib/constants";
import { db } from "@/lib/db";
import { sendMail, appUrl } from "@/lib/mail";
import { notifyAdmins } from "@/lib/notify";
import { closeMatch } from "@/lib/ops";
import { getSettings } from "@/lib/settings";
import { admin, done, fail, me, safe, str } from "./util";

export const reportConcern = safe(async (fd: FormData) => {
  const user = await me();
  const s = await getSettings();
  if (!s.modules.safety) return fail("Safety reporting is switched off. Please contact the program team directly.");
  const category = str(fd, "category");
  const details = str(fd, "details").slice(0, 4000);
  if (!CONCERN_CATEGORIES.includes(category)) return fail("Choose a category.");
  if (details.length < 10) return fail("Please tell us a little more about what happened.");
  const matchId = str(fd, "matchId") || null;
  let subjectId: string | null = null;
  if (matchId) {
    const m = await db.match.findFirst({ where: { id: matchId, OR: [{ menteeId: user.id }, { mentorId: user.id }] } });
    if (!m) return fail("That pairing was not found.");
    subjectId = m.menteeId === user.id ? m.mentorId : m.menteeId;
  }
  const severity = /Harassment|Safety|Inappropriate/.test(category) ? "HIGH" : "MEDIUM";
  const c = await db.safetyCase.create({ data: { reporterId: user.id, subjectId, matchId, category, details, anonymous: str(fd, "anonymous") === "on", severity } });
  if (matchId && severity === "HIGH") await closeMatch(matchId, "PAUSED", "Paused automatically pending a safety review", null);
  // Safety alerts ignore quiet hours and preferences.
  await notifyAdmins({ type: "safety_report", title: `New safety report: ${category}`, body: `Severity: ${severity}. Open the case to review it.${matchId && severity === "HIGH" ? " The pairing has been paused automatically." : ""}`, href: `/admin/safety/${c.id}`, cta: "Open case" });
  if (s.safeguardingEmail) await sendMail({ to: s.safeguardingEmail, subject: `New safety report: ${category}`, body: `A new ${severity.toLowerCase()} severity report was filed.`, type: "safety_report", cta: { label: "Open case", href: appUrl(`/admin/safety/${c.id}`) } });
  await audit(user, "safety.report", c.id, category);
  return done("Thank you for telling us. The safeguarding lead has been alerted and will follow up.", "/home");
});

export const updateCase = safe(async (caseId: string, fd: FormData) => {
  const user = await admin();
  const status = str(fd, "status"), severity = str(fd, "severity");
  if (!["OPEN", "IN_REVIEW", "RESOLVED"].includes(status) || !["LOW", "MEDIUM", "HIGH"].includes(severity)) return fail("Choose a status and severity.");
  const outcome = str(fd, "outcome") || null;
  if (status === "RESOLVED" && !outcome) return fail("Write the outcome before resolving the case.");
  await db.safetyCase.update({ where: { id: caseId }, data: { status, severity, outcome } });
  await db.caseNote.create({ data: { caseId, authorId: user.id, body: `Status set to ${status.replace("_", " ").toLowerCase()}, severity ${severity.toLowerCase()}.${outcome ? ` Outcome: ${outcome}` : ""}` } });
  await audit(user, "safety.update", caseId, status);
  return done("Case updated");
});

export const addCaseNote = safe(async (caseId: string, fd: FormData) => {
  const user = await admin();
  const body = str(fd, "body").slice(0, 4000);
  if (!body) return fail("Write a note first.");
  await db.caseNote.create({ data: { caseId, authorId: user.id, body } });
  await audit(user, "safety.note", caseId);
  return done("Note added");
});
