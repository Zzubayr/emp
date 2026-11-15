// Time zone helpers. Everything is stored in UTC and rendered in a person's zone.

const partsFmt = new Map<string, Intl.DateTimeFormat>();
function fmtFor(tz: string) {
  let f = partsFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short",
    });
    partsFmt.set(tz, f);
  }
  return f;
}

export function safeTz(tz?: string | null) {
  try {
    if (tz) {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return tz;
    }
  } catch {}
  return "Africa/Lagos";
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function localParts(date: Date, tz: string) {
  const p: Record<string, string> = {};
  for (const part of fmtFor(tz).formatToParts(date)) p[part.type] = part.value;
  const y = +p.year, m = +p.month, d = +p.day, h = +p.hour, mi = +p.minute;
  return { y, m, d, minutes: h * 60 + mi, weekday: WD.indexOf(p.weekday), iso: `${p.year}-${p.month}-${p.day}`, second: +p.second };
}

/** Offset (minutes) of `tz` from UTC at this instant. Lagos = +60. */
export function tzOffset(date: Date, tz: string) {
  const p = localParts(date, tz);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, 0, p.minutes, p.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** The UTC instant of a wall-clock time (minutes from midnight) on a local date in `tz`. */
export function zonedToUtc(isoDate: string, minutes: number, tz: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  let t = guess - tzOffset(new Date(guess), tz) * 60000;
  t = guess - tzOffset(new Date(t), tz) * 60000; // second pass settles DST edges
  return new Date(t);
}

export function addDaysIso(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export function weekdayOfIso(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function tzAbbr(date: Date, tz: string) {
  const s = new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "short" }).formatToParts(date);
  return s.find((x) => x.type === "timeZoneName")?.value ?? tz;
}

export function fmtTime(date: Date, tz: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true }).format(date).replace(" am", " AM").replace(" pm", " PM");
}

export function fmtDay(date: Date, tz: string, opts: { year?: boolean; weekday?: boolean } = {}) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz, day: "numeric", month: "short",
    ...(opts.weekday === false ? {} : { weekday: "short" }),
    ...(opts.year ? { year: "numeric" } : {}),
  }).format(date);
}

/** "Tue, 17 Nov · 4:00 PM WAT" */
export function fmtDateTime(date: Date, tz: string) {
  return `${fmtDay(date, tz)} · ${fmtTime(date, tz)} ${tzAbbr(date, tz)}`;
}

export function fmtRange(start: Date, end: Date, tz: string) {
  return `${fmtDay(start, tz)} · ${fmtTime(start, tz)} – ${fmtTime(end, tz)} ${tzAbbr(start, tz)}`;
}

export function fmtMinutes(min: number) {
  const h = Math.floor(min / 60), m = min % 60;
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}

export function relTime(date: Date, now = new Date()) {
  const diff = date.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const units: [number, string][] = [[86400000 * 30, "month"], [86400000 * 7, "week"], [86400000, "day"], [3600000, "hour"], [60000, "minute"]];
  for (const [ms, name] of units) {
    if (abs >= ms) {
      const n = Math.round(abs / ms);
      return diff < 0 ? `${n} ${name}${n > 1 ? "s" : ""} ago` : `in ${n} ${name}${n > 1 ? "s" : ""}`;
    }
  }
  return diff < 0 ? "just now" : "in a moment";
}

export const DAY_MS = 86400000;
