import { CalendarPlus, CheckSquare, FileText, Mail, PauseCircle, ShieldAlert, Sparkles, Video } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addActionItem, toggleActionItem } from "@/actions/sessions";
import { endPair, nudgePair, pausePair, resumePair, savePairSettings, swapMentor } from "@/actions/matching";
import { ActionButton, ActionForm, Submit } from "@/components/app/action-form";
import { Chip, Empty, Field, Meter, NativeSelect, PageHeader, Panel, Tag, UserAvatar } from "@/components/app/bits";
import { SessionList } from "@/components/app/session-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { isAdminRole, isStaffRole, requireReady } from "@/lib/auth";
import { parseList, RHYTHMS } from "@/lib/constants";
import { db } from "@/lib/db";
import { pairHealth } from "@/lib/health";
import { trackMentors } from "@/lib/matching";
import { meetConfigured } from "@/lib/meet";
import { trackScope } from "@/lib/scope";
import { getSettings } from "@/lib/settings";
import { fmtDay } from "@/lib/time";

export const metadata = { title: "Pair space" };

export default async function PairSpace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireReady();
  const s = await getSettings();
  const p = await db.match.findUnique({
    where: { id },
    include: {
      mentee: true, mentor: true, track: true, cohort: true,
      sessions: { orderBy: { startsAt: "desc" }, include: { feedback: true, match: { include: { mentee: true, mentor: true, track: true } } } },
      actionItems: { orderBy: [{ done: "asc" }, { createdAt: "desc" }] },
    },
  });
  if (!p) notFound();
  const member = p.menteeId === user.id || p.mentorId === user.id;
  const staff = isStaffRole(user.role);
  if (!member) {
    if (!staff) notFound();
    const scope = await trackScope(user);
    if (scope && !scope.includes(p.trackId)) notFound();
  }
  const isMentor = p.mentorId === user.id;
  const other = p.menteeId === user.id ? p.mentor : p.mentee;
  const now = new Date();
  const h = pairHealth(p, now);
  const upcoming = p.sessions.filter((x) => ["CONFIRMED", "PROPOSED"].includes(x.status) && x.endsAt > now).reverse();
  const past = p.sessions.filter((x) => !upcoming.includes(x));
  const held = p.sessions.filter((x) => x.status === "HELD");
  const notes = held.filter((x) => x.sharedNotes).slice(0, 3);
  const others = staff ? (await trackMentors(p.cohortId, p.trackId)).filter((m) => m.spots > 0 && m.user.id !== p.mentorId) : [];
  const fb = held.flatMap((x) => x.feedback);
  const avg = fb.length ? (fb.reduce((n, f) => n + (f.usefulness + f.preparedness + f.connection) / 3, 0) / fb.length).toFixed(1) : null;
  const profile = member ? other : p.mentee;

  return (
    <div>
      <PageHeader
        actions={
          p.status === "ACTIVE" && member ? <Button asChild><Link href={`/sessions/book?pair=${p.id}`}><CalendarPlus className="size-4" /> Book a session</Link></Button> : undefined
        }
        description={`${p.track.name} · ${p.cohort.name} · paired ${fmtDay(p.startedAt ?? p.createdAt, user.timezone, { year: true, weekday: false })}`}
        eyebrow={member ? (isMentor ? `Your ${s.labelMentee.toLowerCase()}` : `Your ${s.labelMentor.toLowerCase()}`) : "Pair detail"}
        title={member ? other.name : <span>{p.mentee.name} <span className="text-muted-foreground">with</span> {p.mentor.name}</span>}
      />
      {p.status !== "ACTIVE" && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <PauseCircle className="size-5 shrink-0 text-amber-600" />
          <span>This pairing is <span className="font-medium">{p.status.toLowerCase()}</span>{p.endReason ? `: ${p.endReason}` : ""}. Sessions cannot be booked.</span>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel action={member && p.status === "ACTIVE" ? <Button asChild size="sm" variant="ghost"><Link href={`/sessions/book?pair=${p.id}`}>Book</Link></Button> : undefined} bodyClassName="p-0" title="Upcoming sessions">
            {upcoming.length ? <SessionList admin={!member} sessions={upcoming} tz={user.timezone} userId={user.id} /> : <Empty action={member && p.status === "ACTIVE" ? <Button asChild size="sm"><Link href={`/sessions/book?pair=${p.id}`}>Book a session</Link></Button> : undefined} description="Pick a time that is free for both of you." icon={CalendarPlus} title="Nothing booked" />}
          </Panel>

          {s.modules.notes && (
            <Panel bodyClassName="p-0" description="Open items carry into your next session" title="Action items">
              <ul className="divide-y">
                {p.actionItems.map((it) => (
                  <li className="flex items-center gap-3 px-5 py-3" key={it.id}>
                    {member ? (
                      <ActionButton action={toggleActionItem.bind(null, it.id)} aria-label={it.done ? "Mark as not done" : "Mark as done"} className={`size-6 rounded-md border p-0 ${it.done ? "border-emerald-500 bg-emerald-500 text-white hover:bg-emerald-600" : ""}`} size="icon" variant="ghost">
                        {it.done && <CheckSquare className="size-3.5" />}
                      </ActionButton>
                    ) : <span className={`size-4 rounded border ${it.done ? "bg-emerald-500" : ""}`} />}
                    <div className="min-w-0 flex-1">
                      <div className={`text-sm ${it.done ? "text-muted-foreground line-through" : ""}`}>{it.text}</div>
                      <div className="text-muted-foreground text-xs">{it.ownerId === p.menteeId ? p.mentee.name : p.mentor.name}{it.dueDate ? ` · due ${fmtDay(it.dueDate, user.timezone)}` : ""}</div>
                    </div>
                  </li>
                ))}
                {p.actionItems.length === 0 && <li className="px-5 py-6 text-center text-muted-foreground text-sm">No action items yet.</li>}
              </ul>
              {member && p.status === "ACTIVE" && (
                <ActionForm action={addActionItem.bind(null, p.id)} className="flex flex-col gap-2 border-t p-4 sm:flex-row" resetOnSuccess>
                  <Input aria-label="New action item" className="flex-1" maxLength={240} name="text" placeholder="Add an action item…" required />
                  <NativeSelect aria-label="Owner" className="sm:w-40" defaultValue={user.id} name="ownerId">
                    <option value={p.menteeId}>{p.mentee.name.split(" ")[0]}</option><option value={p.mentorId}>{p.mentor.name.split(" ")[0]}</option>
                  </NativeSelect>
                  <Input aria-label="Due date" className="sm:w-40" name="dueDate" type="date" />
                  <Submit variant="secondary">Add</Submit>
                </ActionForm>
              )}
            </Panel>
          )}

          {s.modules.notes && notes.length > 0 && (
            <Panel title="Recent shared notes">
              <div className="space-y-4">
                {notes.map((x) => (
                  <Link className="block rounded-xl border p-4 transition-colors hover:bg-accent/40" href={`/sessions/${x.id}`} key={x.id}>
                    <div className="mb-1 flex items-center gap-2 text-muted-foreground text-xs"><FileText className="size-3.5" />{fmtDay(x.startsAt, user.timezone)} · {x.topic || "Session"}</div>
                    <p className="line-clamp-3 text-sm leading-relaxed">{x.sharedNotes}</p>
                  </Link>
                ))}
              </div>
            </Panel>
          )}

          <Panel bodyClassName="p-0" title="Session history">
            {past.length ? <SessionList admin={!member} sessions={past.slice(0, 12)} tz={user.timezone} userId={user.id} /> : <Empty description="Held, missed and cancelled sessions will be listed here." icon={Video} title="No history yet" />}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <div className="flex items-center gap-3">
              <UserAvatar size="lg" user={profile} />
              <div className="min-w-0"><div className="truncate font-semibold">{profile.name}</div><div className="truncate text-muted-foreground text-sm">{profile.headline || [profile.level && `${profile.level} level`, profile.faculty].filter(Boolean).join(" · ")}</div></div>
            </div>
            {(profile.bio || profile.goalsText) && <p className="mt-4 text-sm leading-relaxed">{profile.id === p.mentorId ? profile.bio : profile.goalsText}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">{parseList(profile.id === p.mentorId ? profile.expertise : profile.interests).map((t) => <Tag key={t}>{t}</Tag>)}</div>
            <a className="mt-4 flex items-center gap-2 text-muted-foreground text-sm hover:text-foreground" href={`mailto:${profile.email}`}><Mail className="size-4" />{profile.email}</a>
            {(isMentor || staff) && p.mentee.applicationNotes && (
              <div className="mt-4 rounded-xl bg-muted/60 p-3 text-sm"><div className="mb-1 font-medium text-muted-foreground text-xs">Why they joined</div>{p.mentee.applicationNotes}</div>
            )}
          </Panel>

          {(isMentor || staff) && (
            <Panel title="Pair health">
              <div className="flex items-end justify-between"><span className="font-semibold text-4xl tabular-nums tracking-tight">{h.score}</span><Chip status={h.band} /></div>
              <Meter className="mt-3" value={h.score} />
              <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                <div><dt className="text-muted-foreground text-xs">Held</dt><dd className="font-medium">{held.length}</dd></div>
                <div><dt className="text-muted-foreground text-xs">Missed</dt><dd className="font-medium">{p.sessions.filter((x) => x.status.startsWith("NO_SHOW")).length}</dd></div>
                <div><dt className="text-muted-foreground text-xs">Rating</dt><dd className="font-medium">{staff && avg ? `${avg}/5` : fb.length ? `${fb.length} given` : "None"}</dd></div>
              </dl>
              {staff && <p className="mt-3 flex items-center gap-1.5 text-muted-foreground text-xs"><Sparkles className="size-3.5 text-brand" />Suggested: {h.action}</p>}
            </Panel>
          )}

          {(member || staff) && p.status !== "ENDED" && (
            <Panel title="Pair settings">
              <ActionForm action={savePairSettings.bind(null, p.id)} className="space-y-4">
                <Field hint="Used for reminders and the health score." label="How often you meet">
                  <NativeSelect defaultValue={p.rhythm} name="rhythm">{Object.entries(RHYTHMS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</NativeSelect>
                </Field>
                <Field hint={meetConfigured() ? "Optional. Leave blank to get a new Meet link for every session." : "Paste one Google Meet link to reuse for every session."} label="Fixed meeting room">
                  <Input defaultValue={p.fixedMeetUrl ?? ""} name="fixedMeetUrl" placeholder="https://meet.google.com/abc-defg-hij" type="url" />
                </Field>
                {staff && !member && <Field hint="Only staff can see this." label="Admin notes"><Textarea defaultValue={p.adminNotes ?? ""} name="adminNotes" rows={3} /></Field>}
                <Submit className="w-full" variant="secondary">Save</Submit>
              </ActionForm>
            </Panel>
          )}

          {staff && !member && p.status !== "ENDED" && (
            <Panel description="Every action is written to the audit log" title="Interventions">
              <div className="space-y-3">
                <ActionButton action={nudgePair.bind(null, p.id)} className="w-full" variant="outline">Send a nudge to both</ActionButton>
                {p.status === "ACTIVE"
                  ? <ActionButton action={pausePair.bind(null, p.id)} className="w-full" confirm="Pause this pair? Upcoming sessions will be cancelled and both people told." variant="outline">Pause pair</ActionButton>
                  : <ActionButton action={resumePair.bind(null, p.id)} className="w-full" variant="outline">Resume pair</ActionButton>}
                <ActionForm action={swapMentor.bind(null, p.id)} className="space-y-2 rounded-xl border p-3">
                  <div className="font-medium text-sm">Change mentor</div>
                  <NativeSelect name="mentorId" required><option value="">Choose a mentor with space…</option>{others.map((m) => <option key={m.user.id} value={m.user.id}>{m.user.name} ({m.spots} open)</option>)}</NativeSelect>
                  <Input name="reason" placeholder="Reason" />
                  <Submit className="w-full" size="sm" variant="secondary">Swap</Submit>
                </ActionForm>
                {isAdminRole(user.role) || staff ? (
                  <ActionForm action={endPair.bind(null, p.id)} className="space-y-2 rounded-xl border border-destructive/30 p-3">
                    <div className="font-medium text-sm">End this pair</div>
                    <Input name="reason" placeholder="Reason (required)" required />
                    <Submit className="w-full" size="sm" variant="destructive">End pair</Submit>
                  </ActionForm>
                ) : null}
              </div>
            </Panel>
          )}

          {member && s.modules.safety && (
            <Link className="flex items-center gap-2.5 rounded-2xl border border-dashed p-4 text-muted-foreground text-sm transition-colors hover:border-rose-400/60 hover:text-foreground" href={`/report?pair=${p.id}`}>
              <ShieldAlert className="size-4 shrink-0 text-rose-500" /> Something not right? Report a concern
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
