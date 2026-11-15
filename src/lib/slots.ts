import { db } from "./db";
import { getSettings } from "./settings";
import { addDaysIso, localParts, weekdayOfIso, zonedToUtc } from "./time";

type Iv = [number, number]; // UTC ms
type Person = { id: string; timezone: string; availability: { weekday: number; startMin: number; endMin: number }[] };

function expand(p: Person, from: Date, days: number): Iv[] {
  const out: Iv[] = [];
  const start = addDaysIso(localParts(from, p.timezone).iso, -1);
  const rules = p.availability.length
    ? p.availability
    : [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, startMin: 8 * 60, endMin: 20 * 60 })); // no availability set yet: daytime
  for (let i = 0; i <= days + 2; i++) {
    const iso = addDaysIso(start, i);
    const wd = weekdayOfIso(iso);
    for (const r of rules) {
      if (r.weekday !== wd) continue;
      out.push([zonedToUtc(iso, r.startMin, p.timezone).getTime(), zonedToUtc(iso, r.endMin, p.timezone).getTime()]);
    }
  }
  return merge(out);
}

function merge(iv: Iv[]): Iv[] {
  const s = [...iv].sort((a, b) => a[0] - b[0]);
  const out: Iv[] = [];
  for (const x of s) {
    const last = out[out.length - 1];
    if (last && x[0] <= last[1]) last[1] = Math.max(last[1], x[1]);
    else out.push([x[0], x[1]]);
  }
  return out;
}

function intersect(a: Iv[], b: Iv[]): Iv[] {
  const out: Iv[] = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    const lo = Math.max(a[i][0], b[j][0]), hi = Math.min(a[i][1], b[j][1]);
    if (lo < hi) out.push([lo, hi]);
    if (a[i][1] < b[j][1]) i++; else j++;
  }
  return out;
}

function subtract(a: Iv[], b: Iv[]): Iv[] {
  let out = a;
  for (const [bs, be] of b) {
    const next: Iv[] = [];
    for (const [s, e] of out) {
      if (be <= s || bs >= e) next.push([s, e]);
      else {
        if (bs > s) next.push([s, bs]);
        if (be < e) next.push([be, e]);
      }
    }
    out = next;
  }
  return out;
}

/** Mutually free UTC intervals for a pair over the next `days` days. */
export async function mutualFree(mentor: Person, mentee: Person, days = 14, ignoreSessionId?: string): Promise<Iv[]> {
  const s = await getSettings();
  const now = new Date();
  const earliest = now.getTime() + s.minNoticeHours * 3600_000;
  const horizon = now.getTime() + days * 86400_000;
  let free = intersect(expand(mentor, now, days), expand(mentee, now, days));
  const busy = await db.session.findMany({
    where: {
      status: { in: ["PROPOSED", "CONFIRMED"] },
      endsAt: { gt: now },
      id: ignoreSessionId ? { not: ignoreSessionId } : undefined,
      match: { OR: [{ mentorId: { in: [mentor.id, mentee.id] } }, { menteeId: { in: [mentor.id, mentee.id] } }] },
    },
    select: { startsAt: true, endsAt: true },
  });
  free = subtract(free, busy.map((b) => [b.startsAt.getTime() - 10 * 60_000, b.endsAt.getTime() + 10 * 60_000] as Iv)); // 10 minute buffer
  free = intersect(free, [[earliest, horizon]]);
  // snap starts up to the quarter hour
  return free
    .map(([a, b]) => [Math.ceil(a / 900_000) * 900_000, b] as Iv)
    .filter(([a, b]) => b - a >= 30 * 60_000);
}

export type SlotDay = { date: string; open: [number, number]; busy: [number, number][] };

/** Shapes free intervals into per-day rails in the viewer's time zone. */
export function toSlotDays(free: Iv[], tz: string): SlotDay[] {
  const byDay = new Map<string, [number, number][]>();
  for (const [a, b] of free) {
    let cur = a;
    while (cur < b) {
      const p = localParts(new Date(cur), tz);
      const dayEnd = zonedToUtc(addDaysIso(p.iso, 1), 0, tz).getTime();
      const end = Math.min(b, dayEnd);
      const span: [number, number] = [p.minutes, p.minutes + Math.round((end - cur) / 60_000)];
      if (span[1] - span[0] >= 30) byDay.set(p.iso, [...(byDay.get(p.iso) ?? []), span]);
      cur = end;
    }
  }
  return [...byDay.entries()].sort().map(([date, spans]) => {
    spans.sort((x, y) => x[0] - y[0]);
    const open: [number, number] = [spans[0][0], spans[spans.length - 1][1]];
    const busy: [number, number][] = [];
    for (let i = 1; i < spans.length; i++) busy.push([spans[i - 1][1], spans[i][0]]);
    return { date, open, busy };
  });
}

export function isFree(free: Iv[], start: number, end: number) {
  return free.some(([a, b]) => start >= a && end <= b);
}

/** Weekly overlap in minutes between two people's availability, for match scoring. */
export function weeklyOverlapMinutes(a: Person, b: Person) {
  const ref = new Date();
  const total = intersect(expand(a, ref, 7), expand(b, ref, 7));
  const lo = ref.getTime(), hi = lo + 7 * 86400_000;
  return intersect(total, [[lo, hi]]).reduce((n, [s, e]) => n + (e - s) / 60_000, 0);
}
