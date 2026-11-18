import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { audit } from "./audit";
import { db } from "./db";
import { ensureDefaultTracks } from "./defaults";
import { appUrl, sendMail } from "./mail";
import { getSettings } from "./settings";

const COOKIE = "emp_session";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const codeHash = (email: string, code: string) => sha(`${email}:${code}:${process.env.CRON_SECRET ?? "emp"}`);

export const isAdminRole = (role: string) => role === "ADMIN" || role === "SUPER_ADMIN";
export const isStaffRole = (role: string) => isAdminRole(role) || role === "COORDINATOR";

export type OtpResult = { ok: true; devCode?: string } | { ok: false; error: string };

/** Always answers the same way for listed and unlisted emails, so membership cannot be probed. */
export async function requestOtp(rawEmail: string, ip: string): Promise<OtpResult> {
  const email = rawEmail.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  const now = Date.now();
  const recent = await db.otpChallenge.findMany({
    where: { OR: [{ email }, { ip }], createdAt: { gt: new Date(now - 3600_000) } },
    orderBy: { createdAt: "desc" },
  });
  const mine = recent.filter((r) => r.email === email);
  if (mine[0] && now - mine[0].createdAt.getTime() < 60_000) return { ok: false, error: "Please wait a minute before asking for another code." };
  if (mine.length >= 6 || recent.length >= 30) return { ok: false, error: "Too many codes requested. Try again in an hour." };

  let user = await db.user.findUnique({ where: { email } });
  if (!user && email === process.env.ADMIN_EMAIL?.trim().toLowerCase() && (await db.user.count()) === 0) {
    // Fresh deployment: the configured admin email becomes the first super admin.
    user = await db.user.create({ data: { email, name: "Programme Admin", role: "SUPER_ADMIN", status: "INVITED", source: "bootstrap" } });
    await audit(null, "system.bootstrap_admin", email);
    await ensureDefaultTracks();
  }
  if (!user || !["INVITED", "ACTIVE"].includes(user.status)) {
    await db.otpChallenge.create({ data: { email, codeHash: "-", expiresAt: new Date(now), ip } });
    return { ok: true };
  }
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await db.otpChallenge.create({ data: { email, codeHash: codeHash(email, code), expiresAt: new Date(now + 10 * 60_000), ip } });
  await sendMail({
    to: email,
    subject: `Your sign-in code: ${code}`,
    body: `Hi ${user.name.split(" ")[0]},\n\nYour one-time sign-in code is ${code}. It expires in 10 minutes and can be used once.\n\nIf you did not ask for this, you can ignore this email.`,
    type: "otp",
  });
  return { ok: true, devCode: process.env.SHOW_DEV_CODES === "true" ? code : undefined };
}

export async function verifyOtp(rawEmail: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = rawEmail.trim().toLowerCase();
  const now = new Date();
  const since = new Date(now.getTime() - 15 * 60_000);
  const recent = await db.otpChallenge.findMany({ where: { email, createdAt: { gt: since } }, orderBy: { createdAt: "desc" } });
  const wrong = recent.reduce((n, r) => n + r.attempts, 0);
  if (wrong >= 5) return { ok: false, error: "Too many wrong tries. This email is locked for 15 minutes." };
  const ch = recent.find((r) => !r.usedAt && r.expiresAt > now && r.codeHash !== "-");
  const bad = { ok: false as const, error: "That code is not right or has expired." };
  if (!ch) {
    if (recent[0]) await db.otpChallenge.update({ where: { id: recent[0].id }, data: { attempts: { increment: 1 } } });
    return bad;
  }
  const a = Buffer.from(ch.codeHash), b = Buffer.from(codeHash(email, code.trim()));
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    await db.otpChallenge.update({ where: { id: ch.id }, data: { attempts: { increment: 1 } } });
    return bad;
  }
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !["INVITED", "ACTIVE"].includes(user.status)) return bad;
  await db.otpChallenge.update({ where: { id: ch.id }, data: { usedAt: now } });
  const s = await getSettings();
  const days = isAdminRole(user.role) ? s.adminSessionDays : s.sessionDays;
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(now.getTime() + days * 86400_000);
  await db.authSession.create({ data: { tokenHash: sha(token), userId: user.id, expiresAt } });
  await db.user.update({
    where: { id: user.id },
    data: { status: "ACTIVE", firstSignInAt: user.firstSignInAt ?? now, lastSeenAt: now },
  });
  if (!user.firstSignInAt) await audit(user, "user.first_sign_in", user.email);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" && appUrl().startsWith("https"), path: "/", expires: expiresAt,
  });
  return { ok: true };
}

export const getUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await db.authSession.findUnique({ where: { tokenHash: sha(token) }, include: { user: true } });
  if (!s || s.expiresAt < new Date() || s.user.status !== "ACTIVE") return null;
  return s.user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/sign-in");
  return user;
}

/** Signed in, terms accepted and profile finished. */
export async function requireReady() {
  const user = await requireUser();
  if (!user.onboardedAt) redirect("/welcome");
  return user;
}

export async function requireStaff() {
  const user = await requireReady();
  if (!isStaffRole(user.role)) redirect("/home");
  return user;
}

export async function requireAdmin() {
  const user = await requireReady();
  if (!isAdminRole(user.role)) redirect(isStaffRole(user.role) ? "/admin" : "/home");
  return user;
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.authSession.deleteMany({ where: { tokenHash: sha(token) } });
  jar.delete(COOKIE);
}
