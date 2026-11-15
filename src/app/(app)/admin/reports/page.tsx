import { Award, CalendarCheck, Download, HeartHandshake, Star, Timer, Users } from "lucide-react";
import { PageHeader, Panel, Stat } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { adminCtx, cohortPairs, onboardingFunnel, pct } from "@/lib/admin";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { DAY_MS, fmtDay } from "@/lib/time";

export const metadata = { title: "Reports" };

const EXPORTS = [
  ["people", "Allow list and onboarding", "Everyone in the cohort with role, track and how far they are through onboarding."],
  ["pairs", "Pairs and health", "Each pair with sessions held, no-shows and health score."],
  ["sessions", "Sessions", "Every session with status, topic and cancellation reasons."],
  ["attendance", "Attendance log", "Per person per session: result, join-click times and overrides."],
  ["mentors", "Mentor activity and verified hours", "Sessions, hours in held sessions, missed sessions and average rating per mentor."],
  ["feedback", "Feedback", "Every rating and comment. Handle with care."],
] as const;

export default async function Reports() {
  const { user, cohort, tracks, trackIds } = await adminCtx();
  const s = await getSettings();
  const now = new Date();
  const id = cohort?.id ?? "-";
  const inC = { match: { cohortId: id, trackId: { in: trackIds } } };
  const [pairs, funnel, sessions, fb, timeToMatch] = await Promise.all([
    cohortPairs(id, trackIds, ["ACTIVE", "PAUSED", "ENDED"]),
    onboardingFunnel(id, trackIds),
    db.session.findMany({ where: inC, select: { status: true, durationMin: true, startsAt: true, match: { select: { trackId: true } } } }),
    db.feedback.findMany({ where: { session: inC }, select: { usefulness: true, preparedness: true, connection: true } }),
    db.match.findMany({ where: { cohortId: id, trackId: { in: trackIds }, startedAt: { not: null } }, select: { startedAt: true, mentee: { select: { onboardedAt: true } } } }),
  ]);
  const past = sessions.filter((x) => x.startsAt <= now);
  const held = past.filter((x) => x.status === "HELD");
  const scheduled = past.filter((x) => ["HELD", "NO_SHOW_MENTEE", "NO_SHOW_MENTOR", "CANCELLED"].includes(x.status));
  const noShows = past.filter((x) => x.status.startsWith("NO_SHOW")).length;
  const hours = Math.round(held.reduce((n, x) => n + x.durationMin, 0) / 60);
  const avg = fb.length ? (fb.reduce((n, f) => n + (f.usefulness + f.preparedness + f.connection) / 3, 0) / fb.length).toFixed(1) : "–";
  const old = pairs.filter((p) => (p.startedAt ?? p.createdAt).getTime() < now.getTime() - 30 * DAY_MS);
  const retained = old.filter((p) => p.status === "ACTIVE" && p.sessions.some((x) => x.status === "HELD" && x.startsAt.getTime() > now.getTime() - 45 * DAY_MS));
  const gaps = timeToMatch.filter((m) => m.mentee.onboardedAt && m.startedAt! > m.mentee.onboardedAt).map((m) => (m.startedAt!.getTime() - m.mentee.onboardedAt!.getTime()) / DAY_MS);
  const ttm = gaps.length ? (gaps.reduce((a, b) => a + b, 0) / gaps.length).toFixed(1) : "–";
  const metrics = [
    ["Onboarding completion", `${pct(funnel.mentees.onboarded, funnel.mentees.invited)}%`, "85% or more", pct(funnel.mentees.onboarded, funnel.mentees.invited) >= 85],
    ["Time to match (profile done to paired)", ttm === "–" ? "–" : `${ttm} days`, "7 days or less", ttm !== "–" && Number(ttm) <= 7],
    ["Session completion rate", `${pct(held.length, scheduled.length)}%`, "80% or more", pct(held.length, scheduled.length) >= 80],
    ["No-show rate", `${pct(noShows, held.length + noShows)}%`, "under 10%", pct(noShows, held.length + noShows) < 10],
    ["Pairs still meeting after 30+ days", `${pct(retained.length, old.length)}%`, "75% or more", pct(retained.length, old.length) >= 75],
    ["Average session rating", avg, "4.4 or more", avg !== "–" && Number(avg) >= 4.4],
  ] as const;
  return (
    <div className="space-y-6">
      <PageHeader description={`${cohort?.name ?? "No cohort"} · figures as of ${fmtDay(now, user.timezone, { year: true })}. Exports follow the cohort selected in the sidebar and are written to the audit log.`} title="Reports" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat hint={`${funnel.mentors.invited} mentors`} icon={Users} label="Mentees" value={funnel.mentees.invited} />
        <Stat icon={HeartHandshake} label="Pairs formed" tone="blue" value={pairs.length} />
        <Stat hint={`${hours} hours of mentoring`} icon={CalendarCheck} label="Sessions held" tone="green" value={held.length} />
        <Stat hint={`${fb.length} ratings`} icon={Star} label="Average rating" tone="amber" value={avg} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel bodyClassName="p-0" description="Against the targets in the product plan" title={<span className="flex items-center gap-2"><Award className="size-4" /> Success metrics</span>}>
          <table className="w-full text-sm">
            <thead><tr className="border-b text-left text-muted-foreground text-xs"><th className="px-5 py-3 font-medium">Metric</th><th className="px-3 py-3 text-right font-medium">Now</th><th className="px-5 py-3 text-right font-medium">Target</th></tr></thead>
            <tbody className="divide-y">
              {metrics.map(([label, value, target, ok]) => (
                <tr key={label}><td className="px-5 py-3">{label}</td><td className={`px-3 py-3 text-right font-semibold tabular-nums ${value === "–" ? "text-muted-foreground" : ok ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>{value}</td><td className="px-5 py-3 text-right text-muted-foreground">{target}</td></tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel bodyClassName="p-0" description={`Minimum sessions per pair is set on each track`} title={<span className="flex items-center gap-2"><Timer className="size-4" /> By track</span>}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground text-xs"><th className="px-5 py-3 font-medium">Track</th><th className="px-3 py-3 text-right font-medium">Pairs</th><th className="px-3 py-3 text-right font-medium">Held</th><th className="px-3 py-3 text-right font-medium">Completion</th><th className="px-5 py-3 text-right font-medium">At risk</th></tr></thead>
              <tbody className="divide-y">
                {tracks.map((t) => {
                  const tp = pairs.filter((p) => p.trackId === t.id && p.status !== "ENDED");
                  const ts = past.filter((x) => x.match.trackId === t.id);
                  const th = ts.filter((x) => x.status === "HELD").length;
                  const tsch = ts.filter((x) => ["HELD", "NO_SHOW_MENTEE", "NO_SHOW_MENTOR", "CANCELLED"].includes(x.status)).length;
                  return <tr key={t.id}><td className="px-5 py-3 font-medium">{t.name}</td><td className="px-3 py-3 text-right tabular-nums">{tp.length}</td><td className="px-3 py-3 text-right tabular-nums">{th}</td><td className="px-3 py-3 text-right tabular-nums">{tsch ? `${pct(th, tsch)}%` : "–"}</td><td className="px-5 py-3 text-right tabular-nums">{tp.filter((p) => p.status === "ACTIVE" && p.health.band === "At risk").length}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <Panel bodyClassName="p-0" description="CSV files that open in Excel or Google Sheets" title="Exports">
        <ul className="divide-y">
          {EXPORTS.filter(([k]) => k !== "feedback" || s.modules.feedback).map(([kind, title, body]) => (
            <li className="flex items-center gap-4 px-5 py-3.5" key={kind}>
              <div className="min-w-0 flex-1"><div className="font-medium text-sm">{title}</div><div className="text-muted-foreground text-xs">{body}</div></div>
              <Button asChild size="sm" variant="outline"><a href={`/api/export/${kind}`}><Download className="size-4" /> CSV</a></Button>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
