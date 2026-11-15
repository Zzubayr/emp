import { ArrowRight, CalendarRange, Layers, Plus } from "lucide-react";
import Link from "next/link";
import { Chip, Empty, PageHeader, Panel } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDay } from "@/lib/time";

export const metadata = { title: "Cohorts" };

export default async function Cohorts() {
  const user = await requireAdmin();
  const cohorts = await db.cohort.findMany({ orderBy: { startDate: "desc" }, include: { tracks: true, _count: { select: { matches: { where: { status: { in: ["ACTIVE", "PAUSED"] } } } } }, memberships: { select: { role: true, userId: true } } } });
  return (
    <div>
      <PageHeader
        actions={<Button asChild><Link href="/admin/cohorts/new"><Plus className="size-4" /> New cohort</Link></Button>}
        description="A cohort is one intake of mentors and mentees with its own dates and tracks. Run several side by side, and switch between them from the sidebar."
        title="Cohorts"
      />
      {cohorts.length === 0 ? <Panel><Empty action={<Button asChild><Link href="/admin/cohorts/new">Create your first cohort</Link></Button>} description="Pick the tracks, add the people you selected, and send invites." icon={Layers} title="No cohorts yet" /></Panel> : (
        <div className="grid gap-4 md:grid-cols-2">
          {cohorts.map((c) => {
            const mentees = new Set(c.memberships.filter((m) => m.role === "MENTEE").map((m) => m.userId)).size;
            const mentors = new Set(c.memberships.filter((m) => m.role === "MENTOR").map((m) => m.userId)).size;
            return (
              <Link className="surface group block p-5 transition-[translate,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-lg" href={`/admin/cohorts/${c.id}`} key={c.id}>
                <div className="flex items-start justify-between gap-3">
                  <div><h2 className="font-semibold text-lg">{c.name}</h2><p className="mt-0.5 flex items-center gap-1.5 text-muted-foreground text-sm"><CalendarRange className="size-4" />{fmtDay(c.startDate, user.timezone, { year: true, weekday: false })} to {fmtDay(c.endDate, user.timezone, { year: true, weekday: false })}</p></div>
                  <Chip status={c.status} />
                </div>
                {c.description && <p className="mt-3 line-clamp-2 text-muted-foreground text-sm">{c.description}</p>}
                <dl className="mt-4 grid grid-cols-4 gap-2 border-t pt-4 text-sm">
                  {[["Tracks", c.tracks.length], ["Mentees", mentees], ["Mentors", mentors], ["Pairs", c._count.matches]].map(([l, v]) => <div key={l}><dt className="text-muted-foreground text-xs">{l}</dt><dd className="font-semibold text-lg tabular-nums">{v}</dd></div>)}
                </dl>
                <span className="mt-3 inline-flex items-center gap-1 font-medium text-brand text-sm">Open <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" /></span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
