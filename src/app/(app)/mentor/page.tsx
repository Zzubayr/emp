import { CalendarClock, CalendarPlus, Hourglass, Search, UserCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { withdrawRequest } from "@/actions/matching";
import { ActionButton } from "@/components/app/action-form";
import { Chip, Empty, PageHeader, Panel, Tag, UserAvatar } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { requireReady } from "@/lib/auth";
import { ASSIGNMENT_MODES, parseList } from "@/lib/constants";
import { db } from "@/lib/db";
import { suggestionsFor, trackMentors } from "@/lib/matching";
import { getSettings } from "@/lib/settings";
import { fmtDay } from "@/lib/time";
import { MentorChooser, type MentorCard } from "./chooser";

export const metadata = { title: "My mentor" };

export default async function MyMentor() {
  const user = await requireReady();
  if (user.role !== "MENTEE") redirect("/home");
  const s = await getSettings();
  const now = new Date();
  const memberships = await db.membership.findMany({
    where: { userId: user.id, role: "MENTEE", status: "ACTIVE", cohort: { status: { in: ["ONBOARDING", "ACTIVE"] } } },
    include: { track: true, cohort: true }, orderBy: { track: { area: "asc" } },
  });
  const matches = await db.match.findMany({
    where: { menteeId: user.id, status: { in: ["ACTIVE", "PAUSED", "REQUESTED", "DECLINED"] } },
    include: { mentor: true, sessions: { where: { status: "CONFIRMED", startsAt: { gt: now } }, orderBy: { startsAt: "asc" }, take: 1 } },
    orderBy: { createdAt: "desc" },
  });

  const blocks = await Promise.all(memberships.map(async (m) => {
    const active = matches.find((x) => x.trackId === m.trackId && x.cohortId === m.cohortId && ["ACTIVE", "PAUSED"].includes(x.status));
    if (active) return { m, active, cards: [] as MentorCard[], requests: [], ranking: [] as string[] };
    const mode = m.track.assignmentMode;
    const choosing = ["PICK", "REQUEST", "RANK"].includes(mode);
    let cards: MentorCard[] = [];
    if (choosing) {
      const [mentors, sug] = await Promise.all([trackMentors(m.cohortId, m.trackId), suggestionsFor(user.id, m.cohortId, m.trackId)]);
      const byId = new Map(sug.map((x) => [x.mentorId, x]));
      cards = mentors
        .filter((x) => x.spots > 0 || m.track.showFullMentors)
        .map((x) => ({
          id: x.user.id, name: x.user.name, avatar: x.user.avatar, headline: x.user.headline, bio: x.user.bio, faculty: x.user.faculty,
          expertise: parseList(x.user.expertise), languages: parseList(x.user.languages), spots: x.spots,
          score: byId.get(x.user.id)?.score ?? 0, reasons: byId.get(x.user.id)?.reasons ?? [],
          windows: x.user.availability.length,
        }))
        .sort((a, b) => Number(b.spots > 0) - Number(a.spots > 0) || b.score - a.score);
    }
    const requests = matches.filter((x) => x.trackId === m.trackId && x.cohortId === m.cohortId && ["REQUESTED", "DECLINED"].includes(x.status));
    const ranking = mode === "RANK" ? (await db.mentorRanking.findMany({ where: { menteeId: user.id, cohortId: m.cohortId, trackId: m.trackId }, orderBy: { rank: "asc" } })).map((r) => r.mentorId) : [];
    return { m, active: null, cards, requests, ranking };
  }));

  return (
    <div>
      <PageHeader description="Each of your tracks has its own mentor. Here is where things stand." title={`My ${s.labelMentor.toLowerCase()}`} />
      {blocks.length === 0 && <Panel><Empty description="You are not enrolled in a track for the current cohort. Contact the program team if this looks wrong." icon={Search} title="No track yet" /></Panel>}
      <div className="space-y-8">
        {blocks.map(({ m, active, cards, requests, ranking }) => {
          const t = m.track;
          const mode = t.assignmentMode;
          const notOpen = t.windowOpen && now < t.windowOpen;
          const closed = t.windowClose && now > t.windowClose;
          const open = requests.filter((r) => r.status === "REQUESTED");
          return (
            <section key={m.id}>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-lg">{t.name}</h2>
                <Tag>{t.area === "ACADEMIC" ? "Academic" : "Non-academic"}</Tag>
                <Tag>{m.cohort.name}</Tag>
              </div>

              {active ? (
                <div className="surface flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
                  <UserAvatar size="xl" user={active.mentor} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-xl">{active.mentor.name}</h3>{active.status === "PAUSED" && <Chip status="PAUSED" />}</div>
                    {active.mentor.headline && <p className="text-muted-foreground text-sm">{active.mentor.headline}</p>}
                    <div className="mt-2 flex flex-wrap gap-1.5">{parseList(active.mentor.expertise).slice(0, 5).map((e) => <Tag key={e}>{e}</Tag>)}</div>
                    <p className="mt-3 flex items-center gap-1.5 text-muted-foreground text-sm">
                      <CalendarClock className="size-4" />
                      {active.sessions[0] ? `Next session ${fmtDay(active.sessions[0].startsAt, user.timezone)}` : "No session booked yet"}
                    </p>
                  </div>
                  <div className="flex gap-2 sm:flex-col">
                    {active.status === "ACTIVE" && <Button asChild><Link href={`/sessions/book?pair=${active.id}`}><CalendarPlus className="size-4" /> Book a session</Link></Button>}
                    <Button asChild variant="outline"><Link href={`/pairs/${active.id}`}>Open pair space</Link></Button>
                  </div>
                </div>
              ) : ["ADMIN", "SUGGEST"].includes(mode) || closed ? (
                <Panel>
                  <Empty
                    description={closed ? "The window for choosing has closed. The program team is assigning the remaining mentors and will email you." : "The program team matches mentors by hand for this track, based on your profile. You will get an email as soon as you are paired, usually within 7 days."}
                    icon={UserCheck}
                    title={`Your ${s.labelMentor.toLowerCase()} is being assigned`}
                  />
                  <p className="text-center text-muted-foreground text-xs">Questions? <a className="text-brand underline" href={`mailto:${s.supportEmail}`}>Contact the program</a></p>
                </Panel>
              ) : notOpen ? (
                <Panel><Empty description={`You will be able to choose from ${fmtDay(t.windowOpen!, user.timezone, { year: true })}. We will remind you.`} icon={Hourglass} title="Choosing opens soon" /></Panel>
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand/20 bg-brand-soft/60 px-4 py-3 text-sm">
                    <span><span className="font-medium">{ASSIGNMENT_MODES[mode].label}.</span> <span className="text-muted-foreground">{mode === "PICK" ? "Choose a mentor and you are paired straight away. Spots are first come, first served." : mode === "REQUEST" ? `Send up to ${s.maxOpenRequests} requests with a short note. Mentors reply within ${s.requestExpiryDays} days.` : "Rank up to three mentors. Everyone is matched fairly when the window closes."}</span></span>
                    {t.windowClose && <span className="font-medium text-brand">Closes {fmtDay(t.windowClose, user.timezone)}</span>}
                  </div>
                  {open.length > 0 && (
                    <Panel bodyClassName="p-0" title="Your requests">
                      <ul className="divide-y">
                        {open.map((r) => (
                          <li className="flex items-center gap-3 px-5 py-3" key={r.id}>
                            <UserAvatar user={r.mentor} />
                            <div className="min-w-0 flex-1"><div className="truncate font-medium text-sm">{r.mentor.name}</div><div className="text-muted-foreground text-xs">Sent {fmtDay(r.createdAt, user.timezone)} · waiting for a reply</div></div>
                            <ActionButton action={withdrawRequest.bind(null, r.id)} confirm="Withdraw this request? You can send another one afterwards." size="sm" variant="ghost">Withdraw</ActionButton>
                          </li>
                        ))}
                      </ul>
                    </Panel>
                  )}
                  {cards.length === 0 ? (
                    <Panel><Empty description="Mentors are still joining this track. Check back soon, or contact the program team." icon={Search} title="No mentors available yet" /></Panel>
                  ) : (
                    <MentorChooser cards={cards} cohortId={m.cohortId} maxRequests={s.maxOpenRequests} mode={mode as "PICK" | "REQUEST" | "RANK"} ranking={ranking} requested={open.map((r) => r.mentorId)} trackId={m.trackId} />
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
