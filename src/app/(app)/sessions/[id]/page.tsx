import { CalendarPlus, CalendarSync, CheckCircle2, ClipboardCheck, ExternalLink, Hourglass, Lock, MessageSquareHeart, Star, UserX, Video } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { confirmSessionAction, logOutcome, overrideAttendance, saveNotes, setMeetingLink, submitFeedback } from "@/actions/sessions";
import { ActionButton, ActionForm, Submit } from "@/components/app/action-form";
import { Chip, NativeSelect, PageHeader, Panel, UserAvatar } from "@/components/app/bits";
import { StarInput } from "@/components/app/inputs";
import { JoinButton } from "@/components/app/join-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isAdminRole, isStaffRole, requireReady } from "@/lib/auth";
import { db } from "@/lib/db";
import { trackScope } from "@/lib/scope";
import { getSettings } from "@/lib/settings";
import { fmtRange, fmtTime, tzAbbr } from "@/lib/time";
import { CancelButton } from "./cancel";

export const metadata = { title: "Session" };

export default async function SessionDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireReady();
  const st = await getSettings();
  const s = await db.session.findUnique({
    where: { id },
    include: { match: { include: { mentee: true, mentor: true, track: true } }, feedback: { include: { author: true } }, attendance: true, joins: { orderBy: { at: "asc" } } },
  });
  if (!s) notFound();
  const m = s.match;
  const member = m.menteeId === user.id || m.mentorId === user.id;
  const staff = isStaffRole(user.role);
  if (!member) {
    if (!staff) notFound();
    const scope = await trackScope(user);
    if (scope && !scope.includes(m.trackId)) notFound();
  }
  const isMentor = m.mentorId === user.id;
  const other = m.menteeId === user.id ? m.mentor : m.mentee;
  const now = new Date();
  const started = s.startsAt <= now;
  const live = ["PROPOSED", "CONFIRMED"].includes(s.status);
  const finished = ["HELD", "NO_SHOW_MENTEE", "NO_SHOW_MENTOR"].includes(s.status);
  const mine = s.feedback.find((f) => f.authorId === user.id);
  const safetyOpen = isAdminRole(user.role) ? await db.safetyCase.count({ where: { matchId: m.id, status: { not: "RESOLVED" } } }) : 0;
  const people = [m.mentee, m.mentor];

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        actions={
          <>
            {s.status === "CONFIRMED" && member && <JoinButton endsAt={s.endsAt.toISOString()} hasLink={Boolean(s.joinUrl)} sessionId={s.id} startsAt={s.startsAt.toISOString()} />}
            {member && live && <Button asChild variant="outline"><a href={`/api/sessions/${s.id}/ics`}><CalendarPlus className="size-4" /> Add to calendar</a></Button>}
          </>
        }
        description={<>{fmtRange(s.startsAt, s.endsAt, user.timezone)} · {s.durationMin} minutes{member && other.timezone !== user.timezone ? <> · {fmtTime(s.startsAt, other.timezone)} {tzAbbr(s.startsAt, other.timezone)} for {other.name.split(" ")[0]}</> : null}</>}
        eyebrow={<Link className="hover:underline" href={`/pairs/${m.id}`}>{m.track.name} · pair space</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{member ? `Session with ${other.name}` : `${m.mentee.name} with ${m.mentor.name}`} <Chip status={s.status} /></span>}
      />

      <div className="space-y-6">
        {s.status === "PROPOSED" && (
          <div className="flex flex-col gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Hourglass className="mt-0.5 size-5 shrink-0 text-amber-600" />
              <div className="text-sm">
                {member && s.proposedById === user.id
                  ? <><span className="font-medium">Waiting for {other.name.split(" ")[0]} to confirm.</span> We have emailed them. You can still move or cancel it.</>
                  : <><span className="font-medium">{s.proposedById === m.menteeId ? m.mentee.name : m.mentor.name} proposed this time.</span> Confirm it, or suggest another.</>}
              </div>
            </div>
            {(!member || s.proposedById !== user.id) && !started && (
              <div className="flex gap-2">
                {member && <Button asChild variant="outline"><Link href={`/sessions/book?pair=${m.id}&replace=${s.id}`}>Suggest another time</Link></Button>}
                <ActionButton action={confirmSessionAction.bind(null, s.id)}><CheckCircle2 className="size-4" /> Confirm</ActionButton>
              </div>
            )}
          </div>
        )}
        {s.status === "CANCELLED" && <div className="rounded-2xl border bg-muted/50 p-4 text-sm"><span className="font-medium">Cancelled.</span> {s.cancelReason}{s.lateCancel ? " (late cancellation)" : ""}</div>}

        {live && (
          <Panel description={s.linkSource === "google" ? "Created automatically. Join signed in with your allow-listed Google account." : undefined} title="Meeting link">
            {s.joinUrl ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600"><Video className="size-5" /></span>
                <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-3 py-2 text-sm">{s.joinUrl}</code>
                {started && s.endsAt > now ? null : <span className="text-muted-foreground text-xs">Use the Join button so your attendance is recorded.</span>}
              </div>
            ) : <p className="mb-3 text-muted-foreground text-sm">No link yet. Create a meeting at <a className="text-brand underline" href="https://meet.google.com/new" rel="noreferrer" target="_blank">meet.google.com/new <ExternalLink className="inline size-3" /></a> and paste the link here. The session can go ahead either way.</p>}
            <ActionForm action={setMeetingLink.bind(null, s.id)} className="mt-3 flex gap-2">
              <Input aria-label="Google Meet link" defaultValue={s.joinUrl ?? ""} name="joinUrl" placeholder="https://meet.google.com/abc-defg-hij" required type="url" />
              <Submit variant="secondary">{s.joinUrl ? "Replace" : "Save link"}</Submit>
            </ActionForm>
          </Panel>
        )}

        {s.status === "CONFIRMED" && started && (member || staff) && (
          <Panel description="This keeps attendance and the pair's health score accurate." title="What happened?">
            <div className="flex flex-wrap gap-2">
              <ActionButton action={logOutcome.bind(null, s.id, "HELD")}><CheckCircle2 className="size-4" /> We met</ActionButton>
              {!(member && !isMentor) && <ActionButton action={logOutcome.bind(null, s.id, "NO_SHOW_MENTEE")} confirm={`Mark ${m.mentee.name} as a no-show?`} variant="outline"><UserX className="size-4" /> {m.mentee.name.split(" ")[0]} did not show</ActionButton>}
              {!isMentor && <ActionButton action={logOutcome.bind(null, s.id, "NO_SHOW_MENTOR")} confirm={`Mark ${m.mentor.name} as a no-show?`} variant="outline"><UserX className="size-4" /> {m.mentor.name.split(" ")[0]} did not show</ActionButton>}
            </div>
          </Panel>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title="Agenda">
            {member && !finished && s.status !== "CANCELLED" ? (
              <ActionForm action={saveNotes.bind(null, s.id)} className="space-y-3">
                <Textarea defaultValue={s.agenda ?? ""} maxLength={1500} name="agenda" placeholder="What would you like to cover?" rows={7} />
                <Submit size="sm" variant="secondary">Save agenda</Submit>
              </ActionForm>
            ) : <p className="whitespace-pre-wrap text-sm leading-relaxed">{s.agenda || <span className="text-muted-foreground">No agenda was set.</span>}</p>}
            {s.topic && <p className="mt-3 text-muted-foreground text-xs">Topic: {s.topic}</p>}
          </Panel>

          {st.modules.notes && (
            <Panel description="Both of you can see and edit these" title="Shared notes">
              {member && s.status !== "CANCELLED" ? (
                <ActionForm action={saveNotes.bind(null, s.id)} className="space-y-3">
                  <Textarea defaultValue={s.sharedNotes ?? ""} maxLength={8000} name="sharedNotes" placeholder="What did you talk about? What comes next?" rows={7} />
                  <Submit size="sm" variant="secondary">Save notes</Submit>
                </ActionForm>
              ) : <p className="whitespace-pre-wrap text-sm leading-relaxed">{s.sharedNotes || <span className="text-muted-foreground">No shared notes.</span>}</p>}
            </Panel>
          )}
        </div>

        {st.modules.notes && isMentor && s.status !== "CANCELLED" && (
          <Panel description="Only you can see these. Admins cannot, unless a safety case is open for this pair." title={<span className="flex items-center gap-2"><Lock className="size-4" /> Private notes</span>}>
            <ActionForm action={saveNotes.bind(null, s.id)} className="space-y-3">
              <Textarea defaultValue={s.privateNotes ?? ""} maxLength={8000} name="privateNotes" placeholder="Anything you want to remember for next time" rows={4} />
              <Submit size="sm" variant="secondary">Save private notes</Submit>
            </ActionForm>
          </Panel>
        )}
        {safetyOpen > 0 && s.privateNotes && (
          <Panel description="Visible because a safety case is open for this pair. This view is logged." title={<span className="flex items-center gap-2"><Lock className="size-4" /> Mentor's private notes</span>}>
            <p className="whitespace-pre-wrap text-sm">{s.privateNotes}</p>
          </Panel>
        )}

        {st.modules.feedback && s.status === "HELD" && member && (
          <Panel description="Under a minute. Your partner only ever sees averages, never your individual ratings." id="feedback" title={<span className="flex items-center gap-2"><MessageSquareHeart className="size-4" /> How was it?</span>}>
            {mine ? (
              <p className="flex items-center gap-2 text-sm"><CheckCircle2 className="size-5 text-emerald-500" /> Thank you. Your feedback is in.</p>
            ) : (
              <ActionForm action={submitFeedback.bind(null, s.id)} className="space-y-4">
                <StarInput hint="Did you get something out of it?" label="Usefulness" name="usefulness" />
                <StarInput hint={`Was ${other.name.split(" ")[0]} ready for the session?`} label="Preparedness" name="preparedness" />
                <StarInput hint="Did you feel heard and comfortable?" label="Connection" name="connection" />
                <Textarea maxLength={1000} name="comment" placeholder="Anything to add? (optional)" rows={3} />
                <Submit>Send feedback</Submit>
              </ActionForm>
            )}
          </Panel>
        )}

        {st.modules.attendance && finished && (
          <Panel bodyClassName="p-0" description={member ? "Recorded from the Join button and the logged outcome" : "Override a result if it is wrong; the reason is audited"} title={<span className="flex items-center gap-2"><ClipboardCheck className="size-4" /> Attendance</span>}>
            <ul className="divide-y">
              {people.map((u) => {
                const a = s.attendance.find((x) => x.userId === u.id);
                const join = s.joins.find((j) => j.userId === u.id);
                return (
                  <li className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center" key={u.id}>
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <UserAvatar user={u} />
                      <div className="min-w-0">
                        <div className="truncate font-medium text-sm">{u.name} <span className="font-normal text-muted-foreground">· {u.id === m.mentorId ? "mentor" : "mentee"}</span></div>
                        <div className="text-muted-foreground text-xs">{join ? `Clicked Join at ${fmtTime(join.at, user.timezone)}` : "No join click recorded"}{a?.overrideReason ? ` · overridden: ${a.overrideReason}` : ""}</div>
                      </div>
                    </div>
                    {a ? <Chip status={a.status} /> : <Chip label="Not recorded" status="DRAFT" />}
                    {staff && !member && (
                      <ActionForm action={overrideAttendance.bind(null, s.id, u.id)} className="flex gap-2">
                        <NativeSelect aria-label="Result" className="w-28" defaultValue={a?.status ?? "PRESENT"} name="status"><option value="PRESENT">Present</option><option value="LATE">Late</option><option value="LEFT_EARLY">Left early</option><option value="ABSENT">Absent</option></NativeSelect>
                        <Input aria-label="Reason" className="w-36" name="reason" placeholder="Reason" required />
                        <Submit size="sm" variant="secondary">Override</Submit>
                      </ActionForm>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        )}

        {staff && !member && s.feedback.length > 0 && (
          <Panel bodyClassName="p-0" title="Feedback (staff view)">
            <ul className="divide-y">
              {s.feedback.map((f) => (
                <li className="px-5 py-4" key={f.id}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-sm">{f.author.name}</span>
                    <span className="flex items-center gap-3 text-muted-foreground text-xs">
                      {[["Useful", f.usefulness], ["Prepared", f.preparedness], ["Connection", f.connection]].map(([l, v]) => <span className="flex items-center gap-0.5" key={l}>{l} <Star className="size-3 fill-amber-400 text-amber-400" />{v}</span>)}
                      {f.flagged && <Chip label="Flagged" status="HIGH" />}
                    </span>
                  </div>
                  {f.comment && <p className="mt-1.5 text-sm">“{f.comment}”</p>}
                </li>
              ))}
            </ul>
          </Panel>
        )}

        {live && (member || staff) && (
          <div className="flex flex-wrap justify-end gap-2 border-t pt-5">
            {member && !started && <Button asChild variant="outline"><Link href={`/sessions/book?pair=${m.id}&replace=${s.id}`}><CalendarSync className="size-4" /> Reschedule</Link></Button>}
            {!started && <CancelButton hours={m.track.cancelWindowHours} id={s.id} late={s.status === "CONFIRMED" && s.startsAt.getTime() - now.getTime() < m.track.cancelWindowHours * 3600_000} />}
          </div>
        )}
      </div>
    </div>
  );
}
