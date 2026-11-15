"use server";

import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { parseCsv } from "@/lib/csv";
import { sendInvite } from "@/lib/invites";
import { closeMatch } from "@/lib/ops";
import { getSettings } from "@/lib/settings";
import { isAdminRole } from "@/lib/auth";
import { admin, done, fail, me, opt, safe, staff, str, Denied } from "./util";

export type PersonInput = { email: string; name: string; role: string; tracks: string[]; level?: string; faculty?: string; studentId?: string; notes?: string };
export type PreviewRow = PersonInput & { line: number; errors: string[]; note?: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLE_ALIASES: Record<string, string> = { mentee: "MENTEE", student: "MENTEE", mentor: "MENTOR", coach: "MENTOR", coordinator: "COORDINATOR", "track coordinator": "COORDINATOR", admin: "ADMIN" };

async function validate(rows: PersonInput[], cohortId: string, actorRole: string, scope: string[] | null): Promise<PreviewRow[]> {
  const tracks = await db.track.findMany({ where: { cohorts: { some: { cohortId } }, status: { not: "ARCHIVED" } } });
  const byName = new Map(tracks.map((t) => [t.name.toLowerCase(), t]));
  const existing = await db.user.findMany({ where: { email: { in: rows.map((r) => r.email.toLowerCase()) } }, include: { memberships: { where: { cohortId }, include: { track: true } } } });
  const byEmail = new Map(existing.map((u) => [u.email, u]));
  const seen = new Set<string>();
  return rows.map((r, i) => {
    const errors: string[] = [];
    const email = r.email.trim().toLowerCase();
    const role = ROLE_ALIASES[r.role.trim().toLowerCase()] ?? r.role.trim().toUpperCase();
    if (!EMAIL.test(email)) errors.push("Bad email");
    if (seen.has(email)) errors.push("Duplicate in this list");
    seen.add(email);
    if (r.name.trim().length < 2) errors.push("Name missing");
    if (!["MENTEE", "MENTOR", "COORDINATOR", "ADMIN"].includes(role)) errors.push(`Unknown role "${r.role}"`);
    if (["COORDINATOR", "ADMIN"].includes(role) && !isAdminRole(actorRole)) errors.push("Only admins can add staff");
    const names = r.tracks.map((t) => t.trim()).filter(Boolean);
    const found = names.map((n) => byName.get(n.toLowerCase()));
    names.forEach((n, j) => { if (!found[j]) errors.push(`Unknown track "${n}"`); });
    if (["MENTEE", "MENTOR"].includes(role) && names.length === 0) errors.push("Track required");
    if (scope && found.some((t) => t && !scope.includes(t.id))) errors.push("Track outside your scope");
    const u = byEmail.get(email);
    let note: string | undefined;
    if (u) {
      note = u.memberships.length ? "Already in this cohort; tracks will be added" : "Returning person; will join this cohort";
      if (u.status === "REMOVED") note = "Was removed; will be re-invited";
      if (isAdminRole(u.role) && role !== u.role) errors.push("This email belongs to an admin");
    }
    if (role === "MENTEE") {
      const areas = [...(u?.memberships.filter((m) => m.role === "MENTEE").map((m) => m.track.area) ?? []), ...found.filter(Boolean).filter((t) => !u?.memberships.some((m) => m.trackId === t!.id)).map((t) => t!.area)];
      if (areas.filter((a) => a === "ACADEMIC").length > 1) errors.push("Only one academic track per mentee");
      if (areas.filter((a) => a === "NON_ACADEMIC").length > 1) errors.push("Only one non-academic track per mentee");
    }
    return { ...r, email, name: r.name.trim(), role, tracks: found.filter(Boolean).map((t) => t!.name), line: i + 1, errors, note };
  });
}

async function scopeFor(user: { id: string; role: string }) {
  if (isAdminRole(user.role)) return null;
  if (user.role !== "COORDINATOR") throw new Denied("Only staff can manage the allow list.");
  return (await db.track.findMany({ where: { coordinatorId: user.id }, select: { id: true } })).map((t) => t.id);
}

const HEADERS: Record<string, keyof PersonInput> = {
  email: "email", "email address": "email", "e-mail": "email", name: "name", "full name": "name", fullname: "name",
  role: "role", track: "tracks", tracks: "tracks", department: "tracks", level: "level", faculty: "faculty",
  "student id": "studentId", studentid: "studentId", "matric number": "studentId", notes: "notes", "application notes": "notes", why: "notes", reason: "notes",
};

/** Parses pasted text or a CSV file into rows and checks every row. Nothing is saved. */
export async function previewImport(text: string, cohortId: string, defaults: { role: string; track: string }): Promise<{ ok: true; rows: PreviewRow[]; mapping: string[] } | { ok: false; error: string }> {
  try {
    const user = await me();
    const scope = await scopeFor(user);
    const table = parseCsv(text).slice(0, 2001);
    if (!table.length) return { ok: false, error: "Nothing to import. Paste rows or choose a CSV file." };
    const first = table[0].map((h) => h.toLowerCase());
    const hasHeader = first.some((h) => HEADERS[h] === "email");
    let cols: (keyof PersonInput | null)[];
    if (hasHeader) cols = first.map((h) => HEADERS[h] ?? null);
    else {
      // No header row: find the email column, treat the first other column as the name.
      const e = table[0].findIndex((c) => EMAIL.test(c));
      if (e < 0) return { ok: false, error: "Could not find an email column. Add a header row: name, email, role, track." };
      cols = table[0].map((_, i) => (i === e ? "email" : null));
      const n = table[0].findIndex((_, i) => i !== e);
      if (n >= 0) cols[n] = "name";
    }
    const body = hasHeader ? table.slice(1) : table;
    if (body.length > 2000) return { ok: false, error: "Import at most 2,000 rows at a time." };
    const rows: PersonInput[] = body.map((r) => {
      const o: PersonInput = { email: "", name: "", role: defaults.role, tracks: defaults.track ? [defaults.track] : [] };
      cols.forEach((c, i) => {
        const v = (r[i] ?? "").trim();
        if (!c || !v) return;
        if (c === "tracks") o.tracks = v.split(/[;|]/).map((x) => x.trim()).filter(Boolean);
        else o[c] = v;
      });
      return o;
    });
    return { ok: true, rows: await validate(rows, cohortId, user.role, scope), mapping: cols.map((c, i) => `${hasHeader ? table[0][i] : `Column ${i + 1}`} → ${c ?? "ignored"}`) };
  } catch (e) {
    return { ok: false, error: e instanceof Denied ? e.message : "Could not read that file." };
  }
}

export const commitImport = safe(async (rows: PersonInput[], cohortId: string, invite: boolean) => {
  const user = await me();
  const scope = await scopeFor(user);
  const checked = (await validate(rows.slice(0, 2000), cohortId, user.role, scope)).filter((r) => r.errors.length === 0);
  if (!checked.length) return fail("No valid rows to add.");
  const tracks = await db.track.findMany();
  const byName = new Map(tracks.map((t) => [t.name, t.id]));
  let added = 0;
  for (const r of checked) {
    const existing = await db.user.findUnique({ where: { email: r.email } });
    const data = { name: r.name, level: r.level || existing?.level || null, faculty: r.faculty || existing?.faculty || null, studentId: r.studentId || existing?.studentId || null, applicationNotes: r.notes || existing?.applicationNotes || null };
    const u = existing
      ? await db.user.update({ where: { id: existing.id }, data: { ...data, status: existing.status === "REMOVED" ? "INVITED" : existing.status, role: isAdminRole(existing.role) ? existing.role : r.role } })
      : await db.user.create({ data: { ...data, email: r.email, role: r.role, status: "INVITED", addedById: user.id, source: rows.length > 1 ? "import" : "manual", timezone: (await getSettings()).defaultTimezone } });
    for (const name of r.tracks) {
      const trackId = byName.get(name)!;
      await db.membership.upsert({
        where: { userId_cohortId_trackId: { userId: u.id, cohortId, trackId } },
        create: { userId: u.id, cohortId, trackId, role: r.role === "MENTOR" ? "MENTOR" : "MENTEE" },
        update: { status: "ACTIVE" },
      });
    }
    if (invite && u.status === "INVITED") await sendInvite(u.id);
    added++;
  }
  await audit(user, "allowlist.add", `${added} people`, rows.length > 1 ? "import" : rows[0]?.email);
  return done(`${added} ${added === 1 ? "person" : "people"} added${invite ? " and invited" : ""}`);
});

async function canManage(userId: string) {
  const actor = await me();
  const target = await db.user.findUnique({ where: { id: userId }, include: { memberships: true } });
  if (!target) throw new Denied("That person no longer exists.");
  if (isAdminRole(actor.role)) {
    if (target.role === "SUPER_ADMIN" && actor.role !== "SUPER_ADMIN") throw new Denied("Only a super admin can change a super admin.");
    return { actor, target };
  }
  const scope = await scopeFor(actor);
  if (isAdminRole(target.role) || !target.memberships.some((m) => scope!.includes(m.trackId))) throw new Denied("That person is outside your tracks.");
  return { actor, target };
}

export const updatePerson = safe(async (userId: string, fd: FormData) => {
  const { actor, target } = await canManage(userId);
  const email = str(fd, "email").toLowerCase();
  const name = str(fd, "name");
  if (!EMAIL.test(email)) return fail("Enter a valid email address.");
  if (name.length < 2) return fail("Enter a name.");
  if (email !== target.email && (await db.user.findUnique({ where: { email } }))) return fail("Another person already uses that email.");
  let role = target.role;
  const wanted = str(fd, "role");
  if (wanted && wanted !== target.role) {
    if (!isAdminRole(actor.role)) return fail("Only admins can change roles.");
    if (["SUPER_ADMIN"].includes(wanted) && actor.role !== "SUPER_ADMIN") return fail("Only a super admin can grant that role.");
    if (!["MENTEE", "MENTOR", "COORDINATOR", "ADMIN", "SUPER_ADMIN"].includes(wanted)) return fail("Unknown role.");
    if (target.id === actor.id) return fail("You cannot change your own role.");
    role = wanted;
  }
  await db.user.update({ where: { id: userId }, data: { email, name, role, level: opt(fd, "level"), faculty: opt(fd, "faculty"), studentId: opt(fd, "studentId"), applicationNotes: opt(fd, "applicationNotes") } });
  if (email !== target.email) await db.authSession.deleteMany({ where: { userId } });
  await audit(actor, "allowlist.edit", target.email, [email !== target.email && `email → ${email}`, role !== target.role && `role → ${role}`].filter(Boolean).join(", ") || undefined);
  return done("Saved");
});

async function setStatus(userId: string, status: string) {
  const { actor, target } = await canManage(userId);
  if (target.id === actor.id) throw new Denied("You cannot change your own status.");
  await db.user.update({ where: { id: userId }, data: { status } });
  if (status === "SUSPENDED" || status === "REMOVED") {
    await db.authSession.deleteMany({ where: { userId } });
    const matches = await db.match.findMany({ where: { status: { in: ["ACTIVE", "PAUSED"] }, OR: [{ menteeId: userId }, { mentorId: userId }] } });
    for (const m of matches) await closeMatch(m.id, status === "REMOVED" ? "ENDED" : "PAUSED", status === "REMOVED" ? "A member left the program" : "A member is temporarily unavailable", actor);
    await db.match.updateMany({ where: { status: "REQUESTED", OR: [{ menteeId: userId }, { mentorId: userId }] }, data: { status: "EXPIRED", endReason: "Member unavailable" } });
  }
  await audit(actor, `allowlist.${status.toLowerCase()}`, target.email);
}

export const setPersonStatus = safe(async (userId: string, status: "ACTIVE" | "SUSPENDED" | "REMOVED" | "INVITED") => {
  await setStatus(userId, status);
  return done(status === "REMOVED" ? "Removed. Their sessions were cancelled and partners notified." : "Status updated");
});

export const resendInvite = safe(async (userId: string) => {
  const { actor, target } = await canManage(userId);
  if (target.status !== "INVITED") return fail("This person has already signed in.");
  await sendInvite(userId, target.inviteCount > 0);
  await audit(actor, "allowlist.invite", target.email);
  return done("Invite sent");
});

export const approveMentor = safe(async (userId: string) => {
  const { actor, target } = await canManage(userId);
  await db.user.update({ where: { id: userId }, data: { approvedAt: target.approvedAt ? null : new Date() } });
  await audit(actor, target.approvedAt ? "mentor.unapprove" : "mentor.approve", target.email);
  return done(target.approvedAt ? "Approval removed" : "Mentor approved for matching");
});

export const bulkPeople = safe(async (ids: string[], op: "invite" | "suspend" | "activate" | "remove") => {
  if (!ids.length) return fail("Select at least one person.");
  let n = 0;
  for (const id of ids.slice(0, 500)) {
    try {
      if (op === "invite") {
        const { target } = await canManage(id);
        if (target.status !== "INVITED") continue;
        await sendInvite(id, target.inviteCount > 0);
      } else await setStatus(id, op === "suspend" ? "SUSPENDED" : op === "remove" ? "REMOVED" : "ACTIVE");
      n++;
    } catch (e) {
      if (!(e instanceof Denied)) throw e;
    }
  }
  const actor = await me();
  await audit(actor, `allowlist.bulk_${op}`, `${n} people`);
  return n ? done(`${n} ${n === 1 ? "person" : "people"} updated`) : fail("None of the selected people could be changed.");
});

export const removeMembership = safe(async (membershipId: string) => {
  const m = await db.membership.findUnique({ where: { id: membershipId }, include: { user: true, track: true } });
  if (!m) return fail("Already removed.");
  const actor = await staff(m.trackId);
  const matches = await db.match.findMany({ where: { cohortId: m.cohortId, trackId: m.trackId, status: { in: ["ACTIVE", "PAUSED"] }, OR: [{ menteeId: m.userId }, { mentorId: m.userId }] } });
  for (const x of matches) await closeMatch(x.id, "ENDED", "Removed from the track", actor);
  await db.membership.delete({ where: { id: membershipId } });
  await audit(actor, "allowlist.track_remove", m.user.email, m.track.name);
  return done(`Removed from ${m.track.name}`);
});

export const promoteLevels = safe(async (cohortId: string) => {
  const actor = await admin();
  const next: Record<string, string> = { "100": "200", "200": "300", "300": "400", "400": "500" };
  const mentees = await db.user.findMany({ where: { role: "MENTEE", level: { in: Object.keys(next) }, memberships: { some: { cohortId } } } });
  for (const u of mentees) await db.user.update({ where: { id: u.id }, data: { level: next[u.level!] } });
  await audit(actor, "cohort.promote_levels", cohortId, `${mentees.length} students`);
  return done(`${mentees.length} students moved up one level`);
});
