import {
  AlertTriangle, Ban, CalendarCheck, CheckCircle2, CircleDashed, CircleDot, Clock, Hourglass, Mail, PauseCircle,
  ShieldAlert, UserX, XCircle, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AVATAR_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function UserAvatar({ user, size = "md", className }: { user: { name: string; avatar?: number }; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const initials = user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
  const sizes = { sm: "size-7 text-[11px]", md: "size-9 text-xs", lg: "size-12 text-sm", xl: "size-16 text-lg" };
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold ring-2 ring-background", AVATAR_COLORS[(user.avatar ?? 0) % AVATAR_COLORS.length].cls, sizes[size], className)}
    >
      {initials || "?"}
    </span>
  );
}

const tones = {
  green: "bg-emerald-500/10 text-emerald-700 ring-emerald-600/20 dark:text-emerald-300",
  amber: "bg-amber-500/10 text-amber-700 ring-amber-600/20 dark:text-amber-300",
  red: "bg-rose-500/10 text-rose-700 ring-rose-600/20 dark:text-rose-300",
  blue: "bg-cyan/15 text-[#0b6a72] ring-cyan/50 dark:text-cyan",
  navy: "bg-navy/8 text-navy ring-navy/20 dark:bg-white/10 dark:text-white dark:ring-white/20",
  cyan: "bg-cyan/15 text-[#0b6a72] ring-cyan/50 dark:text-cyan",
  gray: "bg-zinc-500/10 text-zinc-600 ring-zinc-500/20 dark:text-zinc-300",
};

// Every status has a colour and an icon, so colour is never the only signal.
const STATUS: Record<string, { label: string; tone: keyof typeof tones; icon: LucideIcon }> = {
  INVITED: { label: "Invited", tone: "blue", icon: Mail },
  ACTIVE: { label: "Active", tone: "green", icon: CheckCircle2 },
  SUSPENDED: { label: "Suspended", tone: "amber", icon: PauseCircle },
  REMOVED: { label: "Removed", tone: "gray", icon: Ban },
  DRAFT: { label: "Draft", tone: "gray", icon: CircleDashed },
  ONBOARDING: { label: "Onboarding", tone: "blue", icon: CircleDot },
  COMPLETED: { label: "Completed", tone: "navy", icon: CheckCircle2 },
  ARCHIVED: { label: "Archived", tone: "gray", icon: Ban },
  OPEN: { label: "Open", tone: "green", icon: CircleDot },
  CLOSED: { label: "Closed", tone: "gray", icon: XCircle },
  REQUESTED: { label: "Requested", tone: "blue", icon: Hourglass },
  SUGGESTED: { label: "Suggested", tone: "navy", icon: CircleDot },
  PAUSED: { label: "Paused", tone: "amber", icon: PauseCircle },
  ENDED: { label: "Ended", tone: "gray", icon: XCircle },
  DECLINED: { label: "Declined", tone: "red", icon: XCircle },
  EXPIRED: { label: "Expired", tone: "gray", icon: Clock },
  PROPOSED: { label: "Awaiting confirmation", tone: "amber", icon: Hourglass },
  CONFIRMED: { label: "Confirmed", tone: "blue", icon: CalendarCheck },
  CANCELLED: { label: "Cancelled", tone: "gray", icon: XCircle },
  HELD: { label: "Held", tone: "green", icon: CheckCircle2 },
  NO_SHOW_MENTEE: { label: "No-show (mentee)", tone: "red", icon: UserX },
  NO_SHOW_MENTOR: { label: "No-show (mentor)", tone: "red", icon: UserX },
  Healthy: { label: "Healthy", tone: "green", icon: CheckCircle2 },
  Quiet: { label: "Quiet", tone: "amber", icon: Clock },
  "At risk": { label: "At risk", tone: "red", icon: AlertTriangle },
  PRESENT: { label: "Present", tone: "green", icon: CheckCircle2 },
  LATE: { label: "Late", tone: "amber", icon: Clock },
  LEFT_EARLY: { label: "Left early", tone: "amber", icon: Clock },
  ABSENT: { label: "Absent", tone: "red", icon: UserX },
  IN_REVIEW: { label: "In review", tone: "amber", icon: ShieldAlert },
  RESOLVED: { label: "Resolved", tone: "green", icon: CheckCircle2 },
  LOW: { label: "Low", tone: "gray", icon: CircleDot },
  MEDIUM: { label: "Medium", tone: "amber", icon: AlertTriangle },
  HIGH: { label: "High", tone: "red", icon: ShieldAlert },
  SENT: { label: "Sent", tone: "green", icon: CheckCircle2 },
  LOGGED: { label: "Logged only", tone: "gray", icon: CircleDashed },
  FAILED: { label: "Failed", tone: "red", icon: XCircle },
};

export function Chip({ status, label, className }: { status: string; label?: string; className?: string }) {
  const s = STATUS[status] ?? { label: status, tone: "gray" as const, icon: CircleDot };
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 font-medium text-xs ring-1 ring-inset", tones[s.tone], className)}>
      <Icon className="size-3" />
      {label ?? s.label}
    </span>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-muted-foreground text-xs", className)}>{children}</span>;
}

export function PageHeader({ title, description, actions, eyebrow }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex animate-fade-up flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 flex items-center gap-2 font-semibold text-[11px] text-muted-foreground uppercase tracking-[0.14em]"><span className="h-0.5 w-5 bg-cyan" />{eyebrow}</div>}
        <h1 className="font-bold text-[22px] tracking-tight sm:text-[26px]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-muted-foreground text-sm">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, description, action, children, className, bodyClassName, id }: { title?: ReactNode; description?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClassName?: string; id?: string }) {
  return (
    <section className={cn("surface", className)} id={id}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-semibold text-[15px] text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-muted-foreground text-xs">{description}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint, icon: Icon, tone = "brand", href }: { label: string; value: ReactNode; hint?: ReactNode; icon: LucideIcon; tone?: "brand" | "green" | "amber" | "red" | "blue"; href?: string }) {
  const t = { brand: "text-navy dark:text-cyan", green: "text-emerald-600 dark:text-emerald-400", amber: "text-amber-600 dark:text-amber-400", red: "text-rose-600 dark:text-rose-400", blue: "text-[#2f5d8c] dark:text-[#7fa9d6]" }[tone];
  const body = (
    <div className={cn("surface group relative flex h-full items-start justify-between gap-2 overflow-hidden p-4 transition-colors duration-150 sm:p-5", href && "hover:border-navy/30 dark:hover:border-cyan/40")}>
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-cyan opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
      <div>
        <div className="text-muted-foreground text-xs">{label}</div>
        <div className="mt-2 font-bold text-2xl tabular-nums tracking-tight sm:text-[28px]">{value}</div>
        {hint && <div className="mt-1 text-muted-foreground text-xs">{hint}</div>}
      </div>
      <span className={cn("hidden size-8 shrink-0 items-center justify-center rounded-md border bg-background min-[400px]:flex", t)}>
        <Icon className="size-4" />
      </span>
    </div>
  );
  return href ? <Link className="block h-full" href={href}>{body}</Link> : body;
}

export function Empty({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
      <span className="mb-4 flex size-12 items-center justify-center rounded-full border-2 border-cyan/60 bg-brand-soft text-navy dark:text-cyan">
        <Icon className="size-5" />
      </span>
      <h3 className="font-semibold">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-muted-foreground text-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="font-medium text-sm">{label}</span>
      {children}
      {hint && <span className="block text-muted-foreground text-xs">{hint}</span>}
    </label>
  );
}

export function NativeSelect({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      {...props}
      className={cn("h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-input/30", className)}
    />
  );
}

export function Meter({ value, className }: { value: number; className?: string }) {
  const tone = value >= 70 ? "bg-emerald-500" : value >= 40 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", tone)} style={{ width: `${Math.max(3, Math.min(100, value))}%` }} />
    </div>
  );
}
