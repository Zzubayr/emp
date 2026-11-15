import { redirect } from "next/navigation";
import { Logo } from "@/components/app/logo";
import { requireUser } from "@/lib/auth";
import { parseList } from "@/lib/constants";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Wizard } from "./wizard";

export const metadata = { title: "Welcome" };

export default async function Welcome() {
  const user = await requireUser();
  if (user.onboardedAt) redirect("/home");
  const s = await getSettings();
  const [memberships, availability] = await Promise.all([
    db.membership.findMany({ where: { userId: user.id, status: "ACTIVE", cohort: { status: { in: ["ONBOARDING", "ACTIVE"] } } }, include: { track: true, cohort: true } }),
    db.availabilityRule.findMany({ where: { userId: user.id }, select: { weekday: true, startMin: true, endMin: true } }),
  ]);
  return (
    <div className="relative min-h-dvh">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-80 grid-fade opacity-60" />
      <div className="relative mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <Logo name={s.shortName} />
        <Wizard
          availability={availability}
          orgName={s.orgName}
          tracks={memberships.map((m) => ({ name: m.track.name, cohort: m.cohort.name, welcome: m.track.welcomeMessage }))}
          user={{
            name: user.name, email: user.email, role: user.role, timezone: user.timezone, level: user.level, faculty: user.faculty,
            phone: user.phone, headline: user.headline, bio: user.bio, goalsText: user.goalsText, linkedin: user.linkedin, avatar: user.avatar,
            capacity: user.capacity, hoursPerMonth: user.hoursPerMonth, termsAccepted: Boolean(user.termsAcceptedAt),
            interests: parseList(user.interests), expertise: parseList(user.expertise), languages: parseList(user.languages),
          }}
        />
      </div>
    </div>
  );
}
