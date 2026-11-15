import { audit } from "./audit";
import { db } from "./db";
import { sendInvite } from "./invites";
import { allocate } from "./matching";
import { notify, notifyAdmins } from "./notify";
import { activateMatch, recordOutcome } from "./ops";
import { getSettings } from "./settings";
import { DAY_MS, fmtDateTime, relTime } from "./time";

export const DEFAULT_RULES = [
  { key: "session_reminder", label: "Session reminder", audience: "Both", offsets: [1440, 60], subject: "Reminder: session with {{partnerName}}", body: "Your session with {{partnerName}} is {{when}} ({{sessionTime}}).\n\n{{link}}\n\nNeed to move it? Open the session to reschedule." },
  { key: "invite_reminder", label: "Invite not used", audience: "Invited people", offsets: [3 * 1440, 7 * 1440, 14 * 1440], subject: "", body: "" },
  { key: "profile_incomplete", label: "Profile incomplete", audience: "Mentee, mentor", offsets: [2 * 1440, 7 * 1440], subject: "Finish your profile", body: "You are a few steps away from getting started. Finishing your profile takes about three minutes." },
  { key: "request_pending", label: "Mentor request waiting", audience: "Mentor", offsets: [2 * 1440], subject: "A mentee is waiting for your reply", body: "{{partnerName}} asked you to be their mentor. Please accept or decline so they are not left waiting." },
  { key: "book_first_session", label: "Book first session", audience: "Both", offsets: [3 * 1440, 7 * 1440], subject: "Book your first session with {{partnerName}}", body: "You and {{partnerName}} have not booked a session yet. Pick a time that works for you both." },
  { key: "no_show_check", label: "No-show check", audience: "Missing person", offsets: [15], subject: "Your session has started", body: "{{partnerName}} is waiting for you in your session. Join now from the session page." },
  { key: "notes_due", label: "Notes and outcome due", audience: "Mentor", offsets: [120, 1440], subject: "How did your session with {{partnerName}} go?", body: "Please mark whether the session happened and add a few shared notes while it is fresh." },
  { key: "feedback_due", label: "Feedback due", audience: "Both", offsets: [120, 1560], subject: "How was your session with {{partnerName}}?", body: "Three quick ratings, under a minute. Your feedback helps the program support you both." },
] as const;

export async function ensureRules() {
  for (const r of DEFAULT_RULES) {
    await db.reminderRule.upsert({
      where: { key: r.key }, update: {},
      create: { key: r.key, label: r.label, audience: r.audience, offsets: JSON.stringify(r.offsets), subject: r.subject, body: r.body },
    });
  }
}

const fill = (tpl: string, vars: Record<string, string>) => tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");

async function once(key: string) {
  try {
    await db.reminderLog.create({ data: { key } });
    return true;
  } catch {
    return false;
  }
}

type Rule = { enabled: boolean; offsets: number[]; subject: string; body: string; inApp: boolean; email: boolean };

/** One pass of the reminder engine. Safe to run every minute: every delivery is keyed, so nothing sends twice. */
export async function runTick(now = new Date()) {
  await ensureRules();
  const s = await getSettings();
  const stats = { sent: 0, expired: 0, autoHeld: 0, allocated: 0 };
  const rules = new Map<string, Rule>();
  for (const r of await db.reminderRule.findMany()) {
    rules.set(r.key, { enabled: r.enabled && s.modules.reminders, offsets: JSON.parse(r.offsets), subject: r.subject, body: r.body, inApp: r.inApp, email: r.email });
  }
  const t = now.getTime();
  const due = (base: Date, offsetMin: number, after: boolean, graceMin = 720) => {
    const at = base.getTime() + (after ? 1 : -1) * offsetMin * 60_000;
    return t >= at && t < at + graceMin * 60_000;
  };
  const send = async (rule: Rule, userId: string, type: string, vars: Record<string, string>, href: string, cta?: string) => {
    await notify(userId, { type, title: fill(rule.subject, vars), body: fill(rule.body, vars).replace(/\n{3,}/g, "\n\n").trim(), href, cta, email: rule.email });
    stats.sent++;
  };

  // --- Housekeeping: proposals that ran out of time ---
  const stale = await db.session.updateMany({ where: { status: "PROPOSED", startsAt: { lt: now } }, data: { status: "EXPIRED" } });
  stats.expired += stale.count;

  // --- Sessions around now ---
  const sessions = await db.session.findMany({
    where: { status: { in: ["CONFIRMED", "HELD"] }, startsAt: { gt: new Date(t - 3 * DAY_MS), lt: new Date(t + 8 * DAY_MS) } },
    include: { match: { include: { mentee: true, mentor: true } }, joins: true, feedback: true },
  });
  for (const ses of sessions) {
    const people = [ses.match.mentee, ses.match.mentor];
    const partner = (id: string) => (id === ses.match.menteeId ? ses.match.mentor : ses.match.mentee);
    const href = `/sessions/${ses.id}`;
    if (ses.status === "CONFIRMED") {
      const r = rules.get("session_reminder");
      if (r?.enabled && ses.startsAt > now) {
        for (const off of r.offsets) {
          if (!due(ses.startsAt, off, false, off)) continue;
          for (const u of people) {
            if (!(await once(`sr:${ses.id}:${off}:${u.id}`))) continue;
            await send(r, u.id, "session_reminder", {
              firstName: u.name.split(" ")[0], partnerName: partner(u.id).name, when: relTime(ses.startsAt, now),
              sessionTime: fmtDateTime(ses.startsAt, u.timezone), link: ses.joinUrl ? `Join: ${ses.joinUrl}` : "",
            }, href, "Open session");
          }
        }
      }
      const joined = new Set(ses.joins.map((j) => j.userId));
      const ns = rules.get("no_show_check");
      if (ns?.enabled && joined.size === 1 && t < ses.endsAt.getTime()) {
        for (const off of ns.offsets) {
          if (!due(ses.startsAt, off, true, ses.durationMin)) continue;
          const missing = people.find((u) => !joined.has(u.id))!;
          if (await once(`ns:${ses.id}:${missing.id}`)) await send(ns, missing.id, "no_show_check", { partnerName: partner(missing.id).name }, href, "Join now");
        }
      }
      // Both people clicked Join and the session is over: count it as held.
      if (s.modules.attendance && joined.size === 2 && t > ses.endsAt.getTime()) {
        await recordOutcome(ses.id, "HELD", null, "JOIN_CLICK");
        stats.autoHeld++;
        continue;
      }
      const nd = rules.get("notes_due");
      if (nd?.enabled && t > ses.endsAt.getTime()) {
        for (const off of nd.offsets) {
          if (due(ses.endsAt, off, true) && (await once(`nd:${ses.id}:${off}`))) await send(nd, ses.match.mentorId, "notes_due", { partnerName: ses.match.mentee.name }, href, "Log the session");
        }
      }
    }
    if (ses.status === "HELD" && s.modules.feedback) {
      const fd = rules.get("feedback_due");
      const base = ses.outcomeAt && ses.outcomeAt > ses.endsAt ? ses.endsAt : ses.endsAt;
      if (fd?.enabled) {
        for (const off of fd.offsets) {
          if (!due(base, off, true)) continue;
          for (const u of people) {
            if (ses.feedback.some((f) => f.authorId === u.id)) continue;
            if (await once(`fd:${ses.id}:${off}:${u.id}`)) await send(fd, u.id, "feedback_due", { partnerName: partner(u.id).name }, `${href}#feedback`, "Give feedback");
          }
        }
      }
    }
  }

  // --- Invites and profiles ---
  const inv = rules.get("invite_reminder");
  if (inv?.enabled) {
    const invited = await db.user.findMany({ where: { status: "INVITED", invitedAt: { not: null, gt: new Date(t - 30 * DAY_MS) } } });
    for (const u of invited) {
      for (const off of inv.offsets) {
        if (due(u.invitedAt!, off, true, 1440) && (await once(`inv:${u.id}:${off}`))) {
          await sendInvite(u.id, true);
          stats.sent++;
        }
      }
    }
  }
  const pi = rules.get("profile_incomplete");
  if (pi?.enabled) {
    const half = await db.user.findMany({ where: { status: "ACTIVE", onboardedAt: null, firstSignInAt: { not: null, gt: new Date(t - 14 * DAY_MS) } } });
    for (const u of half) {
      for (const off of pi.offsets) {
        if (due(u.firstSignInAt!, off, true, 1440) && (await once(`pi:${u.id}:${off}`))) await send(pi, u.id, "profile_incomplete", {}, "/welcome", "Finish profile");
      }
    }
  }

  // --- Requests: remind, then expire ---
  const requests = await db.match.findMany({ where: { status: "REQUESTED" }, include: { mentee: true, mentor: true } });
  const rp = rules.get("request_pending");
  for (const m of requests) {
    if (t > m.createdAt.getTime() + s.requestExpiryDays * DAY_MS) {
      await db.match.update({ where: { id: m.id }, data: { status: "EXPIRED", respondedAt: now, endReason: "No reply in time" } });
      await notify(m.menteeId, { type: "request_expired", title: `${m.mentor.name} did not reply in time`, body: "Your request has expired. You can choose another mentor now.", href: "/mentor" });
      await notifyAdmins({ type: "request_escalated", title: `Mentor request expired: ${m.mentee.name}`, body: `${m.mentor.name} did not answer ${m.mentee.name}'s request within ${s.requestExpiryDays} days.`, href: "/admin/matching", email: false }, m.trackId);
      stats.expired++;
      continue;
    }
    if (rp?.enabled) {
      for (const off of rp.offsets) {
        if (due(m.createdAt, off, true, 1440) && (await once(`rp:${m.id}:${off}`))) await send(rp, m.mentorId, "request_pending", { partnerName: m.mentee.name }, "/requests", "Review request");
      }
    }
  }

  // --- Pairs with nothing booked ---
  const bf = rules.get("book_first_session");
  if (bf?.enabled && s.modules.scheduling) {
    const idle = await db.match.findMany({ where: { status: "ACTIVE", startedAt: { gt: new Date(t - 10 * DAY_MS) }, sessions: { none: {} } }, include: { mentee: true, mentor: true } });
    for (const m of idle) {
      for (const off of bf.offsets) {
        if (!due(m.startedAt!, off, true, 1440) || !(await once(`bf:${m.id}:${off}`))) continue;
        await send(bf, m.menteeId, "book_first_session", { partnerName: m.mentor.name }, `/sessions/book?pair=${m.id}`, "Book a session");
        await send(bf, m.mentorId, "book_first_session", { partnerName: m.mentee.name }, `/sessions/book?pair=${m.id}`, "Book a session");
      }
    }
  }

  // --- Selection windows that just closed ---
  const closed = await db.track.findMany({ where: { windowClose: { lt: now, gt: new Date(t - 2 * DAY_MS) }, assignmentMode: { in: ["PICK", "REQUEST", "RANK"] }, status: "OPEN" }, include: { cohorts: true } });
  for (const tr of closed) {
    if (tr.assignmentMode !== "RANK" && tr.fallback !== "AUTO") continue;
    for (const ct of tr.cohorts) {
      if (!(await once(`win:${tr.id}:${ct.cohortId}:${tr.windowClose!.toISOString()}`))) continue;
      const pairs = await allocate(ct.cohortId, tr.id, tr.assignmentMode === "RANK");
      for (const p of pairs) await activateMatch({ ...p, cohortId: ct.cohortId, trackId: tr.id }, null);
      stats.allocated += pairs.length;
      await audit(null, "track.window_closed", tr.name, `${pairs.length} pairs allocated`);
      await notifyAdmins({ type: "window_closed", title: `${tr.name}: selection window closed`, body: `${pairs.length} mentees were allocated automatically. Anyone left is in the assignment queue.`, href: "/admin/matching", email: false }, tr.id);
    }
  }
  return stats;
}

export function parseOffsets(text: string): number[] {
  return text.split(",").map((x) => x.trim().toLowerCase()).filter(Boolean).map((x) => {
    const m = x.match(/^(\d+)\s*(m|min|h|hr|hrs|d|day|days)?$/);
    if (!m) throw new Error(`"${x}" is not a time. Use values like 15m, 2h or 3d.`);
    const n = Number(m[1]);
    return m[2]?.startsWith("d") ? n * 1440 : m[2]?.startsWith("h") ? n * 60 : n;
  });
}

export function fmtOffset(min: number) {
  if (min % 1440 === 0) return `${min / 1440}d`;
  if (min % 60 === 0) return `${min / 60}h`;
  return `${min}m`;
}
