import { AlertTriangle, ArrowRight, CalendarCheck, HeartHandshake, Hourglass, Inbox, Layers, ShieldAlert, Star, TrendingUp, UserPlus, UserX, Users } from "lucide-react";
import Link from "next/link";
import { Empty, PageHeader, Panel, Stat } from "@/components/app/bits";
import MetricCard from "@/components/kokonutui/metric-card";
import { Button } from "@/components/ui/button";
import { adminCtx, cohortPairs, onboardingFunnel, pct } from "@/lib/admin";
import { isAdminRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { DAY_MS, fmtDay, localParts, relTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Dashboard" };

export default async function AdminDashboard() {
  const { user, cohort, trackIds } = await adminCtx();
  const s = await getSettings();
  if (!cohort) {
    return (
      <div>
        <PageHeader title="Welcome" description="Start by creating your first cohort." />
        <Panel><Empty action={isAdminRole(user.role) ? <Button asChild><Link href="/admin/cohorts/new">Create a cohort</Link></Button> : undefined} description="A cohort is one intake of mentors and mentees, with its own dates and tracks." icon={Layers} title="No cohorts yet" /></Panel>
      </div>
    );
  }
  const now = new Date();
  const since = new Date(now.getTime() - 60 * DAY_MS);
  const inCohort = { match: { cohortId: cohort.id, trackId: { in: trackIds } } };
  const [pairs, funnel, sessions, feedback, stuck, cases, audit] = await Promise.all([
    cohortPairs(cohort.id, trackIds),
    onboardingFunnel(cohort.id, trackIds),
    db.session.findMany({ where: { ...inCohort, startsAt: { gt: since } }, select: { status: true, startsAt: true, endsAt: true } }),
    db.feedback.findMany({ where: { session: inCohort }, select: { usefulness: true, preparedness: true, connection: true, flagged: true, createdAt: true } }),
    db.match.count({ where: { cohortId: cohort.id, trackId: { in: trackIds }, status: "REQUESTED", createdAt: { lt: new Date(now.getTime() - 2 * DAY_MS) } } }),
    isAdminRole(user.role) ? db.safetyCase.count({ where: { status: { not: "RESOLVED" } } }) : 0,
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const active = pairs.filter((p) => p.status === "ACTIVE");
  const risk = active.filter((p) => p.health.band === "At risk");
  const quiet = active.filter((p) => p.health.band === "Quiet");
  const month = sessions.filter((x) => x.startsAt.getTime() > now.getTime() - 30 * DAY_MS && x.startsAt <= now);
  const held = month.filter((x) => x.status === "HELD").length;
  const scheduled = month.filter((x) => ["HELD", "NO_SHOW_MENTEE", "NO_SHOW_MENTOR", "CANCELLED", "CONFIRMED"].includes(x.status)).length;
  const unlogged = sessions.filter((x) => x.status === "CONFIRMED" && x.endsAt < now).length;
  const avg = feedback.length ? feedback.reduce((n, f) => n + (f.usefulness + f.preparedness + f.connection) / 3, 0) / feedback.length : 0;
  const flagged = feedback.filter((f) => f.flagged && f.createdAt.getTime() > now.getTime() - 14 * DAY_MS).length;

  const byDay = new Map<string, [number, number]>();
  for (let i = 59; i >= 0; i--) byDay.set(localParts(new Date(now.getTime() - i * DAY_MS), user.timezone).iso, [0, 0]);
  for (const x of sessions) {
    const row = byDay.get(localParts(x.startsAt, user.timezone).iso);
    if (!row || x.startsAt > now) continue;
    if (x.status === "HELD") row[0]++;
    else if (x.status.startsWith("NO_SHOW") || x.status === "CANCELLED") row[1]++;
  }

  const queue = [
    { n: funnel.unassigned, label: "mentees waiting for a mentor", href: "/admin/matching", icon: UserPlus, tone: "text-brand" },
    { n: stuck, label: "mentor requests unanswered for 2+ days", href: "/admin/matching", icon: Hourglass, tone: "text-amber-600" },
    { n: risk.length, label: "pairs at risk", href: "/admin/pairs?health=At+risk", icon: AlertTriangle, tone: "text-rose-600" },
    { n: unlogged, label: "finished sessions not logged", href: "/admin/sessions?view=unlogged", icon: Inbox, tone: "text-sky-600" },
    { n: flagged, label: "low or flagged ratings in the last 2 weeks", href: "/admin/feedback", icon: Star, tone: "text-amber-600" },
    { n: cases, label: "open safety cases", href: "/admin/safety", icon: ShieldAlert, tone: "text-rose-600" },
    { n: funnel.mentees.invited - funnel.mentees.signedIn, label: "mentees have not signed in yet", href: "/admin/people?status=INVITED", icon: UserX, tone: "text-muted-foreground" },
  ].filter((q) => q.n > 0);

  const steps = [
    ["Invited", funnel.mentees.invited], ["Signed in", funnel.mentees.signedIn], ["Profile done", funnel.mentees.onboarded],
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={isAdminRole(user.role) ? <Button asChild variant="outline"><Link href={`/admin/cohorts/${cohort.id}`}>Cohort setup <ArrowRight className="size-4" /></Link></Button> : undefined}
        description={`${fmtDay(cohort.startDate, user.timezone, { year: true, weekday: false })} to ${fmtDay(cohort.endDate, user.timezone, { year: true, weekday: false })} · ${cohort.status.toLowerCase()}`}
        eyebrow="Dashboard"
        title={cohort.name}
      />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat hint={`${quiet.length} quiet · ${risk.length} at risk`} href="/admin/pairs" icon={HeartHandshake} label="Active pairs" value={active.length} />
        <Stat hint={`of ${funnel.mentees.seats} mentee places`} href="/admin/matching" icon={Users} label="Waiting for a mentor" tone={funnel.unassigned ? "amber" : "green"} value={funnel.unassigned} />
        <Stat hint={`${held} held of ${scheduled} scheduled, last 30 days`} href="/admin/sessions" icon={CalendarCheck} label="Session completion" tone={pct(held, scheduled) >= 80 ? "green" : "amber"} value={`${pct(held, scheduled)}%`} />
        <Stat hint={`${feedback.length} ratings · target 4.4`} href={s.modules.feedback ? "/admin/feedback" : undefined} icon={Star} label="Average rating" tone="blue" value={avg ? avg.toFixed(1) : "–"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel bodyClassName="p-0" className="lg:col-span-2" description="Who needs attention, most urgent first" title="Action queue">
          {queue.length === 0 ? <Empty description="Nothing is waiting on you." icon={TrendingUp} title="All clear" /> : (
            <ul className="divide-y">
              {queue.map((q) => (
                <li key={q.label}>
                  <Link className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-accent/50" href={q.href}>
                    <span className={cn("flex size-9 items-center justify-center rounded-xl bg-muted", q.tone)}><q.icon className="size-4" /></span>
                    <span className="flex-1 text-sm"><span className="mr-1.5 font-semibold tabular-nums">{q.n}</span>{q.label}</span>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel description="Mentees, from invite to first session" title="Onboarding">
          <ol className="space-y-3">
            {[...steps, ["Paired", funnel.mentees.paired, funnel.mentees.seats] as const, ["First session held", funnel.mentees.met, funnel.mentees.seats] as const].map(([label, n, of]) => {
              const total = of ?? funnel.mentees.invited;
              return (
                <li key={label}>
                  <div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="text-muted-foreground tabular-nums">{n}<span className="text-xs"> / {total}</span></span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-navy dark:bg-cyan" style={{ width: `${pct(n, total)}%` }} /></div>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 border-t pt-3 text-muted-foreground text-xs">Mentors: {funnel.mentors.onboarded} of {funnel.mentors.invited} ready.</p>
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 [&>div]:w-full [&>div]:max-w-none">
          <MetricCard
            data={[...byDay.entries()].map(([date, parts]) => ({ date, parts }))}
            defaultPeriod={30}
            events={[]}
            format="number"
            label="Sessions"
            periods={[7, 30]}
            segments={["Held", "Missed or cancelled"]}
          />
        </div>
        <Panel action={<Button asChild size="sm" variant="ghost"><Link href="/admin/pairs">All pairs</Link></Button>} description="Each dot is a pair. Click to open it." title="Pair health board">
          {pairs.length === 0 ? <p className="text-muted-foreground text-sm">No pairs yet.</p> : (
            <>
              <div className="flex flex-wrap gap-1.5">
                {[...pairs].sort((a, b) => a.health.score - b.health.score).map((p) => (
                  <Link
                    aria-label={`${p.mentee.name} and ${p.mentor.name}: ${p.health.band}, ${p.health.score}`}
                    className={cn("size-5 rounded-md transition-transform hover:scale-125", p.status === "PAUSED" ? "bg-zinc-300 dark:bg-zinc-600" : p.health.band === "Healthy" ? "bg-emerald-500" : p.health.band === "Quiet" ? "bg-amber-400" : "bg-rose-500")}
                    href={`/pairs/${p.id}`}
                    key={p.id}
                    title={`${p.mentee.name} ↔ ${p.mentor.name} · ${p.health.band} (${p.health.score})`}
                  />
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-emerald-500" />Healthy {active.length - quiet.length - risk.length}</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-amber-400" />Quiet {quiet.length}</span>
                <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-rose-500" />At risk {risk.length}</span>
              </div>
            </>
          )}
        </Panel>
      </div>

      <Panel action={isAdminRole(user.role) ? <Button asChild size="sm" variant="ghost"><Link href="/admin/settings?tab=audit">Audit log</Link></Button> : undefined} bodyClassName="p-0" title="Recent activity">
        <ul className="divide-y">
          {audit.map((a) => (
            <li className="flex items-center gap-3 px-5 py-3 text-sm" key={a.id}>
              <span className="size-1.5 shrink-0 rounded-full bg-brand" />
              <span className="min-w-0 flex-1 truncate"><span className="font-medium">{a.actorName}</span> <span className="text-muted-foreground">{a.action.replace(/[._]/g, " ")}</span> {a.target}</span>
              <span className="shrink-0 text-muted-foreground text-xs">{relTime(a.createdAt, now)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
