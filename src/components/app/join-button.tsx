"use client";

import { Video } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Goes live 10 minutes before the start and stays live until the session ends. */
export function JoinButton({ sessionId, startsAt, endsAt, hasLink, className }: { sessionId: string; startsAt: string; endsAt: string; hasLink: boolean; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20_000);
    return () => clearInterval(t);
  }, []);
  const start = new Date(startsAt).getTime(), end = new Date(endsAt).getTime();
  const live = now >= start - 10 * 60_000 && now <= end;
  if (now > end) return null;
  if (!hasLink) return <span className={cn("inline-flex h-10 items-center rounded-lg border border-dashed px-4 text-muted-foreground text-sm", className)}>Link not added yet</span>;
  if (!live) {
    const mins = Math.round((start - now) / 60_000);
    const label = mins < 90 ? `Join opens in ${Math.max(1, mins - 10)} min` : "Join opens 10 min before";
    return <span aria-disabled className={cn("inline-flex h-10 items-center gap-2 rounded-lg bg-muted px-4 text-muted-foreground text-sm", className)}><Video className="size-4" />{label}</span>;
  }
  return (
    <a
      className={cn("relative inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-5 font-medium text-sm text-white shadow-[0_6px_20px_-6px_rgb(5_150_105/0.7)] transition-[scale,background-color] hover:bg-emerald-500 active:scale-[0.97]", className)}
      href={`/join/${sessionId}`}
      rel="noreferrer"
      target="_blank"
    >
      <span className="absolute -top-1 -right-1 flex size-3"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex size-3 rounded-full bg-emerald-400 ring-2 ring-background" /></span>
      <Video className="size-4" /> Join now
    </a>
  );
}
