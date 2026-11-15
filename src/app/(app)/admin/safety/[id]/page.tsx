import Link from "next/link";
import { notFound } from "next/navigation";
import { addCaseNote, updateCase } from "@/actions/safety";
import { ActionForm, Submit } from "@/components/app/action-form";
import { Chip, Field, NativeSelect, PageHeader, Panel } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/time";

export const metadata = { title: "Safety case" };

export default async function Case({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAdmin();
  const c = await db.safetyCase.findUnique({ where: { id }, include: { notes: { orderBy: { createdAt: "asc" } } } });
  if (!c) notFound();
  await audit(user, "safety.view", c.id);
  const people = await db.user.findMany({ where: { id: { in: [c.reporterId, c.subjectId ?? "", ...c.notes.map((n) => n.authorId)] } }, select: { id: true, name: true, email: true, role: true } });
  const p = (pid: string | null) => people.find((x) => x.id === pid);
  const match = c.matchId ? await db.match.findUnique({ where: { id: c.matchId }, include: { track: true } }) : null;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        description={`Reported ${fmtDateTime(c.createdAt, user.timezone)}`}
        eyebrow={<Link className="hover:underline" href="/admin/safety">Safety cases</Link>}
        title={<span className="flex flex-wrap items-center gap-3">{c.category} <Chip status={c.severity} /> <Chip status={c.status} /></span>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel title="What was reported"><p className="whitespace-pre-wrap text-sm leading-relaxed">{c.details}</p></Panel>
          <Panel bodyClassName="p-0" description="Append-only: notes cannot be edited or deleted" title="Case notes and actions">
            <ol className="divide-y">
              {c.notes.map((n) => <li className="px-5 py-3.5" key={n.id}><div className="text-muted-foreground text-xs">{p(n.authorId)?.name ?? "Admin"} · {fmtDateTime(n.createdAt, user.timezone)}</div><p className="mt-1 whitespace-pre-wrap text-sm">{n.body}</p></li>)}
              {c.notes.length === 0 && <li className="px-5 py-6 text-center text-muted-foreground text-sm">No notes yet.</li>}
            </ol>
            <ActionForm action={addCaseNote.bind(null, c.id)} className="space-y-3 border-t p-5" resetOnSuccess>
              <Textarea name="body" placeholder="Record a call, a decision or an action taken…" required rows={3} />
              <Submit variant="secondary">Add note</Submit>
            </ActionForm>
          </Panel>
        </div>
        <div className="space-y-6">
          <Panel title="People">
            <dl className="space-y-3 text-sm">
              <div><dt className="text-muted-foreground text-xs">Reporter{c.anonymous ? " (asked to stay anonymous to the other person)" : ""}</dt><dd className="font-medium">{p(c.reporterId)?.name}</dd><dd className="text-muted-foreground text-xs">{p(c.reporterId)?.email}</dd></div>
              <div><dt className="text-muted-foreground text-xs">About</dt><dd className="font-medium">{p(c.subjectId)?.name ?? "No one named"}</dd>{c.subjectId && <dd className="text-muted-foreground text-xs">{p(c.subjectId)?.email}</dd>}</div>
              {match && <div><dt className="text-muted-foreground text-xs">Pairing</dt><dd className="flex items-center gap-2">{match.track.name} <Chip status={match.status} /></dd><Button asChild className="mt-2" size="sm" variant="outline"><Link href={`/pairs/${match.id}`}>Open pair</Link></Button></div>}
            </dl>
          </Panel>
          <Panel title="Status">
            <ActionForm action={updateCase.bind(null, c.id)} className="space-y-4">
              <Field label="Status"><NativeSelect defaultValue={c.status} name="status"><option value="OPEN">Open</option><option value="IN_REVIEW">In review</option><option value="RESOLVED">Resolved</option></NativeSelect></Field>
              <Field label="Severity"><NativeSelect defaultValue={c.severity} name="severity"><option value="LOW">Low</option><option value="MEDIUM">Medium</option><option value="HIGH">High</option></NativeSelect></Field>
              <Field hint="Required to resolve." label="Outcome"><Textarea defaultValue={c.outcome ?? ""} name="outcome" rows={3} /></Field>
              <Submit className="w-full">Update case</Submit>
            </ActionForm>
          </Panel>
        </div>
      </div>
    </div>
  );
}
