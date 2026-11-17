import { ArrowRight, BellRing, CalendarCheck, ClipboardCheck, HeartHandshake, LineChart, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DotList, InfoBox, Presents, SocialBar, TitleBox } from "@/components/app/brand";
import { Crest, Logo } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: HeartHandshake, title: "A mentor who has been there", body: "Senior students, alumni and professionals who passed the same level or work in the field you are curious about." },
  { icon: CalendarCheck, title: "Sessions that fit your week", body: "Only times that suit both of you are offered. Confirm in one tap; the meeting link is on the session page." },
  { icon: BellRing, title: "Reminders you will not miss", body: "A day before and an hour before, with the link. Nothing to remember, nothing to chase." },
  { icon: ClipboardCheck, title: "Notes and next steps", body: "Shared notes and action items after every session, so each meeting builds on the last." },
  { icon: LineChart, title: "Progress you can see", body: "Coordinators see which pairs are thriving and which need a nudge, before anyone drifts away." },
  { icon: ShieldCheck, title: "Safe by design", body: "Report a concern from any screen. It goes straight to the safeguarding lead, and you can stay anonymous to the other person." },
];

const STEPS = [
  ["You are selected", "The programme team adds the people chosen from the application form. There is no public sign-up."],
  ["Sign in with a code", "Enter your email, receive a six-digit code, and finish a short profile."],
  ["Meet your mentor", "Choose or be matched, depending on your track, then book a time that works for both of you."],
  ["Grow together", "Meet regularly, keep notes, follow up on action items, and tell us how it is going."],
];

export default async function Landing() {
  const user = await getUser();
  if (user) redirect("/home");
  const s = await getSettings();
  const [cohort, tracks] = await Promise.all([
    db.cohort.findFirst({ where: { status: { in: ["ACTIVE", "ONBOARDING"] } }, orderBy: { startDate: "desc" } }),
    db.track.findMany({ where: { status: "OPEN" }, orderBy: [{ area: "asc" }, { name: "asc" }], select: { name: true, area: true, description: true } }),
  ]);
  const academic = tracks.filter((t) => t.area === "ACADEMIC");
  const other = tracks.filter((t) => t.area !== "ACADEMIC");

  return (
    <div className="bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/"><Logo name={s.shortName} /></Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 font-semibold text-primary-foreground text-sm transition-[opacity,scale] hover:opacity-90 active:scale-[0.97]" href="/sign-in">
              Sign in <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      {/* Hero, composed like the society's flyers */}
      <section className="mx-auto flex max-w-4xl flex-col items-center px-4 pt-14 pb-20 text-center sm:pt-20">
        <Crest className="animate-fade-up" size={84} />
        <h1 className="mt-5 animate-fade-up font-semibold text-[17px] text-navy uppercase tracking-tight sm:text-[22px] dark:text-white">{s.society}</h1>
        {s.parentOrg && <p className="animate-fade-up text-[15px] text-navy/80 sm:text-base dark:text-white/70">{s.parentOrg}</p>}
        <Presents className="mt-8 animate-fade-up" />
        <TitleBox className="mt-5 animate-fade-up px-5 py-2 text-[22px] sm:px-6 sm:text-[38px]">Mentorship Programme</TitleBox>
        <p className="mt-5 max-w-xl animate-fade-up font-light text-[19px] text-foreground/90 leading-snug sm:text-[22px]">{s.tagline}</p>
        <InfoBox className="mt-8 animate-fade-up text-lg sm:text-[22px]">{cohort ? `${cohort.name} · Invite only` : "Invite only"}</InfoBox>
        <DotList className="mt-6 animate-fade-up" items={["1:1 mentorship", "Academic tracks", "Career and skills", "Google Meet sessions"]} />
        <div className="mt-10 flex w-full animate-fade-up flex-col items-center justify-center gap-3 sm:flex-row">
          <Link className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-7 font-semibold text-primary-foreground transition-[opacity,scale] hover:opacity-90 active:scale-[0.97] sm:w-auto" href="/sign-in">
            Sign in to the programme <ArrowRight className="size-4" />
          </Link>
          <a className="inline-flex h-12 w-full items-center justify-center rounded-md border border-navy/25 px-7 font-semibold text-navy transition-colors hover:bg-navy/5 sm:w-auto dark:border-white/25 dark:text-white dark:hover:bg-white/5" href="#how-it-works">How it works</a>
        </div>
      </section>

      {/* Tracks */}
      {tracks.length > 0 && (
        <section className="border-y bg-card">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
            <SectionTitle eyebrow="Tracks" title="Find the right guide for where you are" />
            <div className="mt-10 grid gap-10 md:grid-cols-[1fr_2fr]">
              <div>
                <h3 className="mb-4 font-semibold text-muted-foreground text-sm uppercase tracking-[0.14em]">Academic</h3>
                <ul className="space-y-2.5">
                  {academic.map((t) => <li className="flex items-center gap-3 border-l-[3px] border-cyan bg-background px-4 py-3 font-semibold" key={t.name}>{t.name}</li>)}
                </ul>
              </div>
              <div>
                <h3 className="mb-4 font-semibold text-muted-foreground text-sm uppercase tracking-[0.14em]">Beyond the classroom</h3>
                <ul className="grid gap-2.5 sm:grid-cols-2">
                  {other.map((t) => (
                    <li className="border bg-background px-4 py-3" key={t.name}>
                      <div className="flex items-center gap-2 font-semibold"><span className="cyan-dot" />{t.name}</div>
                      {t.description && <p className="mt-1 pl-[18px] text-muted-foreground text-sm leading-snug">{t.description}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* What you get */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionTitle eyebrow="What you get" title="Less coordination. More mentoring." />
        <div className="mt-10 grid gap-px overflow-hidden border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div className="bg-card p-6" key={f.title}>
              <f.icon className="size-5 text-navy dark:text-cyan" />
              <h3 className="mt-4 font-semibold text-[17px]">{f.title}</h3>
              <p className="mt-1.5 text-muted-foreground text-[15px] leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="scroll-mt-16 bg-navy text-white" id="how-it-works">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="flex items-center gap-3 font-semibold text-[11px] text-cyan uppercase tracking-[0.16em]"><span className="h-0.5 w-6 bg-cyan" />How it works</div>
          <h2 className="mt-3 max-w-xl font-bold text-3xl tracking-tight sm:text-4xl">From invitation to your first session</h2>
          <ol className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(([title, body], i) => (
              <li className="border-cyan border-t-[3px] pt-5" key={title}>
                <div className="font-bold text-cyan text-sm">0{i + 1}</div>
                <h3 className="mt-2 font-semibold text-lg">{title}</h3>
                <p className="mt-1.5 text-[15px] text-white/70 leading-relaxed">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Call to action */}
      <section className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center">
        <Presents>Already selected?</Presents>
        <p className="mt-5 max-w-md text-lg text-muted-foreground">Use the email address your invitation was sent to. We will send you a one-time code.</p>
        <Link className="mt-8 inline-flex h-12 items-center gap-2 rounded-md bg-primary px-8 font-semibold text-primary-foreground transition-[opacity,scale] hover:opacity-90 active:scale-[0.97]" href="/sign-in">
          Sign in <ArrowRight className="size-4" />
        </Link>
        <p className="mt-6 text-muted-foreground text-sm">Not on the list? <a className="font-semibold text-foreground underline underline-offset-4" href={`mailto:${s.supportEmail}`}>Contact the programme team</a></p>
      </section>

      <footer>
        <SocialBar email={s.supportEmail} instagram={s.instagram} linkedin={s.linkedin}>
          <Link className="text-sm text-white/70 hover:text-white" href="/legal">Terms, privacy and code of conduct</Link>
        </SocialBar>
      </footer>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div>
      <div className="flex items-center gap-3 font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.16em]"><span className="h-0.5 w-6 bg-cyan" />{eyebrow}</div>
      <h2 className="mt-3 max-w-2xl font-bold text-3xl tracking-tight sm:text-4xl">{title}</h2>
    </div>
  );
}
