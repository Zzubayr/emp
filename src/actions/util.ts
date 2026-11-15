import type { ActionResult } from "@/components/app/action-form";
import { getUser, isAdminRole, isStaffRole } from "@/lib/auth";
import { db } from "@/lib/db";

export type R = ActionResult;
export const fail = (error: string): R => ({ ok: false, error });
export const done = (message?: string, redirect?: string): R => ({ ok: true, message, redirect });

export class Denied extends Error {}

export async function me() {
  const user = await getUser();
  if (!user) throw new Denied("Please sign in again.");
  return user;
}

export async function admin() {
  const user = await me();
  if (!isAdminRole(user.role)) throw new Denied("Only program admins can do that.");
  return user;
}

/** Admin, or the coordinator of this track. */
export async function staff(trackId?: string | null) {
  const user = await me();
  if (isAdminRole(user.role)) return user;
  if (user.role === "COORDINATOR" && trackId) {
    const t = await db.track.findFirst({ where: { id: trackId, coordinatorId: user.id } });
    if (t) return user;
  }
  throw new Denied("You do not have access to that track.");
}

/** Loads a pair if the user is in it, or is staff for its track. */
export async function pair(matchId: string) {
  const user = await me();
  const match = await db.match.findUnique({ where: { id: matchId }, include: { mentee: true, mentor: true, track: true } });
  if (!match) throw new Denied("That pair no longer exists.");
  const member = match.menteeId === user.id || match.mentorId === user.id;
  if (!member) {
    if (!isStaffRole(user.role)) throw new Denied("You do not have access to that pair.");
    await staff(match.trackId);
  }
  return { user, match, member, isMentor: match.mentorId === user.id, isMentee: match.menteeId === user.id };
}

/** Wraps an action so permission and validation errors come back as a toast instead of a crash. */
export function safe<A extends unknown[]>(fn: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof Denied) return fail(e.message);
      if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) throw e;
      console.error("[action]", e);
      return fail("Something went wrong. Please try again.");
    }
  };
}

export const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
export const opt = (fd: FormData, key: string) => str(fd, key) || null;
export const int = (fd: FormData, key: string, fallback: number) => {
  const n = Number.parseInt(str(fd, key), 10);
  return Number.isFinite(n) ? n : fallback;
};
export const list = (fd: FormData, key: string): string[] => {
  try {
    const v = JSON.parse(str(fd, key) || "[]");
    return Array.isArray(v) ? v.map(String).slice(0, 20) : [];
  } catch {
    return [];
  }
};
