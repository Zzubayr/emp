import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/app/logo";
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
      <div className="relative hidden overflow-hidden bg-linear-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgb(255_255_255/0.2),transparent_45%),radial-gradient(circle_at_90%_90%,rgb(0_0_0/0.25),transparent_50%)]" />
        <Link className="relative" href="/"><Logo className="[&>span:last-child]:text-white" name={s.shortName} /></Link>
        <blockquote className="relative max-w-md">
          <p className="font-medium text-3xl leading-snug tracking-tight">“I always know who I am meeting, when, and what we said we would do next.”</p>
          <footer className="mt-4 text-sm text-white/70">What every mentor and mentee should be able to say.</footer>
        </blockquote>
        <p className="relative text-sm text-white/60">{s.orgName}</p>
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
