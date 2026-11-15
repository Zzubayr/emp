import { runTick } from "@/lib/reminders";

/** For an external scheduler: GET /api/cron/tick?key=CRON_SECRET (or Authorization: Bearer). */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const key = new URL(req.url).searchParams.get("key") ?? req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!secret || secret === "change-me" || key !== secret) return Response.json({ error: "Set CRON_SECRET and pass it as ?key=" }, { status: 401 });
  return Response.json(await runTick());
}
