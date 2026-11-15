import { CalendarClock, CheckCircle2, Hourglass, Shuffle, Sparkles, UserPlus, Wand2 } from "lucide-react";
import Link from "next/link";
import { addExclusion, assignPair, autoAssign } from "@/actions/matching";
import { ActionButton, ActionForm, Submit } from "@/components/app/action-form";
import { Empty, NativeSelect, PageHeader, Panel, Tag, UserAvatar } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminCtx } from "@/lib/admin";
import { ASSIGNMENT_MODES } from "@/lib/constants";
import { db } from "@/lib/db";
import { suggestionsFor, trackMentors, unmatchedMentees } from "@/lib/matching";
import { fmtDay, relTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Assignment" };

export default async function Matching({ searchParams }: { searchParams: Promise<{ track?: string }> }) {
  const { user, cohort, tracks } = await adminCtx();
  const sp = await searchParams;
  if (!cohort || tracks.length === 0) return <div><PageHeader title="Assignment" /><Panel><Empty description="Add tracks to the cohort first." icon={Shuffle} title="Nothing to assign yet" /></Panel></div>;
  const counts = await Promise.all(tracks.map(async (t) => (await unmatchedMentees(cohort.id, t.id)).length));
  const track = tracks.find((t) => t.id === sp.track) ?? tracks[counts.findIndex((c) => c > 0)] ?? tracks[0];
  const now = new Date();
  const [waiting, mentors, requests, rankings] = await Promise.all([
    unmatchedMentees(cohort.id, track.id),
    trackMentors(cohort.id, track.id),
    db.match.findMany({ where: { cohortId: cohort.id, trackId: track.id, status: "REQUESTED" }, include: { mentee: true, mentor: true }, orderBy: { createdAt: "asc" } }),
    db.mentorRanking.findMany({ where: { cohortId: cohort.id, trackId: track.id } }),
  ]);
  const ready = waiting.filter((m) => m.onboardedAt);
  const notReady = waiting.length - ready.length;
  const shown = ready.slice(0, 40);
  const sug = await Promise.all(shown.map((m) => suggestionsFor(m.id, cohort.id, track.id)));
  const byId = new Map(mentors.map((m) => [m.user.id, m]));
  const spots = mentors.reduce((n, m) => n + m.spots, 0);
  const mode = track.assignmentMode;
  const windowState = track.windowClose ? (now > track.windowClose ? "closed" : track.windowOpen && now < track.windowOpen ? "not open yet" : `closes ${relTime(track.windowClose, now)}`) : "always open";

  return (
    <div>
      <PageHeader description={`Pair mentees with mentors in ${cohort.name}. Suggestions score fit, availability, language and capacity; hard exclusions always win.`} title="Assignment" />
      <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {tracks.map((t, i) => (
          <Link className={cn("flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm transition-colors", t.id === track.id ? "border-brand bg-brand text-primary-foreground" : "bg-card hover:bg-accent")} href={`/admin/matching?track=${t.id}`} key={t.id}>
            {t.name}
            <span className={cn("rounded-full px-1.5 text-xs tabular-nums", t.id === track.id ? "bg-white/20" : counts[i] ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground")}>{counts[i]}</span>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel
            action={ready.length > 0 && spots > 0 ? <ActionButton action={autoAssign.bind(null, cohort.id, track.id)} confirm={`Pair ${Math.min(ready.length, spots)} mentees in ${track.name} with their best available mentor${mode === "RANK" ? ", honouring ranked choices first" : ""}? Both people are emailed.`} confirmLabel="Confirm all" size="sm"><Wand2 className="size-4" /> Confirm best match for all</ActionButton> : undefined}
            bodyClassName="p-0"
            description={`${ready.length} ready to pair${notReady ? ` · ${notReady} still finishing their profile` : ""} · ${spots} mentor spots open`}
            title={`Waiting in ${track.name}`}
          >
            {ready.length === 0 ? (
              <Empty description={notReady ? "The remaining mentees have not finished their profile yet, so they cannot be scored." : "Every mentee in this track has a mentor."} icon={CheckCircle2} title={notReady ? "No one ready yet" : "Everyone is paired"} />
            ) : (
              <ul className="divide-y">
                {shown.map((m, i) => {
                  const ranks = rankings.filter((r) => r.menteeId === m.id).sort((a, b) => a.rank - b.rank);
                  const asked = requests.filter((r) => r.menteeId === m.id);
                  return (
                    <li className="px-5 py-4" key={m.id}>
                      <div className="flex items-center gap-3">
                        <UserAvatar user={m} />
                        <div className="min-w-0 flex-1">
                          <Link className="font-medium text-sm hover:underline" href={`/admin/people/${m.id}`}>{m.name}</Link>
                          <div className="truncate text-muted-foreground text-xs">{[m.level && `${m.level} level`, m.faculty].filter(Boolean).join(" · ")}{asked.length ? ` · requested ${asked.map((a) => a.mentor.name).join(", ")}` : ""}{ranks.length ? ` · ranked ${ranks.map((r) => byId.get(r.mentorId)?.user.name.split(" ")[0]).filter(Boolean).join(" > ")}` : ""}</div>
                        </div>
                      </div>
                      {sug[i].length === 0 ? <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-muted-foreground text-xs">No mentor with a free spot. Add mentors or raise capacity.</p> : (
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          {sug[i].slice(0, 3).map((sg, j) => {
                            const mentor = byId.get(sg.mentorId)!;
                            return (
                              <div className={cn("flex flex-col rounded-xl border p-3", j === 0 && "border-brand/40 bg-brand-soft/50")} key={sg.mentorId}>
                                <div className="flex items-center gap-2">
                                  <UserAvatar size="sm" user={mentor.user} />
                                  <span className="min-w-0 flex-1 truncate font-medium text-sm">{mentor.user.name}</span>
                                  <span className="flex items-center gap-0.5 font-semibold text-brand text-xs tabular-nums"><Sparkles className="size-3" />{sg.score}</span>
                                </div>
                                <ul className="mt-2 flex-1 space-y-0.5 text-[11px] text-muted-foreground leading-snug">{sg.reasons.map((r) => <li key={r}>· {r}</li>)}</ul>
                                <ActionButton action={assignPair.bind(null, cohort.id, track.id, m.id, sg.mentorId)} className="mt-2.5 w-full" size="sm" variant={j === 0 ? "default" : "outline"}>Pair</ActionButton>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            {ready.length > shown.length && <p className="border-t px-5 py-3 text-muted-foreground text-xs">Showing the first {shown.length} of {ready.length}. Use “Confirm best match for all” to pair the rest in bulk.</p>}
          </Panel>

          {requests.length > 0 && (
            <Panel bodyClassName="p-0" description="Requests expire automatically; you can also pair directly above" title="Open mentor requests">
              <ul className="divide-y">
                {requests.map((r) => (
                  <li className="flex items-center gap-3 px-5 py-3 text-sm" key={r.id}>
                    <Hourglass className="size-4 shrink-0 text-amber-500" />
                    <span className="min-w-0 flex-1 truncate"><span className="font-medium">{r.mentee.name}</span> asked <span className="font-medium">{r.mentor.name}</span></span>
                    <span className="shrink-0 text-muted-foreground text-xs">{relTime(r.createdAt, now)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="space-y-6">
          <Panel action={<Button asChild size="sm" variant="ghost"><Link href={`/admin/tracks/${track.id}`}>Change</Link></Button>} title="This track">
            <div className="flex items-start gap-3"><Shuffle className="mt-0.5 size-4 shrink-0 text-brand" /><div><div className="font-medium text-sm">{ASSIGNMENT_MODES[mode].label}</div><p className="text-muted-foreground text-xs">{ASSIGNMENT_MODES[mode].help}</p></div></div>
            {["PICK", "REQUEST", "RANK"].includes(mode) && (
              <div className="mt-3 flex items-start gap-3 border-t pt-3"><CalendarClock className="mt-0.5 size-4 shrink-0 text-brand" /><div><div className="font-medium text-sm">Selection window: {windowState}</div><p className="text-muted-foreground text-xs">{track.windowClose ? `${track.windowOpen ? fmtDay(track.windowOpen, user.timezone) : "Open"} to ${fmtDay(track.windowClose, user.timezone)}. ` : ""}{mode === "RANK" || track.fallback === "AUTO" ? "Anyone left is assigned automatically at the close." : "Anyone left comes to this queue."}</p></div></div>
            )}
          </Panel>

          <Panel bodyClassName="p-0" description={`Up to ${track.maxMenteesPerMentor} mentees each in this track`} title="Mentor capacity">
            <ul className="max-h-80 divide-y overflow-y-auto">
              {[...mentors].sort((a, b) => b.spots - a.spots).map((m) => (
                <li className="flex items-center gap-3 px-5 py-2.5 text-sm" key={m.user.id}>
                  <UserAvatar size="sm" user={m.user} />
                  <Link className="min-w-0 flex-1 truncate hover:underline" href={`/admin/people/${m.user.id}`}>{m.user.name}{!m.user.onboardedAt && <span className="text-muted-foreground"> · not onboarded</span>}</Link>
                  <Tag className={m.spots ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : ""}>{m.spots ? `${m.spots} open` : "Full"}</Tag>
                </li>
              ))}
              {mentors.length === 0 && <li className="px-5 py-6 text-center text-muted-foreground text-sm">No mentors in this track yet.</li>}
            </ul>
          </Panel>

          <Panel description="For example family ties. These two will never be suggested or paired." title="Hard exclusion">
            <ActionForm action={addExclusion} className="space-y-2" resetOnSuccess>
              <input name="trackId" type="hidden" value={track.id} />
              <NativeSelect aria-label="Mentee" name="menteeId" required><option value="">Mentee…</option>{waiting.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</NativeSelect>
              <NativeSelect aria-label="Mentor" name="mentorId" required><option value="">Mentor…</option>{mentors.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name}</option>)}</NativeSelect>
              <Input name="reason" placeholder="Reason (optional)" />
              <Submit className="w-full" size="sm" variant="secondary"><UserPlus className="size-4" /> Add exclusion</Submit>
            </ActionForm>
          </Panel>
        </div>
      </div>
    </div>
  );
}
