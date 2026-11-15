import { Mail } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { approveMentor, removeMembership, resendInvite, setPersonStatus, updatePerson } from "@/actions/people";
import { ActionButton, ActionForm, Submit } from "@/components/app/action-form";
import { Chip, Field, NativeSelect, PageHeader, Panel, Tag, UserAvatar } from "@/components/app/bits";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { adminCtx } from "@/lib/admin";
import { isAdminRole } from "@/lib/auth";
import { FACULTIES, LEVELS, parseList, ROLE_LABEL } from "@/lib/constants";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { fmtDay, relTime } from "@/lib/time";

export const metadata = { title: "Person" };

export default async function Person({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, scope } = await adminCtx();
  const s = await getSettings();
  const u = await db.user.findUnique({
    where: { id },
    include: {
      memberships: { include: { track: true, cohort: true }, orderBy: { createdAt: "desc" } },
      menteeMatches: { include: { mentor: true, track: true, cohort: true }, orderBy: { createdAt: "desc" } },
      mentorMatches: { include: { mentee: true, track: true, cohort: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!u) notFound();
  if (scope && !u.memberships.some((m) => scope.includes(m.trackId))) notFound();
  const admin = isAdminRole(user.role);
  const history = await db.auditLog.findMany({ where: { OR: [{ target: u.email }, { actorId: u.id }] }, orderBy: { createdAt: "desc" }, take: 12 });
  const matches = [...u.menteeMatches.map((m) => ({ ...m, other: m.mentor, as: "mentee" })), ...u.mentorMatches.map((m) => ({ ...m, other: m.mentee, as: "mentor" }))];
  const self = u.id === user.id;
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        actions={
          <>
            {u.status === "INVITED" && <ActionButton action={resendInvite.bind(null, u.id)} variant="outline"><Mail className="size-4" /> {u.inviteCount ? "Resend invite" : "Send invite"}</ActionButton>}
            {u.role === "MENTOR" && s.requireMentorApproval && <ActionButton action={approveMentor.bind(null, u.id)} variant={u.approvedAt ? "outline" : "default"}>{u.approvedAt ? "Remove approval" : "Approve for matching"}</ActionButton>}
          </>
        }
        description={<span className="flex flex-wrap items-center gap-2">{u.email} · {ROLE_LABEL[u.role]} <Chip status={u.status} /></span>}
        eyebrow={<Link className="hover:underline" href="/admin/people">People</Link>}
        title={<span className="flex items-center gap-3"><UserAvatar size="lg" user={u} />{u.name}</span>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="Allow list entry">
            <ActionForm action={updatePerson.bind(null, u.id)} className="grid gap-4 sm:grid-cols-2">
              <Field label="Full name"><Input defaultValue={u.name} name="name" required /></Field>
              <Field hint="Changing this keeps their history and signs them out." label="Email"><Input defaultValue={u.email} name="email" required type="email" /></Field>
              <Field label="Role">
                <NativeSelect defaultValue={u.role} disabled={!admin || self} name="role">
                  {["MENTEE", "MENTOR", "COORDINATOR", "ADMIN", ...(user.role === "SUPER_ADMIN" || u.role === "SUPER_ADMIN" ? ["SUPER_ADMIN"] : [])].map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Student ID"><Input defaultValue={u.studentId ?? ""} name="studentId" /></Field>
              <Field label="Level"><NativeSelect defaultValue={u.level ?? ""} name="level"><option value="">Not set</option>{LEVELS.map((l) => <option key={l}>{l}</option>)}</NativeSelect></Field>
              <Field label="Faculty"><NativeSelect defaultValue={u.faculty ?? ""} name="faculty"><option value="">Not set</option>{FACULTIES.map((l) => <option key={l}>{l}</option>)}</NativeSelect></Field>
              <Field className="sm:col-span-2" hint="Why they joined. Visible to admins and their mentor." label="Application notes"><Textarea defaultValue={u.applicationNotes ?? ""} name="applicationNotes" rows={3} /></Field>
              <div className="sm:col-span-2"><Submit>Save</Submit></div>
            </ActionForm>
          </Panel>

          <Panel bodyClassName="p-0" title="Tracks and cohorts">
            <ul className="divide-y">
              {u.memberships.map((m) => (
                <li className="flex items-center gap-3 px-5 py-3 text-sm" key={m.id}>
                  <div className="min-w-0 flex-1"><span className="font-medium">{m.track.name}</span> <span className="text-muted-foreground">· {m.cohort.name} · as {m.role.toLowerCase()}</span></div>
                  {m.status !== "ACTIVE" && <Tag>{m.status.toLowerCase()}</Tag>}
                  {m.cohort.status !== "COMPLETED" && <ActionButton action={removeMembership.bind(null, m.id)} confirm={`Remove ${u.name} from ${m.track.name}? Any pair in that track ends and sessions are cancelled.`} destructive size="sm" variant="ghost">Remove</ActionButton>}
                </li>
              ))}
              {u.memberships.length === 0 && <li className="px-5 py-6 text-center text-muted-foreground text-sm">Not in any track.</li>}
            </ul>
          </Panel>

          <Panel bodyClassName="p-0" title="Pairs">
            <ul className="divide-y">
              {matches.map((m) => (
                <li key={m.id}>
                  <Link className="flex items-center gap-3 px-5 py-3 text-sm transition-colors hover:bg-accent/50" href={`/pairs/${m.id}`}>
                    <UserAvatar size="sm" user={m.other} />
                    <div className="min-w-0 flex-1"><span className="font-medium">{m.other.name}</span> <span className="text-muted-foreground">· {m.track.name} · {m.cohort.name}</span></div>
                    <Chip status={m.status} />
                  </Link>
                </li>
              ))}
              {matches.length === 0 && <li className="px-5 py-6 text-center text-muted-foreground text-sm">No pairs yet.</li>}
            </ul>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Progress">
            <dl className="space-y-2.5 text-sm">
              {[
                ["Added", fmtDay(u.createdAt, user.timezone, { year: true, weekday: false })],
                ["Invites sent", u.inviteCount ? `${u.inviteCount} (first ${u.invitedAt ? fmtDay(u.invitedAt, user.timezone, { weekday: false }) : ""})` : "None"],
                ["First sign-in", u.firstSignInAt ? fmtDay(u.firstSignInAt, user.timezone, { year: true, weekday: false }) : "Not yet"],
                ["Terms accepted", u.termsAcceptedAt ? "Yes" : "Not yet"],
                ["Profile finished", u.onboardedAt ? fmtDay(u.onboardedAt, user.timezone, { year: true, weekday: false }) : "Not yet"],
                ["Time zone", u.timezone],
                ...(u.role === "MENTOR" ? [["Capacity", `${u.capacity} mentees`]] : []),
              ].map(([k, v]) => <div className="flex justify-between gap-3" key={k}><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>)}
            </dl>
            {(u.bio || u.goalsText) && <p className="mt-4 border-t pt-4 text-sm leading-relaxed">{u.bio || u.goalsText}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">{parseList(u.role === "MENTOR" ? u.expertise : u.interests).map((t) => <Tag key={t}>{t}</Tag>)}</div>
          </Panel>

          {!self && (
            <Panel description="Suspending pauses their pairs. Removing ends their pairs, cancels sessions and tells their partners." title="Access">
              <div className="flex flex-wrap gap-2">
                {u.status === "ACTIVE" || u.status === "INVITED" ? <ActionButton action={setPersonStatus.bind(null, u.id, "SUSPENDED")} confirm={`Suspend ${u.name}? They will be signed out and their pairs paused.`} variant="outline">Suspend</ActionButton> : null}
                {u.status === "SUSPENDED" && <ActionButton action={setPersonStatus.bind(null, u.id, "ACTIVE")} variant="outline">Reactivate</ActionButton>}
                {u.status === "REMOVED" && <ActionButton action={setPersonStatus.bind(null, u.id, "INVITED")} variant="outline">Restore to allow list</ActionButton>}
                {u.status !== "REMOVED" && <ActionButton action={setPersonStatus.bind(null, u.id, "REMOVED")} confirm={`Remove ${u.name} from the program? Their pairs end and their partners are notified.`} confirmLabel="Remove" destructive variant="ghost"><span className="text-destructive">Remove</span></ActionButton>}
              </div>
            </Panel>
          )}

          <Panel bodyClassName="p-0" title="History">
            <ul className="divide-y text-sm">
              {history.map((h) => <li className="px-5 py-2.5" key={h.id}><span className="font-medium">{h.actorName}</span> <span className="text-muted-foreground">{h.action.replace(/[._]/g, " ")}{h.detail ? ` · ${h.detail}` : ""}</span><div className="text-muted-foreground text-xs">{relTime(h.createdAt)}</div></li>)}
              {history.length === 0 && <li className="px-5 py-6 text-center text-muted-foreground">No changes recorded.</li>}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
