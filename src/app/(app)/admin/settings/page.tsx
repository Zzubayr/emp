import { CheckCircle2, CircleDashed, Mail, Video } from "lucide-react";
import Link from "next/link";
import { runTickNow, saveModules, saveOrgSettings, saveRule, saveWeights, sendTestEmail } from "@/actions/admin";
import { ActionButton, ActionForm, Submit } from "@/components/app/action-form";
import { Chip, Field, NativeSelect, PageHeader, Panel, Tag } from "@/components/app/bits";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requireAdmin } from "@/lib/auth";
import { TIMEZONES } from "@/lib/constants";
import { db } from "@/lib/db";
import { mailConfigured, mailProvider } from "@/lib/mail";
import { meetConfigured } from "@/lib/meet";
import { ensureRules, fmtOffset } from "@/lib/reminders";
import { getSettings, MODULE_INFO, PLANNED_MODULES } from "@/lib/settings";
import { fmtDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";

export const metadata = { title: "Settings" };
const TABS = { general: "Program", modules: "Modules and labels", matching: "Matching", reminders: "Reminders", email: "Email log", integrations: "Integrations", roles: "Roles", audit: "Audit log" } as const;

const PERMS: [string, string, string, string, string][] = [
  ["Edit own profile, book and manage own sessions", "Yes", "Yes", "–", "–"],
  ["Choose or request a mentor", "Yes", "–", "On behalf", "On behalf"],
  ["Accept or decline requests", "–", "Yes", "–", "–"],
  ["See shared session notes", "Own pairs", "Own pairs", "Their tracks", "All"],
  ["See private mentor notes", "–", "Own only", "–", "Only with an open safety case"],
  ["See feedback", "Own", "Own", "Their tracks", "All"],
  ["Manage allow list, assign and change pairs", "–", "–", "Their tracks", "All"],
  ["Track settings", "–", "–", "Their tracks", "All"],
  ["Cohorts, program settings, modules, reminders", "–", "–", "–", "Yes"],
  ["Safety cases", "Report", "Report", "Report", "Manage"],
  ["Export data, audit log", "–", "–", "Their tracks (export)", "Yes"],
];

export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireAdmin();
  const sp = await searchParams;
  const tab = (sp.tab && sp.tab in TABS ? sp.tab : "general") as keyof typeof TABS;
  const s = await getSettings();
  return (
    <div>
      <PageHeader description="Nothing about how the program runs is hard-coded. Every change is recorded in the audit log." title="Settings" />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b">
        {Object.entries(TABS).map(([k, label]) => <Link className={cn("-mb-px shrink-0 border-b-2 px-3 py-2.5 text-sm transition-colors", k === tab ? "border-brand font-medium text-brand" : "border-transparent text-muted-foreground hover:text-foreground")} href={`/admin/settings?tab=${k}`} key={k}>{label}</Link>)}
      </div>

      {tab === "general" && (
        <ActionForm action={saveOrgSettings} className="space-y-6">
          <input name="labelMentor" type="hidden" value={s.labelMentor} /><input name="labelMentee" type="hidden" value={s.labelMentee} />
          <Panel action={<Submit>Save</Submit>} title="Organization">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Program name"><Input defaultValue={s.orgName} name="orgName" required /></Field>
              <Field hint="Shown next to the logo." label="Short name"><Input defaultValue={s.shortName} maxLength={8} name="shortName" required /></Field>
              <Field hint="Shown on Help and sign-in screens." label="Support email"><Input defaultValue={s.supportEmail} name="supportEmail" type="email" /></Field>
              <Field hint="Also emailed on every safety report." label="Safeguarding lead email"><Input defaultValue={s.safeguardingEmail} name="safeguardingEmail" type="email" /></Field>
              <Field hint="For newly added people; each person can change theirs." label="Default time zone"><NativeSelect defaultValue={s.defaultTimezone} name="defaultTimezone">{TIMEZONES.map((z) => <option key={z}>{z}</option>)}</NativeSelect></Field>
              <Field label="Tagline"><Input defaultValue={s.tagline} name="tagline" /></Field>
              <Field label="Society name"><Input defaultValue={s.society} name="society" /></Field>
              <Field hint="Shown under the society name." label="Affiliation"><Input defaultValue={s.parentOrg} name="parentOrg" /></Field>
              <Field label="Instagram handle"><Input defaultValue={s.instagram} name="instagram" /></Field>
              <Field label="LinkedIn handle"><Input defaultValue={s.linkedin} name="linkedin" /></Field>
            </div>
          </Panel>
          <Panel title="Program rules">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field hint="Earliest a session can be booked." label="Minimum notice (hours)"><Input defaultValue={s.minNoticeHours} min={0} name="minNoticeHours" type="number" /></Field>
              <Field label="Open requests per mentee"><Input defaultValue={s.maxOpenRequests} min={1} name="maxOpenRequests" type="number" /></Field>
              <Field label="Request expires after (days)"><Input defaultValue={s.requestExpiryDays} min={1} name="requestExpiryDays" type="number" /></Field>
              <Field label="Stay signed in (days)"><Input defaultValue={s.sessionDays} min={1} name="sessionDays" type="number" /></Field>
              <Field label="Admins stay signed in (days)"><Input defaultValue={s.adminSessionDays} min={1} name="adminSessionDays" type="number" /></Field>
              <Field hint="Shown in the privacy notice." label="Data retention (years)"><Input defaultValue={s.retentionYears} min={1} name="retentionYears" type="number" /></Field>
            </div>
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm has-checked:border-brand has-checked:bg-brand-soft">
              <input className="mt-0.5 size-4 accent-[var(--brand)]" defaultChecked={s.requireMentorApproval} name="requireMentorApproval" type="checkbox" />
              <span><span className="font-medium">Mentors need admin approval before they can be matched.</span> <span className="text-muted-foreground">Use this if you run reference or background checks. Approve mentors from their page in People.</span></span>
            </label>
          </Panel>
        </ActionForm>
      )}

      {tab === "modules" && (
        <div className="space-y-6">
          <ActionForm action={saveModules}>
            <Panel action={<Submit>Save modules</Submit>} bodyClassName="p-0" description="Switching a module off hides its screens and stops its reminders. Data is kept." title="Modules">
              <ul className="divide-y">
                {MODULE_INFO.map((m) => (
                  <li key={m.key}><label className="flex cursor-pointer items-center gap-4 px-5 py-4"><div className="flex-1"><div className="font-medium text-sm">{m.label}</div><div className="text-muted-foreground text-xs">{m.help}</div></div><input className="peer sr-only" defaultChecked={s.modules[m.key]} name={m.key} type="checkbox" /><span className="relative h-6 w-11 rounded-full bg-muted transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-brand peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-ring" /></label></li>
                ))}
                {PLANNED_MODULES.map((m) => <li className="flex items-center gap-4 px-5 py-4 opacity-60" key={m}><div className="flex-1 font-medium text-sm">{m}</div><Tag>Phase 2, not built yet</Tag></li>)}
              </ul>
            </Panel>
          </ActionForm>
          <ActionForm action={saveOrgSettings}>
            {(["orgName", "shortName", "tagline", "society", "parentOrg", "instagram", "linkedin", "supportEmail", "safeguardingEmail", "defaultTimezone", "minNoticeHours", "maxOpenRequests", "requestExpiryDays", "sessionDays", "adminSessionDays", "retentionYears"] as const).map((k) => <input key={k} name={k} type="hidden" value={String(s[k])} />)}
            {s.requireMentorApproval && <input name="requireMentorApproval" type="hidden" value="on" />}
            <Panel action={<Submit>Save labels</Submit>} description="Used in navigation and headings, for example call mentors Coaches." title="Words used in the app">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="What you call a mentor"><Input defaultValue={s.labelMentor} maxLength={20} name="labelMentor" /></Field>
                <Field label="What you call a mentee"><Input defaultValue={s.labelMentee} maxLength={20} name="labelMentee" /></Field>
              </div>
            </Panel>
          </ActionForm>
        </div>
      )}

      {tab === "matching" && (
        <ActionForm action={saveWeights}>
          <Panel action={<Submit>Save weights</Submit>} description="How the 0 to 100 suggestion score is built. Weights are relative; they do not need to add up to 100." title="Suggestion score weights">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {([["fit", "Interest and expertise fit"], ["availability", "Availability overlap"], ["language", "Language and time zone"], ["preference", "Same faculty"], ["capacity", "Capacity balance"]] as const).map(([k, label]) => <Field key={k} label={label}><Input defaultValue={s.weights[k]} max={100} min={0} name={k} type="number" /></Field>)}
            </div>
            <p className="mt-4 text-muted-foreground text-sm">Hard exclusions, mentor capacity and past pairings are rules, not weights: they always apply. Add exclusions from the Assignment page.</p>
          </Panel>
        </ActionForm>
      )}

      {tab === "reminders" && <Reminders enabled={s.modules.reminders} />}
      {tab === "email" && <EmailLog tz={user.timezone} />}

      {tab === "integrations" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title={<span className="flex items-center gap-2"><Mail className="size-4" /> Email delivery</span>}>
            <Status ok={mailConfigured()} off="Not connected. Emails, including sign-in codes, are written to the Email log only." on={mailProvider() === "sendbyte" ? `Sending through SendByte as ${process.env.MAIL_FROM ?? "the default address"}.` : `Sending through SMTP (${process.env.SMTP_HOST}) as ${process.env.MAIL_FROM ?? "the default address"}.`} />
            <p className="mt-3 text-muted-foreground text-sm">Set <code className="rounded bg-muted px-1">SENDBYTE_API_KEY</code> and <code className="rounded bg-muted px-1">MAIL_FROM</code> (an address on a domain verified in SendByte) in the server environment, then redeploy. SMTP (<code className="rounded bg-muted px-1">SMTP_HOST</code> and friends) is used only when no SendByte key is set.</p>
            <ActionButton action={sendTestEmail} className="mt-4" variant="outline">Send me a test email</ActionButton>
          </Panel>
          <Panel title={<span className="flex items-center gap-2"><Video className="size-4" /> Google Meet</span>}>
            <Status ok={meetConfigured()} off="Not connected. Sessions use each pair's fixed room or a pasted Meet link, and attendance comes from the Join button." on="Connected. A Meet space is created from the organizer account when a session is confirmed." />
            <p className="mt-3 text-muted-foreground text-sm">Create a Google Cloud project with the Meet REST API enabled, authorize the program's organizer account once, and set <code className="rounded bg-muted px-1">GOOGLE_CLIENT_ID</code>, <code className="rounded bg-muted px-1">GOOGLE_CLIENT_SECRET</code> and <code className="rounded bg-muted px-1">GOOGLE_REFRESH_TOKEN</code>. Reading participant join and leave times from Meet is not built yet; the README lists what remains.</p>
          </Panel>
          <Panel className="lg:col-span-2" description="Reminders run every minute inside the server. You can also trigger a run by hand." title="Reminder engine">
            <div className="flex flex-wrap items-center gap-3"><ActionButton action={runTickNow} variant="outline">Run reminders now</ActionButton><span className="text-muted-foreground text-sm">For an external scheduler, call <code className="rounded bg-muted px-1">/api/cron/tick?key=CRON_SECRET</code>.</span></div>
          </Panel>
        </div>
      )}

      {tab === "roles" && (
        <Panel bodyClassName="p-0" description="Change a person's role from their page in People. Track coordinators are scoped to the tracks they are set as coordinator of." title="Roles and what each can do">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground text-xs"><th className="px-5 py-3 font-medium">Capability</th><th className="px-3 py-3 font-medium">Mentee</th><th className="px-3 py-3 font-medium">Mentor</th><th className="px-3 py-3 font-medium">Track coordinator</th><th className="px-5 py-3 font-medium">Admin</th></tr></thead>
              <tbody className="divide-y">{PERMS.map((r) => <tr key={r[0]}>{r.map((c, i) => <td className={cn("px-3 py-3", i === 0 && "px-5 font-medium", i === 4 && "px-5", c === "–" && "text-muted-foreground")} key={i}>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className="border-t px-5 py-3 text-muted-foreground text-xs">Super admins can also grant the super admin role and change other super admins. These permissions are fixed in this release; an editable matrix is planned.</p>
        </Panel>
      )}

      {tab === "audit" && <Audit tz={user.timezone} />}
    </div>
  );
}

function Status({ ok, on, off }: { ok: boolean; on: string; off: string }) {
  return <div className={cn("flex items-start gap-2.5 rounded-xl border p-3 text-sm", ok ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10")}>{ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-amber-600" />}<span>{ok ? on : off}</span></div>;
}

async function Reminders({ enabled }: { enabled: boolean }) {
  await ensureRules();
  const rules = await db.reminderRule.findMany();
  const after = new Set(["invite_reminder", "profile_incomplete", "request_pending", "book_first_session", "no_show_check", "notes_due", "feedback_due"]);
  return (
    <div className="space-y-4">
      {!enabled && <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">The Reminders module is switched off, so none of these are being sent.</p>}
      <p className="text-muted-foreground text-sm">Timings use m, h or d, separated by commas (for example <code className="rounded bg-muted px-1">24h, 1h</code>). Templates accept {"{{firstName}}"}, {"{{partnerName}}"}, {"{{sessionTime}}"}, {"{{when}}"} and {"{{link}}"}. Every reminder is sent once per person.</p>
      {rules.map((r) => (
        <ActionForm action={saveRule.bind(null, r.key)} key={r.key}>
          <Panel action={<Submit size="sm" variant="secondary">Save</Submit>} description={`To: ${r.audience}`} title={r.label}>
            <div className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end">
              <Field label={after.has(r.key) ? "Send this long after the trigger" : "Send this long before the session"}><Input defaultValue={(JSON.parse(r.offsets) as number[]).map(fmtOffset).join(", ")} name="offsets" required /></Field>
              <label className="flex h-9 items-center gap-2 text-sm"><input className="size-4 accent-[var(--brand)]" defaultChecked={r.enabled} name="enabled" type="checkbox" /> On</label>
              <label className="flex h-9 items-center gap-2 text-sm"><input className="size-4 accent-[var(--brand)]" defaultChecked={r.email} name="email" type="checkbox" /> Also email</label>
            </div>
            {r.key !== "invite_reminder" && (
              <div className="mt-4 grid gap-4">
                <Field label="Subject"><Input defaultValue={r.subject} name="subject" required /></Field>
                <Field label="Message"><Textarea defaultValue={r.body} name="body" required rows={3} /></Field>
              </div>
            )}
          </Panel>
        </ActionForm>
      ))}
    </div>
  );
}

async function EmailLog({ tz }: { tz: string }) {
  const mails = await db.emailMessage.findMany({ where: { type: { not: "otp" } }, orderBy: { createdAt: "desc" }, take: 80 });
  return (
    <Panel bodyClassName="p-0" description="The last 80 messages. Sign-in codes are never shown here. Failed deliveries are retried three times." title="Email log">
      <ul className="divide-y">
        {mails.map((m) => (
          <li key={m.id}><details className="group px-5 py-3"><summary className="flex cursor-pointer list-none items-center gap-3 text-sm"><span className="min-w-0 flex-1 truncate"><span className="font-medium">{m.subject}</span> <span className="text-muted-foreground">to {m.to}</span></span><span className="hidden shrink-0 text-muted-foreground text-xs sm:block">{fmtDateTime(m.createdAt, tz)}</span><Chip status={m.status} /></summary><pre className="mt-3 whitespace-pre-wrap rounded-lg bg-muted/60 p-3 font-sans text-sm">{m.body}{m.error ? `\n\nError: ${m.error}` : ""}</pre></details></li>
        ))}
        {mails.length === 0 && <li className="px-5 py-8 text-center text-muted-foreground text-sm">No emails yet.</li>}
      </ul>
    </Panel>
  );
}

async function Audit({ tz }: { tz: string }) {
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 150 });
  return (
    <Panel bodyClassName="p-0" description="Append-only record of admin actions, data exports and key account events. Showing the last 150." title="Audit log">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground text-xs"><th className="px-5 py-3 font-medium">When</th><th className="px-3 py-3 font-medium">Who</th><th className="px-3 py-3 font-medium">Action</th><th className="px-3 py-3 font-medium">Target</th><th className="px-5 py-3 font-medium">Detail</th></tr></thead>
          <tbody className="divide-y">
            {logs.map((l) => <tr key={l.id}><td className="whitespace-nowrap px-5 py-2.5 text-muted-foreground">{fmtDateTime(l.createdAt, tz)}</td><td className="whitespace-nowrap px-3 py-2.5">{l.actorName}</td><td className="whitespace-nowrap px-3 py-2.5"><code className="rounded bg-muted px-1.5 py-0.5 text-xs">{l.action}</code></td><td className="max-w-56 truncate px-3 py-2.5">{l.target}</td><td className="max-w-72 truncate px-5 py-2.5 text-muted-foreground">{l.detail}</td></tr>)}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
