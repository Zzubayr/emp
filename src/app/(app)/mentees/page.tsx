import { CalendarPlus, Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Chip, Empty, Meter, PageHeader, Panel, Tag, UserAvatar } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { requireReady } from "@/lib/auth";
import { pairHealth } from "@/lib/health";
import { myPairs } from "@/lib/queries";
import { getSettings } from "@/lib/settings";
import { fmtDay } from "@/lib/time";

export const metadata = { title: "My mentees" };

export default async function Mentees() {
  const user = await requireReady();
  if (user.role !== "MENTOR") redirect("/home");
  const s = await getSettings();
  const now = new Date();
  const pairs = (await myPairs(user.id, ["ACTIVE", "PAUSED", "ENDED"])).filter((p) => p.mentorId === user.id);
  const live = pairs.filter((p) => p.status !== "ENDED");
  return (
    <div>
      <PageHeader description={`${live.filter((p) => p.status === "ACTIVE").length} of ${user.capacity} spots in use. Change your capacity in your profile.`} title={`My ${s.labelMentee.toLowerCase()}s`} />
      {live.length === 0 ? (
        <Panel><Empty description="When a student is paired with you, they will appear here." icon={Users} title="No mentees yet" /></Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {live.map((p) => {
            const h = pairHealth(p, now);
            const next = p.sessions.find((x) => x.status === "CONFIRMED" && x.startsAt > now);
            const last = [...p.sessions].reverse().find((x) => x.status === "HELD");
            return (
              <article className="surface p-5" key={p.id}>
                <div className="flex items-start gap-3">
                  <UserAvatar size="lg" user={p.mentee} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{p.mentee.name}</h2>
                    <p className="truncate text-muted-foreground text-sm">{[p.mentee.level && `${p.mentee.level} level`, p.mentee.faculty].filter(Boolean).join(" · ")}</p>
                    <div className="mt-1.5"><Tag>{p.track.name}</Tag></div>
                  </div>
                  <Chip status={p.status === "PAUSED" ? "PAUSED" : h.band} />
                </div>
                <div className="mt-4"><div className="mb-1 flex justify-between text-muted-foreground text-xs"><span>Pair health</span><span className="tabular-nums">{h.score}/100</span></div><Meter value={h.score} /></div>
                <dl className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <div><dt className="text-muted-foreground text-xs">Held</dt><dd className="font-medium">{p.sessions.filter((x) => x.status === "HELD").length}</dd></div>
                  <div><dt className="text-muted-foreground text-xs">Last met</dt><dd className="font-medium">{last ? fmtDay(last.startsAt, user.timezone, { weekday: false }) : "Not yet"}</dd></div>
                  <div><dt className="text-muted-foreground text-xs">Next</dt><dd className="font-medium">{next ? fmtDay(next.startsAt, user.timezone, { weekday: false }) : "Not booked"}</dd></div>
                </dl>
                <div className="mt-4 flex gap-2 border-t pt-4">
                  <Button asChild className="flex-1" size="sm" variant="outline"><Link href={`/pairs/${p.id}`}>Open pair space</Link></Button>
                  {p.status === "ACTIVE" && <Button asChild className="flex-1" size="sm"><Link href={`/sessions/book?pair=${p.id}`}><CalendarPlus className="size-4" /> Book</Link></Button>}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
