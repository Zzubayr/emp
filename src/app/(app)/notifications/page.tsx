import { Bell, BellOff } from "lucide-react";
import Link from "next/link";
import { markAllRead } from "@/actions/account";
import { ActionButton } from "@/components/app/action-form";
import { Empty, PageHeader, Panel } from "@/components/app/bits";
import { requireReady } from "@/lib/auth";
import { db } from "@/lib/db";
import { relTime } from "@/lib/time";

export const metadata = { title: "Notifications" };

export default async function Notifications() {
  const user = await requireReady();
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 60 });
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader actions={unread > 0 ? <ActionButton action={markAllRead} variant="outline">Mark all as read</ActionButton> : undefined} description={unread ? `${unread} unread` : "You are up to date."} title="Notifications" />
      <Panel bodyClassName="p-0">
        {items.length === 0 ? <Empty description="Reminders, session updates and messages from the program team will appear here." icon={BellOff} title="Nothing yet" /> : (
          <ul className="divide-y">
            {items.map((n) => {
              const body = (
                <div className="flex gap-3 px-5 py-4">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-brand"}`} />
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"><Bell className="size-4" /></span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm ${n.readAt ? "" : "font-medium"}`}>{n.title}</div>
                    {n.body && <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-muted-foreground text-sm">{n.body}</p>}
                    <div className="mt-1 text-muted-foreground text-xs">{relTime(n.createdAt)}</div>
                  </div>
                </div>
              );
              return <li key={n.id}>{n.href ? <Link className="block transition-colors hover:bg-accent/50" href={n.href}>{body}</Link> : body}</li>;
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
