import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";

/** Logs the join click (the attendance signal), then sends the person to the meeting. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  if (!user) redirect("/sign-in");
  const s = await db.session.findFirst({ where: { id, match: { OR: [{ menteeId: user.id }, { mentorId: user.id }] } } });
  if (!s) redirect("/sessions");
  const now = Date.now();
  const live = s.status === "CONFIRMED" && now >= s.startsAt.getTime() - 10 * 60_000 && now <= s.endsAt.getTime();
  if (!live || !s.joinUrl) redirect(`/sessions/${id}`);
  await db.joinEvent.create({ data: { sessionId: id, userId: user.id } });
  redirect(s.joinUrl);
}
