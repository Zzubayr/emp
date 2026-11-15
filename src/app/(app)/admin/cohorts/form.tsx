"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { createCohort, updateCohort } from "@/actions/admin";
import { ActionForm, Submit } from "@/components/app/action-form";
import { Field, NativeSelect, Panel } from "@/components/app/bits";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ASSIGNMENT_MODES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type T = { id: string; name: string; area: string; mode: string };

export function CohortForm({ tracks, cohorts, cohort }: { tracks: T[]; cohorts: { id: string; name: string; mentors: number }[]; cohort?: { id: string; name: string; description: string | null; startDate: string; endDate: string; trackIds: string[] } }) {
  const [sel, setSel] = useState<string[]>(cohort?.trackIds ?? tracks.map((t) => t.id));
  const toggle = (id: string) => setSel(sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]);
  return (
    <ActionForm action={cohort ? updateCohort.bind(null, cohort.id) : createCohort} className="space-y-6">
      <input name="trackIds" type="hidden" value={JSON.stringify(sel)} />
      <Panel description="Shown to admins, and in invite emails" title="1. Name and dates">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field className="sm:col-span-2" label="Cohort name"><Input defaultValue={cohort?.name} minLength={3} name="name" placeholder="2027/28 Session" required /></Field>
          <Field label="Starts"><Input defaultValue={cohort?.startDate} name="startDate" required type="date" /></Field>
          <Field label="Ends"><Input defaultValue={cohort?.endDate} name="endDate" required type="date" /></Field>
          <Field className="sm:col-span-2" hint="Optional" label="Description"><Textarea defaultValue={cohort?.description ?? ""} name="description" rows={2} /></Field>
        </div>
      </Panel>
      <Panel
        action={<button className="text-brand text-sm hover:underline" onClick={() => setSel(sel.length === tracks.length ? [] : tracks.map((t) => t.id))} type="button">{sel.length === tracks.length ? "Clear all" : "Select all"}</button>}
        description="Tracks are shared across cohorts; their rules can be changed any time in Tracks"
        title="2. Tracks in this cohort"
      >
        {(["ACADEMIC", "NON_ACADEMIC"] as const).map((area) => (
          <div className="mb-4 last:mb-0" key={area}>
            <div className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">{area === "ACADEMIC" ? "Academic" : "Non-academic"}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {tracks.filter((t) => t.area === area).map((t) => {
                const on = sel.includes(t.id);
                return (
                  <button aria-pressed={on} className={cn("flex items-center gap-3 rounded-xl border p-3 text-left transition-colors", on ? "border-brand bg-brand-soft" : "hover:bg-accent/50")} key={t.id} onClick={() => toggle(t.id)} type="button">
                    <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-md border", on && "border-brand bg-brand text-primary-foreground")}>{on && <Check className="size-3.5" />}</span>
                    <span className="min-w-0"><span className="block truncate font-medium text-sm">{t.name}</span><span className="block truncate text-muted-foreground text-xs">{ASSIGNMENT_MODES[t.mode]?.label}</span></span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {tracks.length === 0 && <p className="text-muted-foreground text-sm">No tracks exist yet. Create tracks first, then come back.</p>}
      </Panel>
      {!cohort && (
        <Panel description="Returning mentors keep their profile and history and do not need a new invite" title="3. Carry over mentors">
          <Field hint="Mentors are added to the same tracks they were in, where those tracks are part of this cohort." label="Copy mentors from">
            <NativeSelect name="carryFrom"><option value="">Do not carry anyone over</option>{cohorts.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.mentors} mentor places)</option>)}</NativeSelect>
          </Field>
        </Panel>
      )}
      <div className="flex justify-end"><Submit className="h-11 min-w-40">{cohort ? "Save cohort" : "Create cohort"}</Submit></div>
    </ActionForm>
  );
}
