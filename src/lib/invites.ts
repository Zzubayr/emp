import { db } from "./db";
import { appUrl, sendMail } from "./mail";
import { getSettings } from "./settings";

export async function sendInvite(userId: string, reminder = false) {
  const user = await db.user.findUnique({ where: { id: userId }, include: { memberships: { include: { track: true, cohort: true }, take: 3 } } });
  if (!user || user.status === "REMOVED" || user.status === "SUSPENDED") return;
  const s = await getSettings();
  const tracks = user.memberships.map((m) => m.track.name).join(", ");
  const cohort = user.memberships[0]?.cohort.name;
  await sendMail({
    to: user.email,
    subject: reminder ? `Reminder: your place in ${s.orgName} is waiting` : `Welcome to ${s.orgName}`,
    body: `Hi ${user.name.split(" ")[0]},\n\nYou have been selected to join ${s.orgName}${cohort ? ` (${cohort})` : ""}${tracks ? ` in the ${tracks} track` : ""}.\n\nSigning in takes a minute: enter this email address (${user.email}) and we will send you a one-time code. There is no password to remember.\n\nPlease use the same Google account you will join Google Meet with.`,
    type: reminder ? "invite_reminder" : "invite",
    cta: { label: "Sign in to EMP", href: appUrl(`/sign-in?email=${encodeURIComponent(user.email)}`) },
  });
  await db.user.update({ where: { id: user.id }, data: { invitedAt: user.invitedAt ?? new Date(), inviteCount: { increment: 1 } } });
}
