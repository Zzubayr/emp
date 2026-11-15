import { saveAvailability, pauseMentoring } from "@/actions/account";
import { ActionForm, Submit } from "@/components/app/action-form";
import { Field, PageHeader, Panel } from "@/components/app/bits";
import { AvailabilityEditor } from "@/components/app/inputs";
import { Input } from "@/components/ui/input";
import { requireReady } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { fmtDay } from "@/lib/time";

export const metadata = { title: "Availability" };

export default async function Availability() {
  const user = await requireReady();
  const s = await getSettings();
  const rules = await db.availabilityRule.findMany({ where: { userId: user.id }, select: { weekday: true, startMin: true, endMin: true }, orderBy: [{ weekday: "asc" }, { startMin: "asc" }] });
  const paused = user.pausedUntil && user.pausedUntil > new Date();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader description={`The windows when you are usually free, in your time zone (${user.timezone.replace("_", " ")}). Booking only offers times free for both people, with at least ${s.minNoticeHours} hours' notice and a 10 minute buffer around other sessions.`} title="Availability" />
      <ActionForm action={saveAvailability}>
        <Panel action={<Submit>Save</Submit>} title="Weekly hours">
          <AvailabilityEditor defaultValue={rules} name="availability" />
        </Panel>
      </ActionForm>
      {user.role === "MENTOR" && (
        <Panel className="mt-6" description="Stops new mentees being paired with you. Your current pairs are not affected." title="Pause or step back">
          <ActionForm action={pauseMentoring} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field className="flex-1" hint={paused ? `Paused until ${fmtDay(user.pausedUntil!, user.timezone, { year: true })}. Clear the date to resume.` : "Leave empty to stay open to new mentees."} label="Not taking new mentees until">
              <Input defaultValue={paused ? user.pausedUntil!.toISOString().slice(0, 10) : ""} name="until" type="date" />
            </Field>
            <Field className="flex-1" label="Reason (optional)"><Input name="reason" placeholder="Exams, travel, workload…" /></Field>
            <Submit variant="secondary">Update</Submit>
          </ActionForm>
        </Panel>
      )}
    </div>
  );
}
