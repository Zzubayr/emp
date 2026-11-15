import Link from "next/link";
import { notFound } from "next/navigation";
import { cloneTrack, setTrackStatus, updateTrack } from "@/actions/admin";
import { ActionButton, ActionForm, Submit } from "@/components/app/action-form";
import { Chip, Field, NativeSelect, PageHeader, Panel } from "@/components/app/bits";
import { TagPicker } from "@/components/app/inputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminCtx } from "@/lib/admin";
import { isAdminRole } from "@/lib/auth";
import { ASSIGNMENT_MODES, parseList, TRACK_ICONS } from "@/lib/constants";
import { db } from "@/lib/db";

export const metadata = { title: "Track settings" };
const d = (x: Date | null) => (x ? x.toISOString().slice(0, 10) : "");

export default async function TrackSettings({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, cohort, scope } = await adminCtx();
  if (scope && !scope.includes(id)) notFound();
  const t = await db.track.findUnique({ where: { id } });
  if (!t) notFound();
  const admin = isAdminRole(user.role);
  const [staff, counts] = await Promise.all([
    db.user.findMany({ where: { role: { in: ["COORDINATOR", "ADMIN", "SUPER_ADMIN"] }, status: { in: ["ACTIVE", "INVITED"] } }, select: { id: true, name: true, role: true } }),
    cohort ? db.membership.groupBy({ by: ["role"], where: { trackId: id, cohortId: cohort.id }, _count: true }) : [],
  ]);
  const n = (role: string) => counts.find((c) => c.role === role)?._count ?? 0;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        actions={
          <>
            <Button asChild variant="outline"><Link href={`/admin/people?track=${t.id}`}>People ({n("MENTEE") + n("MENTOR")})</Link></Button>
            <Button asChild variant="outline"><Link href={`/admin/matching?track=${t.id}`}>Assignment</Link></Button>
          </>
        }
        description={cohort ? `${n("MENTEE")} mentees and ${n("MENTOR")} mentors in ${cohort.name}` : undefined}
        eyebrow={<Link className="hover:underline" href="/admin/tracks">Tracks</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{t.name} <Chip status={t.status} /></span>}
      />
      <ActionForm action={updateTrack.bind(null, t.id)} className="space-y-6">
        <Panel action={<Submit>Save track</Submit>} title="Identity">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name"><Input defaultValue={t.name} minLength={2} name="name" required /></Field>
            <Field label="Area"><NativeSelect defaultValue={t.area} name="area"><option value="ACADEMIC">Academic</option><option value="NON_ACADEMIC">Non-academic</option></NativeSelect></Field>
            <Field label="Icon"><NativeSelect defaultValue={t.icon} name="icon">{TRACK_ICONS.map((i) => <option key={i}>{i}</option>)}</NativeSelect></Field>
            <Field hint="A scoped admin who only sees this track." label="Track coordinator">
              <NativeSelect defaultValue={t.coordinatorId ?? ""} disabled={!admin} name="coordinatorId"><option value="">None</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect>
            </Field>
            <Field className="sm:col-span-2" label="Description"><Textarea defaultValue={t.description ?? ""} name="description" rows={2} /></Field>
            <Field className="sm:col-span-2" hint="Shown to people in this track when they finish onboarding." label="Welcome message"><Textarea defaultValue={t.welcomeMessage ?? ""} name="welcomeMessage" rows={2} /></Field>
          </div>
        </Panel>

        <Panel description="Can be changed at any time, and between cohorts. Students only see the screens for the mode in use." title="How mentees get a mentor">
          <div className="grid gap-2">
            {Object.entries(ASSIGNMENT_MODES).map(([k, m], i) => (
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors has-checked:border-brand has-checked:bg-brand-soft" key={k}>
                <input className="mt-1 size-4 accent-[var(--brand)]" defaultChecked={t.assignmentMode === k} name="assignmentMode" type="radio" value={k} />
                <span><span className="font-medium text-sm">{i + 1}. {m.label}</span><span className="block text-muted-foreground text-xs">{m.help}</span></span>
              </label>
            ))}
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field hint="For pick, request and rank modes. Leave empty for always open." label="Selection window opens"><Input defaultValue={d(t.windowOpen)} name="windowOpen" type="date" /></Field>
            <Field label="Selection window closes"><Input defaultValue={d(t.windowClose)} name="windowClose" type="date" /></Field>
            <Field hint="For students who have not chosen when the window closes. Rank mode always allocates." label="When the window closes">
              <NativeSelect defaultValue={t.fallback} name="fallback"><option value="QUEUE">Send them to the admin queue</option><option value="AUTO">Assign them automatically</option></NativeSelect>
            </Field>
            <Field hint="A mentor's own capacity also applies." label="Maximum mentees per mentor"><Input defaultValue={t.maxMenteesPerMentor} max={20} min={1} name="maxMenteesPerMentor" type="number" /></Field>
          </div>
          <label className="mt-4 flex cursor-pointer items-center gap-3 text-sm"><input className="size-4 accent-[var(--brand)]" defaultChecked={t.showFullMentors} name="showFullMentors" type="checkbox" /> Show mentors who are full (marked “Full”) instead of hiding them</label>
        </Panel>

        <Panel title="Sessions">
          <div className="mb-2 font-medium text-sm">Allowed session lengths (minutes)</div>
          <TagPicker defaultValue={parseList(t.sessionLengths)} max={5} name="sessionLengths" options={["15", "30", "45", "60", "90"]} />
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field hint="Used in reports." label="Minimum sessions per cohort"><Input defaultValue={t.minSessions} min={0} name="minSessions" type="number" /></Field>
            <Field hint="Cancelling closer than this counts as late." label="Late cancellation window (hours)"><Input defaultValue={t.cancelWindowHours} min={0} name="cancelWindowHours" type="number" /></Field>
          </div>
        </Panel>

        <Panel description="Starting points; change them to fit the track. Applied when a session outcome is recorded." title="Attendance rules">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field hint="Used when Google Meet records are connected." label="Present: share of scheduled time in the room (%)"><Input defaultValue={t.presentPct} max={100} min={10} name="presentPct" type="number" /></Field>
            <Field label="Late: joined more than (minutes) after start"><Input defaultValue={t.lateMinutes} min={1} name="lateMinutes" type="number" /></Field>
            <Field label="No-show check: not in the room after (minutes)"><Input defaultValue={t.noShowMinutes} min={1} name="noShowMinutes" type="number" /></Field>
            <Field hint="Used when Google Meet records are connected." label="Held: mentor and mentee overlapped for (minutes)"><Input defaultValue={t.heldOverlapMinutes} min={1} name="heldOverlapMinutes" type="number" /></Field>
          </div>
        </Panel>
        <div className="flex justify-end"><Submit className="h-11 min-w-40">Save track</Submit></div>
      </ActionForm>

      {admin && (
        <Panel className="mt-6" description="Closed tracks keep their pairs but take no new people. Archived tracks are hidden." title="Status and copies">
          <div className="flex flex-wrap gap-2">
            {(["OPEN", "DRAFT", "CLOSED", "ARCHIVED"] as const).filter((x) => x !== t.status).map((x) => (
              <ActionButton action={setTrackStatus.bind(null, t.id, x)} confirm={x === "ARCHIVED" ? "Archive this track? It will be hidden from lists and new cohorts." : undefined} key={x} variant="outline">
                {x === "OPEN" ? "Open" : x === "DRAFT" ? "Move to draft" : x === "CLOSED" ? "Close" : "Archive"}
              </ActionButton>
            ))}
            <ActionButton action={cloneTrack.bind(null, t.id)} variant="ghost">Clone this track</ActionButton>
          </div>
        </Panel>
      )}
    </div>
  );
}
