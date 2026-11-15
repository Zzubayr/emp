import { Inbox, Sparkles } from "lucide-react";
import { redirect } from "next/navigation";
import { respondRequest } from "@/actions/matching";
import { ActionButton } from "@/components/app/action-form";
import { Chip, Empty, PageHeader, Panel, Tag, UserAvatar } from "@/components/app/bits";
import { requireReady } from "@/lib/auth";
import { parseList } from "@/lib/constants";
import { db } from "@/lib/db";
import { trackMentors } from "@/lib/matching";
import { getSettings } from "@/lib/settings";
import { DAY_MS, fmtDay, relTime } from "@/lib/time";
import { DeclineButton } from "./decline";

export const metadata = { title: "Requests" };

export default async function Requests() {
  const user = await requireReady();
  if (user.role !== "MENTOR") redirect("/home");
  const s = await getSettings();
  const all = await db.match.findMany({
    where: { mentorId: user.id, status: { in: ["REQUESTED", "DECLINED", "EXPIRED"] }, createdById: { not: null } },
    include: { mentee: true, track: true, cohort: true }, orderBy: { createdAt: "desc" }, take: 40,
  });
  const open = all.filter((m) => m.status === "REQUESTED");
  const past = all.filter((m) => m.status !== "REQUESTED" && m.note);
  const spots = new Map<string, number>();
  for (const m of open) {
    const k = `${m.cohortId}:${m.trackId}`;
    if (!spots.has(k)) spots.set(k, (await trackMentors(m.cohortId, m.trackId)).find((x) => x.user.id === user.id)?.spots ?? 0);
  }
  return (
    <div>
      <PageHeader description={`Students who asked you to be their ${s.labelMentor.toLowerCase()}. Please reply within ${s.requestExpiryDays} days so no one is left waiting.`} title="Requests" />
      {open.length === 0 ? (
        <Panel><Empty description="New requests from students in your tracks will appear here, and we will email you." icon={Inbox} title="No requests waiting" /></Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {open.map((m) => {
            const left = spots.get(`${m.cohortId}:${m.trackId}`) ?? 0;
            const expires = new Date(m.createdAt.getTime() + s.requestExpiryDays * DAY_MS);
            return (
              <article className="surface flex flex-col p-5" key={m.id}>
                <div className="flex items-start gap-3">
                  <UserAvatar size="lg" user={m.mentee} />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold">{m.mentee.name}</h2>
                    <p className="text-muted-foreground text-sm">{[m.mentee.level && `${m.mentee.level} level`, m.mentee.faculty].filter(Boolean).join(" · ")}</p>
                  </div>
                  <Tag>{m.track.name}</Tag>
                </div>
                <blockquote className="mt-4 rounded-xl bg-muted/60 p-3 text-sm leading-relaxed">“{m.note}”</blockquote>
                <div className="mt-3 flex flex-wrap gap-1.5">{parseList(m.mentee.interests).slice(0, 5).map((i) => <Tag key={i}>{i}</Tag>)}</div>
                {parseList(m.reasons).length > 0 && (
                  <ul className="mt-3 space-y-1 text-muted-foreground text-xs">{parseList(m.reasons).map((r) => <li className="flex gap-1.5" key={r}><Sparkles className="size-3.5 shrink-0 text-brand" />{r}</li>)}</ul>
                )}
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <span className="text-muted-foreground text-xs">Sent {fmtDay(m.createdAt, user.timezone)} · expires {relTime(expires)}</span>
                  <div className="flex gap-2">
                    <DeclineButton id={m.id} name={m.mentee.name} />
                    <ActionButton action={respondRequest.bind(null, m.id, true, undefined)} disabled={left <= 0} size="sm">{left <= 0 ? "At capacity" : "Accept"}</ActionButton>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {past.length > 0 && (
        <Panel bodyClassName="p-0" className="mt-6" title="Earlier requests">
          <ul className="divide-y">
            {past.map((m) => (
              <li className="flex items-center gap-3 px-5 py-3" key={m.id}>
                <UserAvatar size="sm" user={m.mentee} />
                <span className="min-w-0 flex-1 truncate text-sm">{m.mentee.name} <span className="text-muted-foreground">· {m.track.name}</span></span>
                <Chip status={m.status} />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
