import { Plus, Route } from "lucide-react";
import Link from "next/link";
import { createTrack } from "@/actions/admin";
import { ActionForm, Submit } from "@/components/app/action-form";
import { Chip, Empty, NativeSelect, PageHeader, Panel, Tag } from "@/components/app/bits";
import { TrackIcon } from "@/components/app/track-icon";
import { Input } from "@/components/ui/input";
import { adminCtx } from "@/lib/admin";
import { isAdminRole } from "@/lib/auth";
import { ASSIGNMENT_MODES } from "@/lib/constants";
import { db } from "@/lib/db";

export const metadata = { title: "Tracks" };

export default async function Tracks() {
  const { user, cohort, scope } = await adminCtx();
  const tracks = await db.track.findMany({
    where: scope ? { id: { in: scope } } : {},
    orderBy: [{ area: "asc" }, { name: "asc" }],
    include: { coordinator: { select: { name: true } }, cohorts: { select: { cohortId: true } }, memberships: { where: { cohortId: cohort?.id ?? "-" }, select: { role: true } } },
  });
  const admin = isAdminRole(user.role);
  return (
    <div>
      <PageHeader description="A track is a mentorship stream with its own mentors, mentees, rules and assignment mode. Everything here is a setting; nothing needs a code change." title="Tracks" />
      {admin && (
        <Panel className="mb-6" title="Create a track">
          <ActionForm action={createTrack} className="flex flex-col gap-3 sm:flex-row" resetOnSuccess>
            {cohort && <input name="cohortId" type="hidden" value={cohort.id} />}
            <Input aria-label="Track name" className="flex-1" minLength={2} name="name" placeholder="Track name, for example Research and Further Studies" required />
            <NativeSelect aria-label="Area" className="sm:w-44" name="area"><option value="NON_ACADEMIC">Non-academic</option><option value="ACADEMIC">Academic</option></NativeSelect>
            <Submit><Plus className="size-4" /> Create</Submit>
          </ActionForm>
          {cohort && <p className="mt-2 text-muted-foreground text-xs">The new track is added to {cohort.name}.</p>}
        </Panel>
      )}
      {tracks.length === 0 && <Panel><Empty description={admin ? "Create your first track above." : "You have not been made coordinator of a track yet."} icon={Route} title="No tracks" /></Panel>}
      {(["ACADEMIC", "NON_ACADEMIC"] as const).map((area) => {
        const list = tracks.filter((t) => t.area === area);
        if (!list.length) return null;
        return (
          <section className="mb-8" key={area}>
            <h2 className="mb-3 font-semibold text-lg">{area === "ACADEMIC" ? "Academic" : "Non-academic"}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {list.map((t) => {
                const inCohort = cohort && t.cohorts.some((c) => c.cohortId === cohort.id);
                return (
                  <Link className="surface group block p-5 transition-[translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg" href={`/admin/tracks/${t.id}`} key={t.id}>
                    <div className="flex items-start justify-between">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand"><TrackIcon className="size-5" name={t.icon} /></span>
                      <Chip status={t.status} />
                    </div>
                    <h3 className="mt-3 font-semibold">{t.name}</h3>
                    <p className="mt-1 line-clamp-2 min-h-10 text-muted-foreground text-sm">{t.description}</p>
                    <div className="mt-3 flex flex-wrap gap-1.5"><Tag>{ASSIGNMENT_MODES[t.assignmentMode].label}</Tag>{t.coordinator && <Tag>{t.coordinator.name}</Tag>}</div>
                    <div className="mt-4 border-t pt-3 text-muted-foreground text-xs">
                      {inCohort ? `${t.memberships.filter((m) => m.role === "MENTEE").length} mentees · ${t.memberships.filter((m) => m.role === "MENTOR").length} mentors in ${cohort.name}` : "Not in the selected cohort"}
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
