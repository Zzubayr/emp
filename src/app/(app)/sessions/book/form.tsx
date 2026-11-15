"use client";

import { Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { bookSession } from "@/actions/sessions";
import { Field, NativeSelect } from "@/components/app/bits";
import SlotPicker, { type SlotDay } from "@/components/kokonutui/slot-picker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const TEMPLATES: Record<string, string> = {
  "": "",
  "First session": "1. Introductions: background, course, what we enjoy\n2. What each of us hopes to get from mentorship\n3. How often and when we will meet\n4. One thing to work on before next time",
  "Regular check-in": "1. What has happened since last time\n2. Action items: what got done, what got stuck\n3. Today's main topic\n4. Next steps",
  "Goal review": "1. Progress against goals\n2. What is working and what is not\n3. Adjust goals or milestones\n4. Next steps",
  "Wrap-up": "1. What we achieved together\n2. What I will keep doing\n3. Feedback for each other\n4. Staying in touch",
};

export function BookForm({ matchId, days, durations, host, timezone, replace, noRules }: { matchId: string; days: SlotDay[]; durations: number[]; host: { name: string; title: string; city: string; offset: number }; timezone: string; replace: { id: string; topic: string; agenda: string } | null; noRules: boolean }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const [agenda, setAgenda] = useState(replace?.agenda ?? "");
  const [attempt, setAttempt] = useState(0);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-3">
        {noRules && (
          <p className="flex items-start gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 p-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-sky-600" />
            <span>One of you has not set availability yet, so daytime hours are assumed. <Link className="font-medium underline" href="/availability">Set yours</Link> for better suggestions.</span>
          </p>
        )}
        <SlotPicker
          className="w-full max-w-none"
          days={days}
          durations={durations}
          host={host}
          key={attempt}
          onBook={async (slot) => {
            const r = await bookSession(matchId, slot, new FormData(form.current!));
            if (r.ok) {
              toast.success(r.message ?? "Session proposed");
              router.push(r.redirect ?? "/sessions");
              router.refresh();
            } else {
              toast.error(r.error);
              setAttempt((a) => a + 1);
              router.refresh();
            }
          }}
          timezone={timezone}
        />
      </div>
      <form className="surface h-fit space-y-4 p-5" onSubmit={(e) => e.preventDefault()} ref={form}>
        {replace && <input name="replace" type="hidden" value={replace.id} />}
        <Field hint="Optional" label="Topic"><Input defaultValue={replace?.topic} maxLength={120} name="topic" placeholder="For example: CV review" /></Field>
        <Field label="Agenda template">
          <NativeSelect onChange={(e) => setAgenda(TEMPLATES[e.target.value])}>{Object.keys(TEMPLATES).map((k) => <option key={k} value={k}>{k || "Blank"}</option>)}</NativeSelect>
        </Field>
        <Field hint="Both of you can edit this later." label="Agenda"><Textarea maxLength={1500} name="agenda" onChange={(e) => setAgenda(e.target.value)} rows={6} value={agenda} /></Field>
        {replace && <Field label="Reason for moving"><Input maxLength={200} name="reason" placeholder="Optional" /></Field>}
        <p className="text-muted-foreground text-xs">Choose a day and time on the left, then confirm. A Google Meet link is attached once the session is confirmed.</p>
      </form>
    </div>
  );
}
