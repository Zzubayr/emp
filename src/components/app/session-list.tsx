import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Chip, UserAvatar } from "@/components/app/bits";
import { fmtDay, fmtTime, localParts, tzAbbr } from "@/lib/time";

type Row = {
  id: string; startsAt: Date; endsAt: Date; status: string; topic: string | null; durationMin: number;
  match: { menteeId: string; mentee: { name: string; avatar: number }; mentor: { name: string; avatar: number }; track: { name: string } };
};

export function SessionList({ sessions, userId, tz, admin }: { sessions: Row[]; userId?: string; tz: string; admin?: boolean }) {
  return (
    <ul className="divide-y">
      {sessions.map((s) => {
        const other = s.match.menteeId === userId ? s.match.mentor : s.match.mentee;
        const p = localParts(s.startsAt, tz);
        return (
          <li key={s.id}>
            <Link className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-accent/50" href={`/sessions/${s.id}`}>
              <div className="flex w-12 shrink-0 flex-col items-center rounded-xl border bg-card py-1.5 text-center leading-none">
                <span className="text-[10px] text-muted-foreground uppercase">{fmtDay(s.startsAt, tz, { weekday: false }).split(" ")[1]}</span>
                <span className="mt-0.5 font-semibold text-lg tabular-nums">{p.d}</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {!admin && <UserAvatar size="sm" user={other} />}
                  <span className="truncate font-medium text-sm">{admin ? `${s.match.mentee.name} with ${s.match.mentor.name}` : other.name}</span>
                </div>
                <div className="mt-0.5 truncate text-muted-foreground text-xs">
                  {fmtDay(s.startsAt, tz).split(" ")[0]} {fmtTime(s.startsAt, tz)} {tzAbbr(s.startsAt, tz)} · {s.durationMin} min · {s.topic || s.match.track.name}
                </div>
              </div>
              <Chip className="hidden sm:inline-flex" status={s.status} />
              <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
