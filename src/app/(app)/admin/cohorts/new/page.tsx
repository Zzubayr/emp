import { PageHeader } from "@/components/app/bits";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { CohortForm } from "../form";

export const metadata = { title: "New cohort" };

export default async function NewCohort() {
  await requireAdmin();
  const [tracks, cohorts] = await Promise.all([
    db.track.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: [{ area: "asc" }, { name: "asc" }] }),
    db.cohort.findMany({ orderBy: { startDate: "desc" }, include: { _count: { select: { memberships: { where: { role: "MENTOR" } } } } } }),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader description="Three steps: name and dates, tracks, then who carries over. You add people and send invites on the next screen." eyebrow="Cohorts" title="New cohort" />
      <CohortForm cohorts={cohorts.map((c) => ({ id: c.id, name: c.name, mentors: c._count.memberships }))} tracks={tracks.map((t) => ({ id: t.id, name: t.name, area: t.area, mode: t.assignmentMode }))} />
    </div>
  );
}
