"use client";

import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { requestCode, verifyCode } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROLE_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function SignInForm({ initialEmail, supportEmail, dev, demo }: { initialEmail: string; supportEmail: string; dev: boolean; demo: { email: string; name: string; role: string }[] }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string>();
  const [wait, setWait] = useState(0);
  const [pending, start] = useTransition();
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = (address = email) =>
    start(async () => {
      const r = await requestCode(address);
      if (!r.ok) return void toast.error(r.error);
      setDevCode(r.devCode);
      setStep("code");
      setCode("");
      setWait(60);
      setTimeout(() => codeRef.current?.focus(), 50);
    });

  const verify = (value: string) =>
    start(async () => {
      const r = await verifyCode(email, value);
      if (!r.ok) {
        setCode("");
        return void toast.error(r.error);
      }
      router.push("/home");
      router.refresh();
    });

  if (step === "code") {
    return (
      <div className="animate-fade-up">
        <button className="mb-6 inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground" onClick={() => setStep("email")} type="button">
          <ArrowLeft className="size-4" /> Use a different email
        </button>
        <h1 className="font-semibold text-2xl">Check your email</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          If <span className="font-medium text-foreground">{email}</span> is on the list, we sent a 6-digit code. It expires in 10 minutes.
        </p>
        {dev && (
          <div className="mt-4 rounded-xl border border-amber-500/40 border-dashed bg-amber-500/10 p-3 text-sm">
            <span className="font-medium">Demo mode.</span>{" "}
            {devCode ? <>Your code is <button className="font-mono font-semibold underline" onClick={() => { setCode(devCode); verify(devCode); }} type="button">{devCode}</button> (click to use it).</> : "This email is not on the allow list, so no code was sent."}
          </div>
        )}
        <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); verify(code); }}>
          <label className="block">
            <span className="sr-only">6-digit code</span>
            <input
              autoComplete="one-time-code"
              className="h-14 w-full rounded-xl border bg-card text-center font-mono font-semibold text-2xl tracking-[0.5em] shadow-xs outline-none transition-shadow focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              inputMode="numeric"
              maxLength={6}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(v);
                if (v.length === 6) verify(v);
              }}
              placeholder="······"
              ref={codeRef}
              value={code}
            />
          </label>
          <Button className="h-11 w-full" disabled={pending || code.length !== 6} type="submit">
            {pending && <Loader2 className="size-4 animate-spin" />} Sign in
          </Button>
        </form>
        <p className="mt-4 text-center text-muted-foreground text-sm">
          {wait > 0 ? `You can ask for a new code in ${wait}s` : <button className="font-medium text-brand hover:underline" disabled={pending} onClick={() => send()} type="button">Send a new code</button>}
        </p>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <h1 className="font-semibold text-2xl">Welcome back</h1>
      <p className="mt-2 text-muted-foreground text-sm">Enter the email your invitation was sent to. We will email you a one-time code. No password needed.</p>
      <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); send(); }}>
        <label className="block space-y-1.5">
          <span className="font-medium text-sm">Email address</span>
          <span className="relative block">
            <Mail className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
            <Input autoComplete="email" autoFocus className="h-11 pl-9" onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required type="email" value={email} />
          </span>
        </label>
        <Button className="h-11 w-full" disabled={pending || !email} type="submit">
          {pending && <Loader2 className="size-4 animate-spin" />} Email me a code
        </Button>
      </form>
      <p className="mt-4 text-center text-muted-foreground text-sm">
        Not on the list? <a className="font-medium text-brand hover:underline" href={`mailto:${supportEmail}`}>Contact the program</a>
      </p>
      {dev && demo.length > 0 && (
        <div className="mt-8 rounded-2xl border border-dashed p-4">
          <p className="mb-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Demo accounts</p>
          <div className="grid gap-2">
            {demo.map((d) => (
              <button
                className={cn("flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors hover:border-brand/50 hover:bg-brand-soft")}
                disabled={pending}
                key={d.email}
                onClick={() => { setEmail(d.email); send(d.email); }}
                type="button"
              >
                <span className="min-w-0"><span className="block truncate font-medium">{d.name}</span><span className="block truncate text-muted-foreground text-xs">{d.email}</span></span>
                <span className="ml-3 shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs">{ROLE_LABEL[d.role]}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
