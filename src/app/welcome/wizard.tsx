"use client";

import { ArrowLeft, ArrowRight, Check, Loader2, PartyPopper } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { acceptTerms, saveProfile } from "@/actions/account";
import { Field, NativeSelect } from "@/components/app/bits";
import { AvailabilityEditor, type Rule, TagPicker } from "@/components/app/inputs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { AVATAR_GRADIENTS, FACULTIES, INTEREST_TAGS, LANGUAGES, LEVELS, TIMEZONES } from "@/lib/constants";
import { cn } from "@/lib/utils";

type U = {
  name: string; email: string; role: string; timezone: string; level: string | null; faculty: string | null; phone: string | null;
  headline: string | null; bio: string | null; goalsText: string | null; linkedin: string | null; avatar: number; capacity: number;
  hoursPerMonth: number; termsAccepted: boolean; interests: string[]; expertise: string[]; languages: string[];
};

export function Wizard({ user, tracks, availability, orgName }: { user: U; tracks: { name: string; cohort: string; welcome: string | null }[]; availability: Rule[]; orgName: string }) {
  const router = useRouter();
  const mentor = user.role === "MENTOR";
  const mentee = user.role === "MENTEE";
  const steps = mentor || mentee ? ["Terms", "About you", mentor ? "How you can help" : "What you want", "Availability", "Finish"] : ["Terms", "About you", "Finish"];
  const [step, setStep] = useState(user.termsAccepted ? 1 : 0);
  const [agreed, setAgreed] = useState(false);
  const [avatar, setAvatar] = useState(user.avatar);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const browserTz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : user.timezone;
  const zones = [...new Set([browserTz, user.timezone, ...TIMEZONES])];
  const last = step === steps.length - 1;

  const save = (finish: boolean, next?: number) =>
    start(async () => {
      const fd = new FormData(form.current!);
      if (finish) fd.set("finish", "1");
      const r = await saveProfile(fd);
      if (!r.ok) return void toast.error(r.error);
      if (finish) {
        toast.success("You are all set. Welcome!");
        router.push("/home");
        router.refresh();
      } else if (next !== undefined) setStep(next);
    });

  const next = () => {
    if (step === 0) {
      return start(async () => {
        const r = await acceptTerms();
        if (!r.ok) return void toast.error(r.error);
        setStep(1);
      });
    }
    const f = form.current!;
    if (step === 1 && !f.reportValidity()) return;
    save(last, last ? undefined : step + 1);
  };

  const show = (name: string) => (steps[step] === name ? "block animate-fade-up" : "hidden");

  return (
    <div className="mt-8">
      <ol aria-label="Progress" className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => (
          <li className="flex flex-1 flex-col gap-1.5" key={s}>
            <span className={cn("h-1.5 rounded-full transition-colors duration-300", i <= step ? "bg-brand" : "bg-muted")} />
            <span className={cn("hidden text-xs sm:block", i === step ? "font-medium text-foreground" : "text-muted-foreground")}>{s}</span>
          </li>
        ))}
      </ol>

      <form className="surface p-5 sm:p-8" onSubmit={(e) => e.preventDefault()} ref={form}>
        <input name="avatar" type="hidden" value={avatar} />

        <div className={show("Terms")}>
          <h1 className="font-semibold text-2xl">Welcome to {orgName}</h1>
          <p className="mt-2 text-muted-foreground text-sm">
            {tracks.length ? <>You have been selected for <span className="font-medium text-foreground">{tracks.map((t) => t.name).join(" and ")}</span> ({tracks[0].cohort}). </> : null}
            Before we start, please read and accept how the program works.
          </p>
          <ul className="mt-5 space-y-3 text-sm">
            {[
              ["Respect and boundaries", "Treat each other with respect. Keep conversations professional and within the program's code of conduct."],
              ["Meet through the platform", "Sessions happen on Google Meet links from EMP, so there is a record that keeps everyone safe."],
              ["Attendance is recorded", "EMP records when you join a session. Admins and your track coordinator can see attendance; your partner sees only your shared pair."],
              ["Your data", "We collect only what the program needs, keep it for a limited period, and you can ask for a copy or deletion at any time."],
              ["Speak up", "If anything feels wrong, use Report a concern on any screen. The safeguarding lead is alerted immediately."],
            ].map(([t, b]) => (
              <li className="flex gap-3 rounded-xl border bg-card/60 p-3" key={t}>
                <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                <span><span className="font-medium">{t}.</span> <span className="text-muted-foreground">{b}</span></span>
              </li>
            ))}
          </ul>
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm has-checked:border-brand has-checked:bg-brand-soft">
            <input checked={agreed} className="mt-0.5 size-4 accent-[var(--brand)]" onChange={(e) => setAgreed(e.target.checked)} type="checkbox" />
            <span>I have read and accept the <Link className="font-medium text-brand underline" href="/legal" target="_blank">terms, privacy notice and code of conduct</Link>.</span>
          </label>
        </div>

        <div className={show("About you")}>
          <h1 className="font-semibold text-2xl">About you</h1>
          <p className="mt-1 text-muted-foreground text-sm">We filled in what we already know. Check it and add the rest.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Full name"><Input defaultValue={user.name} maxLength={80} minLength={2} name="name" required /></Field>
            <Field hint="Your sign-in. Ask an admin to change it." label="Email"><Input defaultValue={user.email} disabled /></Field>
            <Field hint="Session times are shown in this zone." label="Time zone">
              <NativeSelect defaultValue={zones.includes(browserTz) ? browserTz : user.timezone} name="timezone">{zones.map((z) => <option key={z}>{z}</option>)}</NativeSelect>
            </Field>
            <Field hint="Optional" label="Phone"><Input defaultValue={user.phone ?? ""} name="phone" type="tel" /></Field>
            {(mentee || mentor) && (
              <>
                <Field label={mentor ? "Level reached" : "Level"}>
                  <NativeSelect defaultValue={user.level ?? ""} name="level"><option value="">Choose…</option>{LEVELS.map((l) => <option key={l}>{l}</option>)}</NativeSelect>
                </Field>
                <Field label="Faculty">
                  <NativeSelect defaultValue={user.faculty ?? ""} name="faculty"><option value="">Choose…</option>{FACULTIES.map((l) => <option key={l}>{l}</option>)}</NativeSelect>
                </Field>
              </>
            )}
          </div>
          <div className="mt-5">
            <div className="mb-2 font-medium text-sm">Pick a colour for your avatar</div>
            <div className="flex flex-wrap gap-2">
              {AVATAR_GRADIENTS.map((g, i) => (
                <button aria-label={`Avatar colour ${i + 1}`} aria-pressed={avatar === i} className={cn("size-10 rounded-full bg-linear-to-br ring-offset-2 ring-offset-background transition-[scale,box-shadow] hover:scale-110", g, avatar === i && "ring-2 ring-brand")} key={g} onClick={() => setAvatar(i)} type="button" />
              ))}
            </div>
          </div>
          <div className="mt-5">
            <div className="mb-2 font-medium text-sm">Languages you are comfortable in</div>
            <TagPicker defaultValue={user.languages} max={5} name="languages" options={LANGUAGES} />
          </div>
        </div>

        {mentee && (
          <div className={show("What you want")}>
            <h1 className="font-semibold text-2xl">What would you like help with?</h1>
            <p className="mt-1 text-muted-foreground text-sm">Pick up to 6. We use this to find you the right mentor.</p>
            <div className="mt-5"><TagPicker defaultValue={user.interests} max={6} name="interests" options={INTEREST_TAGS} /></div>
            <Field className="mt-5" hint="A sentence or two is plenty. Your mentor will see this." label="What do you hope to get out of mentorship?">
              <Textarea defaultValue={user.goalsText ?? ""} maxLength={1200} name="goalsText" rows={4} />
            </Field>
          </div>
        )}

        {mentor && (
          <div className={show("How you can help")}>
            <h1 className="font-semibold text-2xl">How can you help?</h1>
            <p className="mt-1 text-muted-foreground text-sm">Pick up to 8 areas. Students see these on your card.</p>
            <div className="mt-5"><TagPicker defaultValue={user.expertise} max={8} name="expertise" options={INTEREST_TAGS} /></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field className="sm:col-span-2" hint="Shown under your name, for example: Software engineer at Paystack" label="Headline"><Input defaultValue={user.headline ?? ""} maxLength={120} name="headline" /></Field>
              <Field className="sm:col-span-2" label="Short bio"><Textarea defaultValue={user.bio ?? ""} maxLength={1200} name="bio" rows={4} /></Field>
              <Field hint="You can change this any time." label="How many mentees can you take?"><Input defaultValue={user.capacity} max={10} min={0} name="capacity" type="number" /></Field>
              <Field label="Hours you can give per month"><Input defaultValue={user.hoursPerMonth} max={40} min={1} name="hoursPerMonth" type="number" /></Field>
              <Field className="sm:col-span-2" hint="Optional" label="LinkedIn"><Input defaultValue={user.linkedin ?? ""} name="linkedin" placeholder="https://linkedin.com/in/…" type="url" /></Field>
            </div>
          </div>
        )}

        {(mentee || mentor) && (
          <div className={show("Availability")}>
            <h1 className="font-semibold text-2xl">When are you usually free?</h1>
            <p className="mt-1 text-muted-foreground text-sm">Add the windows that usually work. Booking only offers times that are free for both of you. You can change this later.</p>
            <div className="mt-5"><AvailabilityEditor defaultValue={availability} name="availability" /></div>
          </div>
        )}

        <div className={show("Finish")}>
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand"><PartyPopper className="size-6" /></div>
          <h1 className="mt-4 font-semibold text-2xl">You are ready</h1>
          <p className="mt-1 text-muted-foreground text-sm">
            {mentee ? "Next you will meet your mentor. Depending on your track, you choose one or we match you." : mentor ? "Once you finish, students in your track can be paired with you." : "Your console is ready."}
          </p>
          {tracks.filter((t) => t.welcome).map((t) => (
            <div className="mt-4 rounded-xl border bg-brand-soft/50 p-4 text-sm" key={t.name}><div className="mb-1 font-medium">{t.name}</div><p className="text-muted-foreground">{t.welcome}</p></div>
          ))}
          {mentor && (
            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm has-checked:border-brand has-checked:bg-brand-soft">
              <input className="mt-0.5 size-4 accent-[var(--brand)]" name="agreement" type="checkbox" />
              <span><span className="font-medium">Mentor agreement.</span> I will keep sessions on the platform, respect boundaries and confidentiality, show up on time, and report any concern about a mentee's safety.</span>
            </label>
          )}
        </div>

        <div className="mt-8 flex items-center justify-between">
          <Button className={cn(step <= 1 && "invisible")} disabled={pending} onClick={() => setStep(step - 1)} type="button" variant="ghost">
            <ArrowLeft className="size-4" /> Back
          </Button>
          <Button className="h-11 min-w-36" disabled={pending || (step === 0 && !agreed)} onClick={next} type="button">
            {pending && <Loader2 className="size-4 animate-spin" />}
            {last ? "Finish" : step === 0 ? "Accept and continue" : "Continue"}
            {!(last || pending) && <ArrowRight className="size-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}
