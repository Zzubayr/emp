import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Chip, Empty, PageHeader, Panel } from "@/components/app/bits";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDay, relTime } from "@/lib/time";

export const metadata = { title: "Safety" };

export default async function Safety() {
  const user = await requireAdmin();
  const cases = await db.safetyCase.findMany({ orderBy: [{ status: "asc" }, { createdAt: "desc" }], include: { _count: { select: { notes: true } } } });
  const people = await db.user.findMany({ where: { id: { in: cases.flatMap((c) => [c.reporterId, c.subjectId ?? ""]) } }, select: { id: true, name: true } });
  const name = (id: string | null) => people.find((p) => p.id === id)?.name ?? "Not named";
  const order = { OPEN: 0, IN_REVIEW: 1, RESOLVED: 2 } as Record<string, number>;
  return (
    <div>
      <PageHeader description="Reports from Report a concern. Access is limited to program admins; every view and change is logged, and case notes cannot be edited or deleted." title="Safety cases" />
      <Panel bodyClassName="p-0">
        {cases.length === 0 ? <Empty description="When someone reports a concern it appears here and you are alerted immediately." icon={ShieldCheck} title="No reports" /> : (
          <ul className="divide-y">
            {[...cases].sort((a, b) => order[a.status] - order[b.status] || +b.createdAt - +a.createdAt).map((c) => (
              <li key={c.id}>
                <Link className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-accent/50 sm:flex-row sm:items-center" href={`/admin/safety/${c.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">{c.category}</div>
                    <div className="truncate text-muted-foreground text-xs">Reported by {name(c.reporterId)}{c.subjectId ? ` about ${name(c.subjectId)}` : ""} · {fmtDay(c.createdAt, user.timezone)} ({relTime(c.createdAt)}) · {c._count.notes} notes</div>
                  </div>
                  <div className="flex gap-2"><Chip status={c.severity} /><Chip status={c.status} /></div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
