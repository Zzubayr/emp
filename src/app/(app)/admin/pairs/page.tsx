import { HeartHandshake } from "lucide-react";
import Link from "next/link";
import { Chip, Empty, Meter, NativeSelect, PageHeader, Panel, UserAvatar } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { adminCtx, cohortPairs } from "@/lib/admin";
import { fmtDay } from "@/lib/time";

export const metadata = { title: "Pairs" };

export default async function Pairs({ searchParams }: { searchParams: Promise<{ health?: string; track?: string; status?: string }> }) {
  const { user, cohort, tracks, trackIds } = await adminCtx();
  const sp = await searchParams;
  const now = new Date();
  const ids = sp.track && trackIds.includes(sp.track) ? [sp.track] : trackIds;
  const all = cohort ? await cohortPairs(cohort.id, ids, sp.status === "ENDED" ? ["ENDED"] : ["ACTIVE", "PAUSED"]) : [];
  const pairs = all.filter((p) => !sp.health || (p.status === "ACTIVE" && p.health.band === sp.health)).sort((a, b) => a.health.score - b.health.score);
  return (
    <div>
      <PageHeader description="Every pair in the cohort, least healthy first. Health is scored 0 to 100 from sessions held, recency, feedback and reliability." title="Pairs" />
      <Panel bodyClassName="p-0">
        <form className="flex flex-col gap-2 border-b p-4 sm:flex-row">
          <NativeSelect aria-label="Health" className="sm:w-40" defaultValue={sp.health ?? ""} name="health"><option value="">Any health</option><option>At risk</option><option>Quiet</option><option>Healthy</option></NativeSelect>
          <NativeSelect aria-label="Track" className="sm:w-52" defaultValue={sp.track ?? ""} name="track"><option value="">All tracks</option>{tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</NativeSelect>
          <NativeSelect aria-label="Status" className="sm:w-44" defaultValue={sp.status ?? ""} name="status"><option value="">Active and paused</option><option value="ENDED">Ended</option></NativeSelect>
          <Button type="submit" variant="secondary">Filter</Button>
          <span className="flex-1" />
          <Button asChild variant="outline"><a href="/api/export/pairs">Export CSV</a></Button>
        </form>
        {pairs.length === 0 ? <Empty description="Pairs appear here once mentees are assigned." icon={HeartHandshake} title="No pairs match" /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground text-xs"><th className="px-5 py-3 font-medium">Mentee</th><th className="px-3 py-3 font-medium">Mentor</th><th className="px-3 py-3 font-medium">Track</th><th className="px-3 py-3 text-right font-medium">Held</th><th className="px-3 py-3 font-medium">Last met</th><th className="w-40 px-3 py-3 font-medium">Health</th><th className="px-5 py-3 font-medium">Suggested</th></tr></thead>
              <tbody className="divide-y">
                {pairs.map((p) => {
                  const held = p.sessions.filter((s) => s.status === "HELD").sort((a, b) => +b.startsAt - +a.startsAt);
                  return (
                    <tr className="transition-colors hover:bg-accent/40" key={p.id}>
                      <td className="px-5 py-3"><Link className="flex items-center gap-2.5 font-medium hover:underline" href={`/pairs/${p.id}`}><UserAvatar size="sm" user={p.mentee} />{p.mentee.name}</Link></td>
                      <td className="px-3 py-3"><span className="flex items-center gap-2.5"><UserAvatar size="sm" user={p.mentor} />{p.mentor.name}</span></td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{p.track.name}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{held.length}</td>
                      <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">{held[0] ? fmtDay(held[0].startsAt, user.timezone, { weekday: false }) : "Not yet"}</td>
                      <td className="px-3 py-3">{p.status === "ACTIVE" ? <div className="flex items-center gap-2"><Meter value={p.health.score} /><span className="w-7 text-right text-xs tabular-nums">{p.health.score}</span></div> : <Chip status={p.status} />}</td>
                      <td className="whitespace-nowrap px-5 py-3">{p.status === "ACTIVE" ? <span className="flex items-center gap-2"><Chip status={p.health.band} /><span className="text-muted-foreground text-xs">{p.health.action}</span></span> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t px-5 py-3 text-muted-foreground text-xs">{pairs.length} pair{pairs.length === 1 ? "" : "s"} · as of {fmtDay(now, user.timezone)}</p>
      </Panel>
    </div>
  );
}
