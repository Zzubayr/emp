import { ArrowRight, CheckCircle2, Circle, Mail, Rocket, Shuffle, Upload, UsersRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { setCohortStatus, switchCohort } from "@/actions/admin";
import { promoteLevels } from "@/actions/people";
import { ActionButton } from "@/components/app/action-form";
import { Chip, PageHeader, Panel, Tag } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { onboardingFunnel, pct } from "@/lib/admin";
import { requireAdmin } from "@/lib/auth";
import { ASSIGNMENT_MODES } from "@/lib/constants";
import { db } from "@/lib/db";
import { currentCohort } from "@/lib/scope";
import { fmtDay } from "@/lib/time";
import { cn } from "@/lib/utils";
import { CohortForm } from "../form";

export const metadata = { title: "Cohort" };

export default async function CohortDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAdmin();
  const c = await db.cohort.findUnique({ where: { id }, include: { tracks: { include: { track: true } } } });
  if (!c) notFound();
  const trackIds = c.tracks.map((t) => t.trackId);
  const [{ cohort: current }, funnel, allTracks, members, matches, invitedNotSent] = await Promise.all([
    currentCohort(),
    onboardingFunnel(c.id, trackIds),
    db.track.findMany({ where: { status: { not: "ARCHIVED" } }, orderBy: [{ area: "asc" }, { name: "asc" }] }),
    db.membership.groupBy({ by: ["trackId", "role"], where: { cohortId: c.id, status: { not: "REMOVED" } }, _count: true }),
    db.match.groupBy({ by: ["trackId"], where: { cohortId: c.id, status: { in: ["ACTIVE", "PAUSED"] } }, _count: true }),
    db.user.count({ where: { status: "INVITED", inviteCount: 0, memberships: { some: { cohortId: c.id } } } }),
  ]);
  const count = (trackId: string, role: string) => members.find((m) => m.trackId === trackId && m.role === role)?._count ?? 0;
  const people = funnel.mentees.invited + funnel.mentors.invited;
  const steps = [
    { done: trackIds.length > 0, title: "Choose tracks", body: `${trackIds.length} track${trackIds.length === 1 ? "" : "s"} in this cohort`, href: "#edit", cta: "Edit tracks", icon: Rocket },
    { done: funnel.mentors.invited > 0 && funnel.mentees.invited > 0, title: "Add the people you selected", body: `${funnel.mentees.invited} mentees and ${funnel.mentors.invited} mentors on the allow list`, href: "/admin/people/import", cta: "Import people", icon: Upload },
    { done: people > 0 && invitedNotSent === 0, title: "Send invites", body: invitedNotSent ? `${invitedNotSent} people have not been sent an invite yet` : `${funnel.mentees.signedIn + funnel.mentors.signedIn} of ${people} have signed in`, href: "/admin/people?status=INVITED", cta: "Review invites", icon: Mail },
    { done: funnel.mentees.seats > 0 && funnel.mentees.paired === funnel.mentees.seats, title: "Pair mentees with mentors", body: `${funnel.mentees.paired} of ${funnel.mentees.seats} mentee places paired`, href: "/admin/matching", cta: "Open assignment", icon: Shuffle },
    { done: c.status === "ACTIVE" || c.status === "COMPLETED", title: "Go live", body: c.status === "ACTIVE" ? "This cohort is live" : "Mark the cohort active when onboarding is under way", href: "#status", cta: "Set status", icon: UsersRound },
  ];
  const isCurrent = current?.id === c.id;

  return (
    <div className="space-y-6">
      <PageHeader
        actions={!isCurrent && c.status !== "ARCHIVED" ? <ActionButton action={switchCohort.bind(null, c.id)} variant="outline">Work in this cohort</ActionButton> : <Button asChild variant="outline"><Link href="/admin">Dashboard <ArrowRight className="size-4" /></Link></Button>}
        description={`${fmtDay(c.startDate, user.timezone, { year: true, weekday: false })} to ${fmtDay(c.endDate, user.timezone, { year: true, weekday: false })}${c.description ? ` · ${c.description}` : ""}`}
        eyebrow={<Link className="hover:underline" href="/admin/cohorts">Cohorts</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{c.name} <Chip status={c.status} /></span>}
      />
      {!isCurrent && c.status !== "ARCHIVED" && <p className="rounded-xl border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm">You are viewing a different cohort from the one selected in the sidebar. Choose “Work in this cohort” before importing people or assigning mentors.</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel bodyClassName="p-0" className="lg:col-span-2" description="Follow these in order to onboard a new intake" title="Onboarding checklist">
          <ol className="divide-y">
            {steps.map((st, i) => (
              <li className="flex items-center gap-4 px-5 py-4" key={st.title}>
                {st.done ? <CheckCircle2 className="size-6 shrink-0 text-emerald-500" /> : <Circle className="size-6 shrink-0 text-muted-foreground/40" />}
                <div className="min-w-0 flex-1">
                  <div className={cn("font-medium text-sm", st.done && "text-muted-foreground")}>{i + 1}. {st.title}</div>
                  <div className="text-muted-foreground text-xs">{st.body}</div>
                </div>
                <Button asChild size="sm" variant={st.done ? "ghost" : "secondary"}><Link href={st.href}>{st.cta}</Link></Button>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel description="Mentees" title="Progress">
          <ol className="space-y-3">
            {([["Invited", funnel.mentees.invited, funnel.mentees.invited], ["Signed in", funnel.mentees.signedIn, funnel.mentees.invited], ["Profile done", funnel.mentees.onboarded, funnel.mentees.invited], ["Paired", funnel.mentees.paired, funnel.mentees.seats], ["First session held", funnel.mentees.met, funnel.mentees.seats]] as const).map(([l, n, of]) => (
              <li key={l}>
                <div className="mb-1 flex justify-between text-sm"><span>{l}</span><span className="text-muted-foreground tabular-nums">{n} / {of}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-navy dark:bg-cyan" style={{ width: `${pct(n, of)}%` }} /></div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>

      <Panel bodyClassName="p-0" title="Tracks in this cohort">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground text-xs"><th className="px-5 py-3 font-medium">Track</th><th className="px-3 py-3 font-medium">Assignment</th><th className="px-3 py-3 text-right font-medium">Mentees</th><th className="px-3 py-3 text-right font-medium">Mentors</th><th className="px-5 py-3 text-right font-medium">Paired</th></tr></thead>
            <tbody className="divide-y">
              {c.tracks.map(({ track: t }) => {
                const me = count(t.id, "MENTEE"), paired = matches.find((m) => m.trackId === t.id)?._count ?? 0;
                return (
                  <tr className="hover:bg-accent/40" key={t.id}>
                    <td className="px-5 py-3"><Link className="font-medium hover:underline" href={`/admin/tracks/${t.id}`}>{t.name}</Link> <Tag className="ml-1">{t.area === "ACADEMIC" ? "Academic" : "Non-academic"}</Tag></td>
                    <td className="px-3 py-3 text-muted-foreground">{ASSIGNMENT_MODES[t.assignmentMode].label}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{me}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{count(t.id, "MENTOR")}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{paired}<span className="text-muted-foreground"> / {me}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel description="Completing a cohort ends its pairs and cancels future sessions. History is kept." id="status" title="Status">
        <div className="flex flex-wrap gap-2">
          {c.status !== "ONBOARDING" && c.status !== "COMPLETED" && c.status !== "ACTIVE" && <ActionButton action={setCohortStatus.bind(null, c.id, "ONBOARDING")} variant="outline">Start onboarding</ActionButton>}
          {c.status !== "ACTIVE" && c.status !== "COMPLETED" && <ActionButton action={setCohortStatus.bind(null, c.id, "ACTIVE")}>Mark as active</ActionButton>}
          {c.status === "ACTIVE" && <ActionButton action={setCohortStatus.bind(null, c.id, "COMPLETED")} confirm="Complete this cohort? Every pair will be ended and future sessions cancelled. This cannot be undone in one click." confirmLabel="Complete cohort" variant="outline">Complete cohort</ActionButton>}
          {c.status === "COMPLETED" && <ActionButton action={setCohortStatus.bind(null, c.id, "ARCHIVED")} confirm="Archive this cohort? It will be hidden from the cohort switcher." variant="outline">Archive</ActionButton>}
          {c.status === "ARCHIVED" && <ActionButton action={setCohortStatus.bind(null, c.id, "COMPLETED")} variant="outline">Unarchive</ActionButton>}
          <ActionButton action={promoteLevels.bind(null, c.id)} confirm="Move every mentee in this cohort up one level (100 to 200, and so on)? Do this once, at the start of a new academic year." confirmLabel="Move up" variant="ghost">Move students up one level</ActionButton>
        </div>
      </Panel>

      <div className="scroll-mt-20" id="edit">
        <h2 className="mb-3 font-semibold text-lg">Edit cohort</h2>
        <CohortForm
          cohort={{ id: c.id, name: c.name, description: c.description, startDate: c.startDate.toISOString().slice(0, 10), endDate: c.endDate.toISOString().slice(0, 10), trackIds }}
          cohorts={[]}
          tracks={allTracks.map((t) => ({ id: t.id, name: t.name, area: t.area, mode: t.assignmentMode }))}
        />
      </div>
    </div>
  );
}
