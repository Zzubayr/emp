import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/mail";

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) return new Response("Sign in first", { status: 401 });
  const s = await db.session.findFirst({ where: { id, match: { OR: [{ menteeId: user.id }, { mentorId: user.id }] } }, include: { match: { include: { mentee: true, mentor: true } } } });
  if (!s) return new Response("Not found", { status: 404 });
  const other = s.match.menteeId === user.id ? s.match.mentor : s.match.mentee;
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//EMP//Mentorship//EN", "METHOD:PUBLISH", "BEGIN:VEVENT",
    `UID:${s.id}@emp`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(s.startsAt)}`, `DTEND:${stamp(s.endsAt)}`,
    `SUMMARY:${esc(`Mentorship session with ${other.name}`)}`,
    `DESCRIPTION:${esc(`${s.topic ? `Topic: ${s.topic}\n` : ""}${s.joinUrl ? `Join: ${s.joinUrl}\n` : ""}Details: ${appUrl(`/sessions/${s.id}`)}`)}`,
    ...(s.joinUrl ? [`LOCATION:${esc(s.joinUrl)}`] : []),
    `STATUS:${s.status === "CANCELLED" ? "CANCELLED" : "CONFIRMED"}`,
    "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", "DESCRIPTION:Mentorship session in 1 hour", "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return new Response(ics, { headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="mentorship-session.ics"` } });
}
