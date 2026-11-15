import { LifeBuoy, Mail, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { PageHeader, Panel } from "@/components/app/bits";
import { requireReady } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Help" };

const FAQ: [string, string][] = [
  ["How do I get a mentor?", "It depends on your track. Some tracks match you based on your profile; in others you pick, request or rank mentors yourself. Open My mentor to see what applies to you."],
  ["How do I book a session?", "Open your pair space and choose Book a session. You only see times that are free for both of you. Your partner confirms, and the session appears on your home page."],
  ["Where is the meeting link?", "On the session page. The Join button goes live 10 minutes before the start. If no link has been added, either of you can paste a Google Meet link there."],
  ["Why should I use the Join button?", "Clicking Join is how your attendance is recorded. Joining another way works, but the session will need to be marked by hand."],
  ["I need to move or cancel a session", "Open the session and choose Reschedule or Cancel. Cancelling close to the start time counts as a late cancellation, so reschedule when you can."],
  ["Who can see my notes?", "Shared notes are visible to you and your partner. A mentor's private notes are visible only to that mentor."],
  ["Who sees my feedback?", "The program team sees it in full. Your partner only ever sees averages, never your individual ratings."],
  ["My times look wrong", "Check your time zone in Profile and account. All times are shown in your own time zone."],
  ["I did not get my sign-in code", "Codes go to the email on the allow list and expire after 10 minutes. Check spam, wait a minute and ask for a new one."],
];

export default async function Help() {
  await requireReady();
  const s = await getSettings();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader description="Quick answers to the common questions." title="Help" />
      <Panel bodyClassName="p-0">
        <div className="divide-y">
          {FAQ.map(([q, a]) => (
            <details className="group px-5 py-4" key={q}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-medium text-sm">{q}<span className="text-muted-foreground transition-transform group-open:rotate-45">+</span></summary>
              <p className="mt-2 text-muted-foreground text-sm leading-relaxed">{a}</p>
            </details>
          ))}
        </div>
      </Panel>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <a className="surface flex items-start gap-3 p-5 transition-[translate] hover:-translate-y-0.5" href={`mailto:${s.supportEmail}`}>
          <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand"><Mail className="size-5" /></span>
          <span><span className="block font-medium">Contact the program team</span><span className="text-muted-foreground text-sm">{s.supportEmail}. We reply within 2 working days.</span></span>
        </a>
        <Link className="surface flex items-start gap-3 p-5 transition-[translate] hover:-translate-y-0.5" href="/report">
          <span className="flex size-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500"><ShieldAlert className="size-5" /></span>
          <span><span className="block font-medium">Report a concern</span><span className="text-muted-foreground text-sm">Goes straight to the safeguarding lead.</span></span>
        </Link>
      </div>
      <p className="mt-6 flex items-center justify-center gap-1.5 text-muted-foreground text-xs"><LifeBuoy className="size-3.5" /> In an emergency, contact campus security or local emergency services first.</p>
    </div>
  );
}
