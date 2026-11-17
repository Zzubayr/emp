import Link from "next/link";
import { redirect } from "next/navigation";
import { Crest, Logo } from "@/components/app/logo";
import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { SignInForm } from "./form";

export const metadata = { title: "Sign in" };

export default async function SignIn({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  if (await getUser()) redirect("/home");
  const s = await getSettings();
  const { email } = await searchParams;
  const dev = process.env.SHOW_DEV_CODES === "true";
  const demo = dev
    ? await db.user.findMany({ where: { email: { endsWith: "@emp.local" } }, select: { email: true, name: true, role: true }, orderBy: { createdAt: "asc" }, take: 6 })
    : [];
  return (
    <div className="relative grid min-h-dvh lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-navy p-12 text-white lg:flex">
        <Link href="/"><Logo inverse name={s.shortName} /></Link>
        <div>
          <Crest inverse size={72} />
          <p className="mt-6 font-semibold text-lg uppercase tracking-tight">{s.society}</p>
          {s.parentOrg && <p className="text-white/70">{s.parentOrg}</p>}
          <p className="mt-8 font-script text-4xl text-white">Presents</p>
          <span className="brand-tag mt-3 px-5 py-2 text-[28px]">Mentorship Programme</span>
          <p className="mt-6 max-w-md text-lg text-white/75 leading-relaxed">{s.tagline}</p>
        </div>
        <p className="flex items-center gap-2.5 text-sm text-white/60"><span className="cyan-dot" />Invite only. Use the email your invitation was sent to.</p>
      </div>
      <div className="flex flex-col items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <Link className="mb-10 inline-block lg:hidden" href="/"><Logo name={s.shortName} /></Link>
          <SignInForm demo={demo} dev={dev} initialEmail={email ?? ""} supportEmail={s.supportEmail} />
        </div>
      </div>
    </div>
  );
}
