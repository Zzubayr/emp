import { MessageSquareHeart, Star } from "lucide-react";
import Link from "next/link";
import { Chip, Empty, PageHeader, Panel, Stat, UserAvatar } from "@/components/app/bits";
import { adminCtx, pct } from "@/lib/admin";
import { db } from "@/lib/db";
import { fmtDay } from "@/lib/time";
import { AlertTriangle, Handshake, Lightbulb } from "lucide-react";

export const metadata = { title: "Feedback" };

export default async function Feedback() {
  const { user, cohort, trackIds } = await adminCtx();
  const fb = await db.feedback.findMany({
    where: { session: { match: { cohortId: cohort?.id ?? "-", trackId: { in: trackIds } } } },
    include: { author: true, session: { include: { match: { include: { mentee: true, mentor: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  const avg = (k: "usefulness" | "preparedness" | "connection") => (fb.length ? (fb.reduce((n, f) => n + f[k], 0) / fb.length).toFixed(1) : "–");
  const overall = fb.map((f) => Math.round((f.usefulness + f.preparedness + f.connection) / 3));
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: overall.filter((x) => x === n).length }));
  const held = await db.session.count({ where: { status: "HELD", match: { cohortId: cohort?.id ?? "-", trackId: { in: trackIds } } } });
  const flagged = fb.filter((f) => f.flagged);
  const comments = fb.filter((f) => f.comment).slice(0, 30);
  return (
    <div className="space-y-6">
      <PageHeader description="Three quick ratings after every held session. People never see each other's individual ratings." title="Feedback" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat icon={Lightbulb} label="Usefulness" value={avg("usefulness")} />
        <Stat icon={Star} label="Preparedness" tone="blue" value={avg("preparedness")} />
        <Stat icon={Handshake} label="Connection" tone="green" value={avg("connection")} />
        <Stat hint={`${fb.length} of ${held * 2} possible`} icon={MessageSquareHeart} label="Response rate" tone="amber" value={`${pct(fb.length, held * 2)}%`} />
      </div>
      {fb.length === 0 ? <Panel><Empty description="Ratings appear after sessions are held." icon={MessageSquareHeart} title="No feedback yet" /></Panel> : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6">
            <Panel description="Average of the three ratings, rounded" title="Distribution">
              <ul className="space-y-2.5">
                {dist.map((d) => (
                  <li className="flex items-center gap-3 text-sm" key={d.n}>
                    <span className="flex w-8 items-center gap-0.5 tabular-nums">{d.n}<Star className="size-3 fill-amber-400 text-amber-400" /></span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-brand" style={{ width: `${pct(d.c, fb.length)}%` }} /></div>
                    <span className="w-8 text-right text-muted-foreground tabular-nums">{d.c}</span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel bodyClassName="p-0" description="Any rating of 2 or less, or a worrying word in the comment" title={<span className="flex items-center gap-2"><AlertTriangle className="size-4 text-rose-500" /> Flagged ({flagged.length})</span>}>
              <ul className="divide-y">
                {flagged.slice(0, 10).map((f) => (
                  <li key={f.id}><Link className="block px-5 py-3 text-sm transition-colors hover:bg-accent/50" href={`/pairs/${f.session.matchId}`}><span className="font-medium">{f.author.name}</span> <span className="text-muted-foreground">rated {f.usefulness}/{f.preparedness}/{f.connection}</span><div className="text-muted-foreground text-xs">{f.session.match.mentee.name} with {f.session.match.mentor.name} · {fmtDay(f.createdAt, user.timezone)}</div></Link></li>
                ))}
                {flagged.length === 0 && <li className="px-5 py-6 text-center text-muted-foreground text-sm">Nothing flagged.</li>}
              </ul>
            </Panel>
          </div>
          <Panel bodyClassName="p-0" className="lg:col-span-2" title="Recent comments">
            <ul className="divide-y">
              {comments.map((f) => (
                <li className="flex gap-3 px-5 py-4" key={f.id}>
                  <UserAvatar size="sm" user={f.author} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-sm"><span className="font-medium">{f.author.name}</span><span className="text-muted-foreground text-xs">{f.author.id === f.session.match.menteeId ? "mentee" : "mentor"} · {fmtDay(f.createdAt, user.timezone)}</span>{f.flagged && <Chip label="Flagged" status="HIGH" />}</div>
                    <p className="mt-1 text-sm">“{f.comment}”</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-0.5 text-sm tabular-nums">{((f.usefulness + f.preparedness + f.connection) / 3).toFixed(1)}<Star className="size-3.5 fill-amber-400 text-amber-400" /></span>
                </li>
              ))}
              {comments.length === 0 && <li className="px-5 py-8 text-center text-muted-foreground text-sm">No written comments yet.</li>}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}
