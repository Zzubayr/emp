import { CalendarDays, CalendarPlus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Empty, PageHeader, Panel } from "@/components/app/bits";
import { SessionList } from "@/components/app/session-list";
import { Button } from "@/components/ui/button";
import { isStaffRole, requireReady } from "@/lib/auth";
import { myPairs, mySessions } from "@/lib/queries";

export const metadata = { title: "Sessions" };

export default async function Sessions() {
  const user = await requireReady();
  if (isStaffRole(user.role)) redirect("/admin/sessions");
  const now = new Date();
  const [all, pairs] = await Promise.all([mySessions(user.id), myPairs(user.id, ["ACTIVE"])]);
  const upcoming = all.filter((s) => ["CONFIRMED", "PROPOSED"].includes(s.status) && s.endsAt > now);
  const needs = all.filter((s) => s.status === "CONFIRMED" && s.endsAt <= now);
  const past = all.filter((s) => !upcoming.includes(s) && !needs.includes(s)).reverse();
  return (
    <div>
      <PageHeader
        actions={pairs.length === 1 ? <Button asChild><Link href={`/sessions/book?pair=${pairs[0].id}`}><CalendarPlus className="size-4" /> Book a session</Link></Button> : pairs.length > 1 ? <Button asChild><Link href="/sessions/book"><CalendarPlus className="size-4" /> Book a session</Link></Button> : undefined}
        description={`All times are shown in your time zone (${user.timezone.replace("_", " ")}).`}
        title="Sessions"
      />
      <div className="space-y-6">
        {needs.length > 0 && <Panel bodyClassName="p-0" description="These have finished. Mark what happened so attendance stays accurate." title="Waiting to be logged"><SessionList sessions={needs} tz={user.timezone} userId={user.id} /></Panel>}
        <Panel bodyClassName="p-0" title="Upcoming">
          {upcoming.length ? <SessionList sessions={upcoming} tz={user.timezone} userId={user.id} /> : <Empty action={pairs[0] ? <Button asChild size="sm"><Link href={`/sessions/book?pair=${pairs[0].id}`}>Book your first</Link></Button> : undefined} description={pairs.length ? "Pick a time that is free for both of you." : "You can book once you are paired."} icon={CalendarDays} title="No sessions yet" />}
        </Panel>
        {past.length > 0 && <Panel bodyClassName="p-0" title="History"><SessionList sessions={past.slice(0, 30)} tz={user.timezone} userId={user.id} /></Panel>}
      </div>
    </div>
  );
}
