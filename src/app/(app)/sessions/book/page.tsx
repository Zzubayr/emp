import { CalendarClock, CalendarX } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Empty, PageHeader, Panel, UserAvatar } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { requireReady } from "@/lib/auth";
import { parseList } from "@/lib/constants";
import { db } from "@/lib/db";
import { myPairs } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { mutualFree, toSlotDays } from "@/lib/slots";
import { fmtDateTime, tzOffset } from "@/lib/time";
import { BookForm } from "./form";

export const metadata = { title: "Book a session" };

export default async function Book({ searchParams }: { searchParams: Promise<{ pair?: string; replace?: string }> }) {
  const user = await requireReady();
  const s = await getSettings();
  const { pair: pairId, replace } = await searchParams;
  if (!pairId) {
    const pairs = await myPairs(user.id, ["ACTIVE"]);
    if (pairs.length === 1) redirect(`/sessions/book?pair=${pairs[0].id}`);
    return (
      <div>
        <PageHeader title="Book a session" description="Who would you like to meet?" />
        <Panel bodyClassName="p-0">
          {pairs.length === 0 ? <Empty description="You can book once you are paired." icon={CalendarX} title="No active pairing" /> : (
            <ul className="divide-y">
              {pairs.map((p) => {
                const o = p.menteeId === user.id ? p.mentor : p.mentee;
                return <li key={p.id}><Link className="flex items-center gap-3 px-5 py-4 hover:bg-accent/50" href={`/sessions/book?pair=${p.id}`}><UserAvatar user={o} /><div><div className="font-medium text-sm">{o.name}</div><div className="text-muted-foreground text-xs">{p.track.name}</div></div></Link></li>;
              })}
            </ul>
          )}
        </Panel>
      </div>
    );
  }
  const match = await db.match.findFirst({
    where: { id: pairId, OR: [{ menteeId: user.id }, { mentorId: user.id }] },
    include: { track: true, mentee: { include: { availability: true } }, mentor: { include: { availability: true } } },
  });
  if (!match) notFound();
  const other = match.menteeId === user.id ? match.mentor : match.mentee;
  const old = replace ? await db.session.findFirst({ where: { id: replace, matchId: match.id, status: { in: ["PROPOSED", "CONFIRMED"] } } }) : null;
  const free = match.status === "ACTIVE" ? await mutualFree(match.mentor, match.mentee, 14, old?.id) : [];
  const days = toSlotDays(free, user.timezone);
  const now = new Date();
  const offset = tzOffset(now, other.timezone) - tzOffset(now, user.timezone);
  const noRules = !match.mentor.availability.length || !match.mentee.availability.length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        description={old ? `Currently ${fmtDateTime(old.startsAt, user.timezone)}. Pick a new time; ${other.name.split(" ")[0]} will be asked to confirm.` : `Only times that are free for both of you are offered. ${other.name.split(" ")[0]} will be asked to confirm.`}
        eyebrow={match.track.name}
        title={old ? `Move your session with ${other.name}` : `Book a session with ${other.name}`}
      />
      {match.status !== "ACTIVE" ? (
        <Panel><Empty description="This pairing is paused or ended, so sessions cannot be booked." icon={CalendarX} title="Booking is unavailable" /></Panel>
      ) : days.length === 0 ? (
        <Panel>
          <Empty
            action={<Button asChild><Link href="/availability">Update my availability</Link></Button>}
            description={`There is no time in the next two weeks when you are both free (with ${s.minNoticeHours} hours' notice). Widen your availability, or ask ${other.name.split(" ")[0]} to add more windows.`}
            icon={CalendarClock}
            title="No overlapping time"
          />
        </Panel>
      ) : (
        <BookForm
          days={days}
          durations={parseList(match.track.sessionLengths).map(Number)}
          host={{ name: other.name, title: match.track.name, city: other.timezone.split("/").pop()!.replace("_", " "), offset }}
          matchId={match.id}
          noRules={noRules}
          replace={old ? { id: old.id, topic: old.topic ?? "", agenda: old.agenda ?? "" } : null}
          timezone={user.timezone.replace("_", " ")}
        />
      )}
    </div>
  );
}
