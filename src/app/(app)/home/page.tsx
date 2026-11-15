import { ArrowRight, CalendarPlus, CheckSquare, ClipboardList, Clock, HeartHandshake, Hourglass, Inbox, MessageSquareHeart, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Chip, Empty, Meter, Panel, Stat, UserAvatar } from "@/components/app/bits";
import { JoinButton } from "@/components/app/join-button";
import { SessionList } from "@/components/app/session-list";
import { Button } from "@/components/ui/button";
import { isStaffRole, requireReady } from "@/lib/auth";
import { db } from "@/lib/db";
import { pairHealth } from "@/lib/health";
import { myPairs, otherOf } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { fmtDateTime, fmtDay, localParts, relTime } from "@/lib/time";

export const metadata = { title: "Home" };

export default async function HomePage() {
  const user = await requireReady();
  if (isStaffRole(user.role)) redirect("/admin");
  const s = await getSettings();
  const mentor = user.role === "MENTOR";
  const now = new Date();
  const [pairs, items, requests, memberships] = await Promise.all([
    myPairs(user.id),
    db.actionItem.findMany({ where: { ownerId: user.id, done: false, match: { status: "ACTIVE" } }, orderBy: { dueDate: "asc" }, take: 5 }),
    mentor ? db.match.findMany({ where: { mentorId: user.id, status: "REQUESTED" }, include: { mentee: true, track: true } }) : [],
    db.membership.findMany({ where: { userId: user.id, status: "ACTIVE", cohort: { status: { in: ["ONBOARDING", "ACTIVE"] } } }, include: { track: true } }),
  ]);
  const sessions = pairs.flatMap((p) => p.sessions.map((x) => ({ ...x, match: p })));
  const upcoming = sessions.filter((x) => x.status === "CONFIRMED" && x.endsAt > now).sort((a, b) => +a.startsAt - +b.startsAt);
  const next = upcoming[0];
  const toConfirm = sessions.filter((x) => x.status === "PROPOSED" && x.proposedById !== user.id && x.startsAt > now);
  const toLog = mentor ? sessions.filter((x) => x.status === "CONFIRMED" && x.endsAt < now) : [];
  const toRate = s.modules.feedback ? sessions.filter((x) => x.status === "HELD" && !x.feedback.some((f) => f.authorId === user.id) && +x.startsAt > +now - 14 * 86400_000) : [];
  const held = sessions.filter((x) => x.status === "HELD");
  const hours = Math.round((held.reduce((n, x) => n + x.durationMin, 0) / 60) * 10) / 10;
  const hour = localParts(now, user.timezone).minutes / 60;
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const unpaired = !mentor ? memberships.filter((m) => !pairs.some((p) => p.trackId === m.trackId)) : [];
  const todo = toConfirm.length + toLog.length + toRate.length + items.length + requests.length;

  return (
    <div className="space-y-6">
      <div className="animate-fade-up">
        <p className="text-muted-foreground text-sm">{fmtDay(now, user.timezone, { year: true })}</p>
        <h1 className="mt-1 font-semibold text-3xl">{greet}, {user.name.split(" ")[0]}</h1>
      </div>

      {/* The one clear next action */}
      <section className="relative animate-fade-up overflow-hidden rounded-3xl bg-linear-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-6 text-white shadow-[0_20px_50px_-20px_rgb(99_102_241/0.7)] sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgb(255_255_255/0.22),transparent_45%)]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          {next ? (
            <>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm text-white/75"><Clock className="size-4" /> Next session · {relTime(next.startsAt, now)}</div>
                <div className="mt-2 font-semibold text-2xl tracking-tight">{fmtDateTime(next.startsAt, user.timezone)}</div>
                <div className="mt-3 flex items-center gap-2.5">
                  <UserAvatar className="ring-white/30" user={otherOf(next.match, user.id)} />
                  <div className="min-w-0 text-sm"><div className="truncate font-medium">{otherOf(next.match, user.id).name}</div><div className="truncate text-white/70">{next.topic || next.match.track.name} · {next.durationMin} min</div></div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <JoinButton className="bg-white text-indigo-700 shadow-none hover:bg-white/90 aria-disabled:bg-white/15 aria-disabled:text-white/90" endsAt={next.endsAt.toISOString()} hasLink={Boolean(next.joinUrl)} sessionId={next.id} startsAt={next.startsAt.toISOString()} />
                <Link className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-white/30 px-4 font-medium text-sm transition-colors hover:bg-white/10" href={`/sessions/${next.id}`}>Details <ArrowRight className="size-4" /></Link>
              </div>
            </>
          ) : pairs.some((p) => p.status === "ACTIVE") ? (
            <>
              <div><div className="font-semibold text-2xl tracking-tight">Nothing booked yet</div><p className="mt-1 text-white/75">Pick a time that works for you both. It takes under a minute.</p></div>
              <Link className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 font-medium text-indigo-700 transition-[scale] hover:bg-white/90 active:scale-[0.97]" href={`/sessions/book?pair=${pairs.find((p) => p.status === "ACTIVE")!.id}`}><CalendarPlus className="size-4" /> Book a session</Link>
            </>
          ) : mentor ? (
            <div><div className="font-semibold text-2xl tracking-tight">You are all set</div><p className="mt-1 text-white/75">{requests.length ? "You have requests waiting for a reply." : `We will let you know as soon as a ${s.labelMentee.toLowerCase()} is paired with you.`}</p></div>
          ) : (
            <>
              <div><div className="font-semibold text-2xl tracking-tight">Let's find your {s.labelMentor.toLowerCase()}</div><p className="mt-1 text-white/75">See where things stand for each of your tracks.</p></div>
              <Link className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-5 font-medium text-indigo-700 transition-[scale] hover:bg-white/90 active:scale-[0.97]" href="/mentor"><HeartHandshake className="size-4" /> Go to my {s.labelMentor.toLowerCase()}</Link>
            </>
          )}
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat hint={mentor ? `of ${user.capacity} spots` : undefined} href={mentor ? "/mentees" : "/mentor"} icon={mentor ? Users : HeartHandshake} label={mentor ? `Active ${s.labelMentee.toLowerCase()}s` : `My ${s.labelMentor.toLowerCase()}s`} value={pairs.filter((p) => p.status === "ACTIVE").length} />
        <Stat href="/sessions" icon={CalendarPlus} label="Upcoming sessions" tone="blue" value={upcoming.length} />
        <Stat icon={Sparkles} label="Sessions held" tone="green" value={held.length} />
        <Stat hint={mentor ? "volunteer time" : "with your mentor"} icon={Clock} label="Hours together" tone="amber" value={hours} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Panel bodyClassName="p-0" description={todo ? "Small things that keep you both moving" : undefined} title="To do">
            {todo === 0 ? (
              <Empty description="Nothing needs your attention right now." icon={CheckSquare} title="You are all caught up" />
            ) : (
              <ul className="divide-y">
                {requests.map((r) => <Todo href="/requests" icon={Inbox} key={r.id} sub={r.track.name} title={`${r.mentee.name} asked you to be their mentor`} />)}
                {toConfirm.map((x) => <Todo href={`/sessions/${x.id}`} icon={Hourglass} key={x.id} sub={fmtDateTime(x.startsAt, user.timezone)} title={`Confirm the session ${otherOf(x.match, user.id).name} proposed`} />)}
                {toLog.map((x) => <Todo href={`/sessions/${x.id}`} icon={ClipboardList} key={x.id} sub={fmtDateTime(x.startsAt, user.timezone)} title={`Log your session with ${otherOf(x.match, user.id).name}`} />)}
                {toRate.map((x) => <Todo href={`/sessions/${x.id}#feedback`} icon={MessageSquareHeart} key={x.id} sub="Three quick ratings, under a minute" title={`How was your session with ${otherOf(x.match, user.id).name}?`} />)}
                {items.map((it) => <Todo href={`/pairs/${it.matchId}`} icon={CheckSquare} key={it.id} sub={it.dueDate ? `Due ${fmtDay(it.dueDate, user.timezone)}` : "No due date"} title={it.text} />)}
              </ul>
            )}
          </Panel>

          <Panel action={<Button asChild size="sm" variant="ghost"><Link href="/sessions">All sessions</Link></Button>} bodyClassName="p-0" title="Coming up">
            {upcoming.length ? <SessionList sessions={upcoming.slice(0, 4)} tz={user.timezone} userId={user.id} /> : <Empty description="Confirmed sessions will show here." icon={CalendarPlus} title="No sessions booked" />}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel bodyClassName="p-0" title={mentor ? `My ${s.labelMentee.toLowerCase()}s` : `My ${s.labelMentor.toLowerCase()}`}>
            {pairs.length === 0 && unpaired.length === 0 ? (
              <Empty description={mentor ? "Pairs appear here once they are confirmed." : "You are not in a track yet. Contact the program team."} icon={HeartHandshake} title="No pairs yet" />
            ) : (
              <ul className="divide-y">
                {pairs.map((p) => {
                  const o = otherOf(p, user.id);
                  const h = pairHealth(p, now);
                  return (
                    <li key={p.id}>
                      <Link className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-accent/50" href={`/pairs/${p.id}`}>
                        <UserAvatar user={o} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-sm">{o.name}</div>
                          <div className="truncate text-muted-foreground text-xs">{p.track.name}{p.status === "PAUSED" ? " · paused" : ""}</div>
                          {mentor && <Meter className="mt-1.5" value={h.score} />}
                        </div>
                        {mentor ? <Chip status={h.band} /> : <ArrowRight className="size-4 text-muted-foreground" />}
                      </Link>
                    </li>
                  );
                })}
                {unpaired.map((m) => (
                  <li key={m.id}>
                    <Link className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-accent/50" href="/mentor">
                      <span className="flex size-9 items-center justify-center rounded-full border border-dashed text-muted-foreground"><HeartHandshake className="size-4" /></span>
                      <div className="min-w-0 flex-1"><div className="truncate font-medium text-sm">{m.track.name}</div><div className="text-muted-foreground text-xs">No {s.labelMentor.toLowerCase()} yet</div></div>
                      <ArrowRight className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          <Panel title="First-session ideas">
            <ul className="space-y-2.5 text-muted-foreground text-sm">
              {["What made you choose your course, and what surprised you?", "What is one thing you would like to be better at by the end of term?", "What does a good week look like for you?"].map((q) => (
                <li className="flex gap-2" key={q}><Sparkles className="mt-0.5 size-4 shrink-0 text-brand" />{q}</li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Todo({ href, icon: Icon, title, sub }: { href: string; icon: typeof Inbox; title: string; sub: string }) {
  return (
    <li>
      <Link className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-accent/50" href={href}>
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand"><Icon className="size-4" /></span>
        <div className="min-w-0 flex-1"><div className="truncate font-medium text-sm">{title}</div><div className="truncate text-muted-foreground text-xs">{sub}</div></div>
        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}
