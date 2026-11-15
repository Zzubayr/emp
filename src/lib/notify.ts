import { db } from "./db";
import { appUrl, sendMail } from "./mail";

type N = { type: string; title: string; body?: string; href?: string; email?: boolean; cta?: string };

/** In-app notification, plus an email unless `email: false`. */
export async function notify(userId: string, n: N) {
  await db.notification.create({
    data: { userId, type: n.type, title: n.title, body: n.body, href: n.href },
  });
  if (n.email === false) return;
  const user = await db.user.findUnique({ where: { id: userId }, select: { email: true, name: true, status: true } });
  if (!user || user.status === "REMOVED" || user.status === "SUSPENDED") return;
  await sendMail({
    to: user.email,
    subject: n.title,
    body: `Hi ${user.name.split(" ")[0]},\n\n${n.body ?? n.title}`,
    type: n.type,
    cta: n.href ? { label: n.cta ?? "Open EMP", href: appUrl(n.href) } : undefined,
  });
}

export async function notifyMany(userIds: string[], n: N) {
  for (const id of [...new Set(userIds)]) await notify(id, n);
}

export async function notifyAdmins(n: N, trackId?: string) {
  const admins = await db.user.findMany({
    where: {
      status: "ACTIVE",
      OR: [{ role: { in: ["ADMIN", "SUPER_ADMIN"] } }, ...(trackId ? [{ coordinates: { some: { id: trackId } } }] : [])],
    },
    select: { id: true },
  });
  await notifyMany(admins.map((a) => a.id), n);
}
