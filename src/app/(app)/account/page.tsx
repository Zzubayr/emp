import { signOutAction } from "@/actions/auth";
import { saveProfile } from "@/actions/account";
import { ActionForm, Submit } from "@/components/app/action-form";
import { Field, NativeSelect, PageHeader, Panel, Tag, UserAvatar } from "@/components/app/bits";
import { TagPicker } from "@/components/app/inputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requireReady } from "@/lib/auth";
import { AVATAR_GRADIENTS, FACULTIES, INTEREST_TAGS, LANGUAGES, LEVELS, parseList, ROLE_LABEL, TIMEZONES } from "@/lib/constants";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Profile and account" };

export default async function Account() {
  const user = await requireReady();
  const s = await getSettings();
  const mentor = user.role === "MENTOR", mentee = user.role === "MENTEE";
  const memberships = await db.membership.findMany({ where: { userId: user.id }, include: { track: true, cohort: true }, orderBy: { createdAt: "desc" } });
  const zones = [...new Set([user.timezone, ...TIMEZONES])];
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader description="This is what your partner and the program team see." title="Profile and account" />
      <ActionForm action={saveProfile} className="space-y-6">
        <Panel action={<Submit>Save changes</Submit>} title="About you">
          <div className="mb-5 flex items-center gap-4">
            <UserAvatar size="xl" user={user} />
            <div><div className="font-semibold text-lg">{user.name}</div><div className="text-muted-foreground text-sm">{user.email}</div><div className="mt-1 flex flex-wrap gap-1.5"><Tag>{ROLE_LABEL[user.role]}</Tag>{memberships.filter((m) => m.cohort.status !== "COMPLETED").map((m) => <Tag key={m.id}>{m.track.name}</Tag>)}</div></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name"><Input defaultValue={user.name} minLength={2} name="name" required /></Field>
            <Field hint="To change your email, contact the program team." label="Email"><Input defaultValue={user.email} disabled /></Field>
            <Field label="Time zone"><NativeSelect defaultValue={user.timezone} name="timezone">{zones.map((z) => <option key={z}>{z}</option>)}</NativeSelect></Field>
            <Field label="Phone"><Input defaultValue={user.phone ?? ""} name="phone" type="tel" /></Field>
            {(mentor || mentee) && (
              <>
                <Field label="Level"><NativeSelect defaultValue={user.level ?? ""} name="level"><option value="">Choose…</option>{LEVELS.map((l) => <option key={l}>{l}</option>)}</NativeSelect></Field>
                <Field label="Faculty"><NativeSelect defaultValue={user.faculty ?? ""} name="faculty"><option value="">Choose…</option>{FACULTIES.map((l) => <option key={l}>{l}</option>)}</NativeSelect></Field>
              </>
            )}
            <Field label="Avatar colour">
              <NativeSelect defaultValue={user.avatar} name="avatar">{AVATAR_GRADIENTS.map((_, i) => <option key={i} value={i}>{["Indigo", "Sky", "Emerald", "Amber", "Rose", "Fuchsia", "Cyan", "Lime"][i]}</option>)}</NativeSelect>
            </Field>
          </div>
          <div className="mt-5"><div className="mb-2 font-medium text-sm">Languages</div><TagPicker defaultValue={parseList(user.languages)} max={5} name="languages" options={LANGUAGES} /></div>
        </Panel>
        {mentee && (
          <Panel title="What you want help with">
            <TagPicker defaultValue={parseList(user.interests)} max={6} name="interests" options={INTEREST_TAGS} />
            <Field className="mt-5" label="What do you hope to get out of mentorship?"><Textarea defaultValue={user.goalsText ?? ""} maxLength={1200} name="goalsText" rows={4} /></Field>
          </Panel>
        )}
        {mentor && (
          <Panel title="How you can help">
            <TagPicker defaultValue={parseList(user.expertise)} max={8} name="expertise" options={INTEREST_TAGS} />
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field className="sm:col-span-2" label="Headline"><Input defaultValue={user.headline ?? ""} maxLength={120} name="headline" /></Field>
              <Field className="sm:col-span-2" label="Short bio"><Textarea defaultValue={user.bio ?? ""} maxLength={1200} name="bio" rows={4} /></Field>
              <Field hint="Set to 0 to stop new pairings." label="Mentee capacity"><Input defaultValue={user.capacity} max={10} min={0} name="capacity" type="number" /></Field>
              <Field label="Hours per month"><Input defaultValue={user.hoursPerMonth} max={40} min={1} name="hoursPerMonth" type="number" /></Field>
              <Field className="sm:col-span-2" label="LinkedIn"><Input defaultValue={user.linkedin ?? ""} name="linkedin" placeholder="https://linkedin.com/in/…" type="url" /></Field>
            </div>
          </Panel>
        )}
      </ActionForm>
      <Panel className="mt-6" description={`Records are kept for ${s.retentionYears} years after your last activity.`} title="Your data and session">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-md text-muted-foreground text-sm">To download your data, correct it, or delete your account, write to <a className="text-brand underline" href={`mailto:${s.supportEmail}?subject=Data request`}>{s.supportEmail}</a>. We answer within 30 days.</p>
          <form action={signOutAction}><Button type="submit" variant="outline">Sign out</Button></form>
        </div>
      </Panel>
    </div>
  );
}
