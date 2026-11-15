import { ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { Chip, Empty, PageHeader, Panel, Stat } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { adminCtx, pct } from "@/lib/admin";
import { db } from "@/lib/db";
import { meetConfigured } from "@/lib/meet";
import { fmtDay, fmtTime } from "@/lib/time";
import { Clock, UserCheck, UserX } from "lucide-react";

export const metadata = { title: "Attendance" };

export default async function Attendance() {
  const { user, cohort, trackIds } = await adminCtx();
  const sessions = await db.session.findMany({
    where: { match: { cohortId: cohort?.id ?? "-", trackId: { in: trackIds } }, status: { in: ["HELD", "NO_SHOW_MENTEE", "NO_SHOW_MENTOR"] } },
    include: { match: { include: { mentee: true, mentor: true, track: true } }, attendance: true, joins: { orderBy: { at: "asc" } } },
    orderBy: { startsAt: "desc" }, take: 100,
  });
  const rows = sessions.flatMap((s) => s.attendance);
  const count = (st: string) => rows.filter((r) => r.status === st).length;
  const noData = sessions.filter((s) => s.joins.length === 0).length;
  const cell = (s: (typeof sessions)[number], uid: string) => {
    const a = s.attendance.find((x) => x.userId === uid);
    const j = s.joins.find((x) => x.userId === uid);
    return <div className="flex flex-col items-start gap-0.5">{a ? <Chip status={a.status} /> : <Chip label="Not recorded" status="DRAFT" />}<span className="text-[11px] text-muted-foreground">{a?.source === "OVERRIDE" ? "overridden" : j ? `joined ${fmtTime(j.at, user.timezone)}` : "marked by hand"}</span></div>;
  };
  return (
    <div className="space-y-6">
      <PageHeader actions={<Button asChild variant="outline"><a href="/api/export/attendance">Export CSV</a></Button>} description={`Results per person for the last ${sessions.length} finished sessions. ${meetConfigured() ? "Meeting links are created through Google Meet." : "Attendance comes from the Join button and the logged outcome; connect Google Meet in Settings for automatic links."}`} title="Attendance" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat hint={`${count("PRESENT") + count("LATE")} of ${rows.length} person-sessions`} icon={UserCheck} label="Attendance rate" tone="green" value={`${pct(count("PRESENT") + count("LATE"), rows.length)}%`} />
        <Stat icon={Clock} label="Late arrivals" tone="amber" value={count("LATE")} />
        <Stat icon={UserX} label="Absences" tone="red" value={count("ABSENT")} />
        <Stat hint="marked by hand, no join click" icon={ClipboardCheck} label="Sessions with no join data" tone="blue" value={noData} />
      </div>
      <Panel bodyClassName="p-0" description="Open a session to override a result; the reason is written to the audit log" title="Session log">
        {sessions.length === 0 ? <Empty description="Attendance appears once sessions have been held or logged." icon={ClipboardCheck} title="No finished sessions yet" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground text-xs"><th className="px-5 py-3 font-medium">Session</th><th className="px-3 py-3 font-medium">Track</th><th className="px-3 py-3 font-medium">Mentee</th><th className="px-3 py-3 font-medium">Mentor</th><th className="px-5 py-3 font-medium">Outcome</th></tr></thead>
              <tbody className="divide-y">
                {sessions.map((s) => (
                  <tr className="transition-colors hover:bg-accent/40" key={s.id}>
                    <td className="px-5 py-3"><Link className="font-medium hover:underline" href={`/sessions/${s.id}`}>{fmtDay(s.startsAt, user.timezone)} · {fmtTime(s.startsAt, user.timezone)}</Link><div className="text-muted-foreground text-xs">{s.match.mentee.name} with {s.match.mentor.name} · {s.durationMin} min</div></td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{s.match.track.name}</td>
                    <td className="px-3 py-3">{cell(s, s.match.menteeId)}</td>
                    <td className="px-3 py-3">{cell(s, s.match.mentorId)}</td>
                    <td className="px-5 py-3"><Chip status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
