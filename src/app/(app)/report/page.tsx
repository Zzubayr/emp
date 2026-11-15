import { ShieldAlert } from "lucide-react";
import { reportConcern } from "@/actions/safety";
import { ActionForm, Submit } from "@/components/app/action-form";
import { Empty, Field, NativeSelect, PageHeader, Panel } from "@/components/app/bits";
import { Textarea } from "@/components/ui/textarea";
import { requireReady } from "@/lib/auth";
import { CONCERN_CATEGORIES } from "@/lib/constants";
import { myPairs } from "@/lib/queries";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Report a concern" };

export default async function Report({ searchParams }: { searchParams: Promise<{ pair?: string }> }) {
  const user = await requireReady();
  const s = await getSettings();
  const { pair } = await searchParams;
  const pairs = await myPairs(user.id, ["ACTIVE", "PAUSED", "ENDED"]);
  if (!s.modules.safety) return <Panel><Empty description={`Please contact the program team directly at ${s.supportEmail}.`} icon={ShieldAlert} title="Reporting is switched off" /></Panel>;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader description="If something does not feel right, tell us. Reports go straight to the safeguarding lead, not to your mentor or mentee." title="Report a concern" />
      <div className="mb-6 flex items-start gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-rose-500" />
        <span>If you or someone else is in immediate danger, contact campus security or emergency services first.</span>
      </div>
      <Panel>
        <ActionForm action={reportConcern} className="space-y-5">
          <Field label="What is this about?">
            <NativeSelect name="category" required><option value="">Choose a category…</option>{CONCERN_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</NativeSelect>
          </Field>
          {pairs.length > 0 && (
            <Field hint="Serious reports pause the pairing automatically while it is reviewed." label="Is it about one of your pairings?">
              <NativeSelect defaultValue={pair ?? ""} name="matchId">
                <option value="">No, or I would rather not say</option>
                {pairs.map((p) => <option key={p.id} value={p.id}>{(p.menteeId === user.id ? p.mentor : p.mentee).name} ({p.track.name})</option>)}
              </NativeSelect>
            </Field>
          )}
          <Field hint="Say what happened, when, and anything that would help us understand." label="What happened?">
            <Textarea maxLength={4000} minLength={10} name="details" required rows={7} />
          </Field>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm has-checked:border-brand has-checked:bg-brand-soft">
            <input className="mt-0.5 size-4 accent-[var(--brand)]" name="anonymous" type="checkbox" />
            <span><span className="font-medium">Keep my name from the other person.</span> <span className="text-muted-foreground">The safeguarding lead will always know who reported, so they can follow up with you.</span></span>
          </label>
          <Submit className="w-full sm:w-auto">Send report</Submit>
        </ActionForm>
      </Panel>
    </div>
  );
}
