import { RHYTHMS } from "./constants";
import { DAY_MS } from "./time";

type S = { status: string; startsAt: Date; lateCancel: boolean; sharedNotes: string | null; feedback?: { usefulness: number; preparedness: number; connection: number }[] };
type M = { status: string; rhythm: string; startedAt: Date | null; createdAt: Date; sessions: S[] };

export type Health = { score: number; band: "Healthy" | "Quiet" | "At risk"; action: string };

export function pairHealth(m: M, now = new Date()): Health {
  const t = now.getTime();
  const since = (m.startedAt ?? m.createdAt).getTime();
  const ageDays = (t - since) / DAY_MS;
  const plan = RHYTHMS[m.rhythm]?.perMonth ?? 2;
  const last30 = m.sessions.filter((s) => s.startsAt.getTime() > t - 30 * DAY_MS && s.startsAt.getTime() <= t);
  const held = last30.filter((s) => s.status === "HELD").length;
  const sHeld = Math.min(1, held / Math.max(1, Math.min(plan, Math.ceil((plan * Math.min(ageDays, 30)) / 30))));

  const lastHeld = m.sessions.filter((s) => s.status === "HELD").sort((a, b) => +b.startsAt - +a.startsAt)[0];
  const upcoming = m.sessions.some((s) => ["CONFIRMED", "PROPOSED"].includes(s.status) && s.startsAt.getTime() > t && s.startsAt.getTime() < t + 14 * DAY_MS);
  const gap = (t - (lastHeld?.startsAt.getTime() ?? since)) / DAY_MS;
  const sRecency = upcoming ? Math.max(0.8, 1 - gap / 60) : gap <= 14 ? 1 : Math.max(0, 1 - (gap - 14) / 31);

  const fb = m.sessions.flatMap((s) => s.feedback ?? []);
  const avg = fb.length ? fb.reduce((n, f) => n + (f.usefulness + f.preparedness + f.connection) / 3, 0) / fb.length : 3.6;
  const sFeedback = avg / 5;

  const misses = last30.filter((s) => s.status.startsWith("NO_SHOW") || s.lateCancel).length;
  const sReliability = 1 - Math.min(1, misses / 3);
  const sActivity = m.sessions.some((s) => s.sharedNotes) ? 1 : 0.4;

  let score = Math.round(100 * (0.4 * sHeld + 0.25 * sRecency + 0.2 * sFeedback + 0.1 * sReliability + 0.05 * sActivity));
  if (ageDays < 14 && misses === 0) score = Math.max(score, upcoming || held ? 82 : 70); // new pairs get time to start
  const band = score >= 70 ? "Healthy" : score >= 40 ? "Quiet" : "At risk";
  const action = band === "Healthy" ? "No action needed" : misses >= 2 ? "Check-in call" : band === "Quiet" ? "Send a nudge" : avg < 3 ? "Consider a rematch" : "Check-in call";
  return { score, band, action };
}
