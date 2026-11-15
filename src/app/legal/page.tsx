import Link from "next/link";
import { Logo } from "@/components/app/logo";
import { TERMS_VERSION } from "@/lib/constants";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Terms, privacy and code of conduct" };
export const dynamic = "force-dynamic";

const H = ({ children }: { children: React.ReactNode }) => <h2 className="mt-10 mb-3 font-semibold text-xl">{children}</h2>;
const P = ({ children }: { children: React.ReactNode }) => <p className="mb-3 text-muted-foreground leading-relaxed">{children}</p>;

export default async function Legal() {
  const s = await getSettings();
  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/"><Logo name={s.shortName} /></Link>
      <h1 className="mt-8 font-semibold text-3xl">Terms, privacy and code of conduct</h1>
      <p className="mt-2 text-muted-foreground text-sm">Version {TERMS_VERSION}. This is a plain-language starting text. Have your institution's compliance office review it before launch.</p>
      <H>Terms of use</H>
      <P>{s.orgName} is an invite-only mentorship program. Your account is personal: do not share your sign-in codes. The program team may suspend or remove an account that breaks these terms or the code of conduct.</P>
      <P>Mentors are volunteers. Mentorship is guidance, not professional, medical, legal or financial advice.</P>
      <H>Code of conduct</H>
      <P>Treat each other with respect. Harassment, discrimination, bullying and any form of exploitation are never acceptable. Keep the relationship professional. Hold sessions through the meeting links the platform provides. Keep what your partner shares confidential, unless someone's safety is at risk.</P>
      <P>If something feels wrong, use Report a concern, which is on every screen. The safeguarding lead is alerted straight away, and you can choose to stay anonymous to the other person.</P>
      <H>Privacy notice</H>
      <P>We collect what the program needs to run: your name, email, profile, availability, sessions, shared notes, feedback, and attendance (when you join a session). Private mentor notes are visible only to their author, unless a safety case is open.</P>
      <P>Admins and track coordinators can see profiles, pairs, sessions, attendance and feedback within their scope. Your partner sees your profile, shared notes and your shared sessions. Feedback ratings are shown to the other person only in aggregate.</P>
      <P>Records are kept for {s.retentionYears} years after your last activity and then deleted or anonymised. You can ask for a copy of your data, a correction, or deletion of your account by writing to <a className="text-brand underline" href={`mailto:${s.supportEmail}`}>{s.supportEmail}</a>. We aim to answer within 30 days.</P>
    </div>
  );
}
