import { cookies } from "next/headers";
import { cache } from "react";
import { isAdminRole } from "./auth";
import { db } from "./db";

/** The cohort the admin console is looking at. Stored in a cookie; defaults to the newest live cohort. */
export const currentCohort = cache(async () => {
  const cohorts = await db.cohort.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: { startDate: "desc" } });
  const id = (await cookies()).get("emp_cohort")?.value;
  const picked = cohorts.find((c) => c.id === id) ?? cohorts.find((c) => c.status === "ACTIVE") ?? cohorts.find((c) => c.status === "ONBOARDING") ?? cohorts[0] ?? null;
  return { cohort: picked, cohorts };
});

/** null = every track; otherwise the track ids a coordinator may see. */
export async function trackScope(user: { id: string; role: string }): Promise<string[] | null> {
  if (isAdminRole(user.role)) return null;
  const tracks = await db.track.findMany({ where: { coordinatorId: user.id }, select: { id: true } });
  return tracks.map((t) => t.id);
}

export const inScope = (scope: string[] | null) => (scope ? { in: scope } : undefined);
