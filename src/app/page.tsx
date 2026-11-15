import {
  ArrowRight, BellRing, CalendarCheck, ClipboardCheck, HeartHandshake, Layers, LineChart, Route, ShieldCheck, Sparkles, UsersRound, Video,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/app/logo";
import { ThemeToggle } from "@/components/app/theme-toggle";
import ShapeHero from "@/components/kokonutui/shape-hero";
import SlideTextButton from "@/components/kokonutui/slide-text-button";
import TypewriterTitle from "@/components/kokonutui/type-writer";
import { getUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

const FEATURES = [
  { icon: Layers, title: "Cohorts, start to finish", body: "Open a new intake in minutes: pick tracks, import the people you selected, send invites, and watch onboarding fill up." },
  { icon: Route, title: "Academic and non-academic tracks", body: "100 to 400 level alongside Tech, Design, Career and more. Each track has its own rules, mentors and reminders." },
  { icon: HeartHandshake, title: "Five ways to pair", body: "Assign by hand, confirm ranked suggestions, let students pick, request, or rank their top three. Set per track." },
  { icon: Video, title: "Sessions with Google Meet", body: "Only mutually free times are offered. A Meet link is attached on confirmation, with a manual fallback that never blocks a session." },
  { icon: BellRing, title: "Reminders that adapt", body: "Rules, not hand-written emails. Invites, session reminders, notes and feedback nudges go out on time, once." },
  { icon: ClipboardCheck, title: "Attendance you can trust", body: "Join logs become present, late or no-show by your track's rules, with audited overrides." },
  { icon: LineChart, title: "Pair health at a glance", body: "Every pair is scored daily as Healthy, Quiet or At risk, with a suggested next step for the coordinator." },
  { icon: ShieldCheck, title: "Safety built in", body: "Report a concern from any screen. Cases, auto-pause and an audit trail that cannot be edited." },
];

const STEPS = [
  { n: "01", title: "You are invited", body: "The program team adds the people it selected. No public sign-up, no passwords." },
  { n: "02", title: "Sign in with a code", body: "Enter your email, get a one-time code, finish a short profile." },
  { n: "03", title: "Meet your mentor", body: "Choose or be matched, depending on your track. Book a time that works for both." },
  { n: "04", title: "Grow together", body: "Meet, take notes, follow up on action items and tell us how it is going." },
];

export default async function Landing() {
  const user = await getUser();
  if (user) redirect("/home");
  const s = await getSettings();
  const pill = "flex items-center gap-2 px-5 h-12 text-sm font-medium text-white shadow-lg";
  return (
    <div className="relative overflow-x-clip">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-transparent bg-background/70 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo name={s.shortName} />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-4 font-medium text-background text-sm transition-[scale,opacity] hover:opacity-90 active:scale-[0.97]" href="/sign-in">
              Sign in <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </header>

      <div className="pointer-events-none absolute inset-x-0 top-0 h-[640px] grid-fade opacity-60" />
      <div className="-translate-x-1/2 pointer-events-none absolute top-[-180px] left-1/2 h-[480px] w-[820px] rounded-full bg-linear-to-r from-indigo-500/25 via-violet-500/25 to-fuchsia-500/20 blur-3xl" />

      <ShapeHero
        actions={
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <SlideTextButton className="h-12 rounded-xl bg-brand px-8 text-primary-foreground hover:bg-brand/90 dark:bg-brand dark:text-primary-foreground dark:hover:bg-brand/90" hoverText="Enter your email" href="/sign-in" text="Sign in to EMP" />
            <SlideTextButton className="h-12 rounded-xl" hoverText="See what is inside" href="#features" text="How it works" variant="ghost" />
          </div>
        }
        className="relative min-h-[92dvh] pt-16"
        description={
          <>
            {s.orgName} runs the whole mentorship program in one place, from invite to impact report, across academic and non-academic tracks.
          </>
        }
        eyebrow={
          <span className="inline-flex items-center gap-2 rounded-full border bg-card/80 px-3 py-1 text-muted-foreground text-xs shadow-xs backdrop-blur">
            <Sparkles className="size-3.5 text-brand" /> Invite-only · built for cohorts
          </span>
        }
        shapes={[
          { id: "a", content: <><UsersRound className="size-4" /> 1:1 mentorship</>, className: `${pill} bg-indigo-500` },
          { id: "b", content: <><CalendarCheck className="size-4" /> Book a session</>, className: `${pill} bg-violet-500` },
          { id: "c", content: <><Video className="size-4" /> Google Meet</>, className: `${pill} bg-sky-500` },
          { id: "d", content: <><BellRing className="size-4" /> Reminders</>, className: `${pill} bg-amber-500` },
          { id: "e", content: <><ShieldCheck className="size-4" /> Safe</>, className: `${pill} bg-emerald-500` },
          { id: "f", content: <HeartHandshake className="size-5" />, className: "flex items-center justify-center size-12 text-white bg-rose-500 shadow-lg" },
          { id: "g", content: <>100 – 400 level</>, className: `${pill} bg-fuchsia-500` },
          { id: "h", content: <>Tech · Design · Career</>, className: `${pill} bg-zinc-800 dark:bg-zinc-200 dark:text-zinc-900` },
          { id: "i", content: <LineChart className="size-5" />, className: "flex items-center justify-center size-12 text-white bg-teal-500 shadow-lg" },
        ]}
        title={
          <span className="block text-balance">
            One home for every{" "}
            <TypewriterTitle
              as="span"
              autoLoop
              className="inline-flex w-auto font-sans [container-type:normal]"
              sequences={[{ text: "mentor.", deleteAfter: true }, { text: "mentee.", deleteAfter: true }, { text: "cohort.", deleteAfter: true }]}
              textClassName="text-[1em]! leading-[1.15]! text-brand"
            />
          </span>
        }
      />

      <section className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6" id="features">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-medium text-brand text-sm">Everything the program needs</p>
          <h2 className="mt-2 font-semibold text-3xl sm:text-4xl">Less coordination. More mentoring.</h2>
          <p className="mt-3 text-muted-foreground">Admins see everything. Mentors and mentees only see what they need: who they are paired with, when they meet next, and what they are working on.</p>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div className="surface group p-5 transition-[translate,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-xl" key={f.title}>
              <span className="mb-4 flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand transition-transform duration-200 group-hover:scale-110">
                <f.icon className="size-5" />
              </span>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="font-semibold text-3xl">How it works</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((st) => (
              <div key={st.n}>
                <div className="font-mono text-brand text-sm">{st.n}</div>
                <h3 className="mt-2 font-semibold text-lg">{st.title}</h3>
                <p className="mt-1.5 text-muted-foreground text-sm leading-relaxed">{st.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-14 text-center text-white sm:px-12">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgb(255_255_255/0.18),transparent_50%)]" />
          <h2 className="relative font-semibold text-3xl sm:text-4xl">Already invited?</h2>
          <p className="relative mx-auto mt-3 max-w-md text-white/80">Use the email address your invitation was sent to. We will send you a one-time code.</p>
          <Link className="relative mt-7 inline-flex h-12 items-center gap-2 rounded-xl bg-white px-7 font-medium text-indigo-700 transition-[scale] hover:bg-white/90 active:scale-[0.97]" href="/sign-in">
            Sign in <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-8 text-muted-foreground text-sm sm:flex-row sm:px-6">
          <Logo name={s.shortName} />
          <div className="flex gap-5">
            <Link className="hover:text-foreground" href="/legal">Terms, privacy and code of conduct</Link>
            <a className="hover:text-foreground" href={`mailto:${s.supportEmail}`}>Contact the program</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
