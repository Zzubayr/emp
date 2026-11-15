import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { Empty, PageHeader, Panel, Stat } from "@/components/app/bits";
import { SessionList } from "@/components/app/session-list";
import { Button } from "@/components/ui/button";
import { adminCtx, pct } from "@/lib/admin";
import { db } from "@/lib/db";
import { DAY_MS } from "@/lib/time";
import { cn } from "@/lib/utils";
import { CalendarCheck, CalendarX, Clock, Inbox } from "lucide-react";

export const metadata = { title: "Sessions" };
const VIEWS = { upcoming: "Upcoming", unlogged: "Not logged", held: "Held", missed: "Missed and cancelled", proposed: "Awaiting confirmation" } as const;

export default async function AdminSessions({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { user, cohort, trackIds } = await adminCtx();
  const sp = await searchParams;
  const view = (sp.view && sp.view in VIEWS ? sp.view : "upcoming") as keyof typeof VIEWS;
  const now = new Date();
  const base = { match: { cohortId: cohort?.id ?? "-", trackId: { in: trackIds } } };
  const where = {
    upcoming: { status: "CONFIRMED", endsAt: { gt: now } },
    unlogged: { status: "CONFIRMED", endsAt: { lte: now } },
    held: { status: "HELD" },
    missed: { status: { in: ["NO_SHOW_MENTEE", "NO_SHOW_MENTOR", "CANCELLED", "EXPIRED"] } },
    proposed: { status: "PROPOSED" },
  }[view];
  const [rows, month, lateCancels] = await Promise.all([
    db.session.findMany({ where: { ...base, ...where }, include: { match: { include: { mentee: true, mentor: true, track: true } } }, orderBy: { startsAt: view === "upcoming" || view === "proposed" ? "asc" : "desc" }, take: 80 }),
    db.session.groupBy({ by: ["status"], where: { ...base, startsAt: { gt: new Date(now.getTime() - 30 * DAY_MS), lte: now } }, _count: true }),
    db.session.count({ where: { ...base, lateCancel: true, startsAt: { gt: new Date(now.getTime() - 30 * DAY_MS) } } }),
  ]);
  const n = (...s: string[]) => month.filter((m) => s.includes(m.status)).reduce((a, m) => a + m._count, 0);
  const held = n("HELD"), noShow = n("NO_SHOW_MENTEE", "NO_SHOW_MENTOR"), total = held + noShow + n("CANCELLED", "CONFIRMED");
  return (
    <div className="space-y-6">
      <PageHeader actions={<Button asChild variant="outline"><a href="/api/export/sessions">Export CSV</a></Button>} description="Every session in the cohort. Figures cover the last 30 days." title="Sessions" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat hint="target 80%" icon={CalendarCheck} label="Completion rate" tone={pct(held, total) >= 80 ? "green" : "amber"} value={`${pct(held, total)}%`} />
        <Stat icon={Clock} label="Sessions held" tone="blue" value={held} />
        <Stat hint={`${pct(noShow, held + noShow)}% of sessions · target under 10%`} icon={CalendarX} label="No-shows" tone={noShow ? "red" : "green"} value={noShow} />
        <Stat icon={Inbox} label="Late cancellations" tone="amber" value={lateCancels} />
      </div>
      <Panel bodyClassName="p-0">
        <div className="flex gap-1 overflow-x-auto border-b p-2">
          {Object.entries(VIEWS).map(([k, label]) => <Link className={cn("shrink-0 rounded-lg px-3 py-1.5 text-sm transition-colors", k === view ? "bg-brand-soft font-medium text-brand" : "text-muted-foreground hover:bg-accent")} href={`/admin/sessions?view=${k}`} key={k}>{label}</Link>)}
        </div>
        {rows.length ? <SessionList admin sessions={rows} tz={user.timezone} /> : <Empty description="Nothing in this view right now." icon={CalendarDays} title="No sessions" />}
      </Panel>
    </div>
  );
}
