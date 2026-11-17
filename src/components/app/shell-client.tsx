"use client";

import { useMounted } from "@/components/app/use-mounted";
import {
  BarChart3, Bell, CalendarClock, CalendarDays, ClipboardCheck, GraduationCap, HeartHandshake, Home, Inbox, Layers,
  LayoutDashboard, LifeBuoy, type LucideIcon, MessageSquareHeart, Route, Search, Settings, ShieldAlert, Shuffle, UserCircle,
  Users, UsersRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState, useTransition } from "react";
import { signOutAction } from "@/actions/auth";
import { switchCohort } from "@/actions/admin";
import ActionSearchBar from "@/components/kokonutui/action-search-bar";
import ProfileDropdown from "@/components/kokonutui/profile-dropdown";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Home, HeartHandshake, CalendarDays, CalendarClock, LifeBuoy, Inbox, Users, LayoutDashboard, Layers, Route, UsersRound,
  Shuffle, ClipboardCheck, MessageSquareHeart, ShieldAlert, BarChart3, Settings, GraduationCap, Bell, UserCircle,
};

export type NavItem = { href: string; label: string; icon: string; badge?: number; group?: string };

function isActive(path: string, href: string) {
  if (href === "/admin" || href === "/home") return path === href;
  return path === href || path.startsWith(`${href}/`);
}

export function SideNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  const groups = [...new Set(items.map((i) => i.group ?? ""))];
  return (
    <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
      {groups.map((g) => (
        <div key={g}>
          {g && <div className="mb-1.5 px-3 font-semibold text-[10.5px] text-white/45 uppercase tracking-[0.16em]">{g}</div>}
          <ul className="space-y-0.5">
            {items.filter((i) => (i.group ?? "") === g).map((i) => {
              const Icon = ICONS[i.icon] ?? Home;
              const active = isActive(path, i.href);
              return (
                <li key={i.href}>
                  <Link
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-9 items-center gap-2.5 rounded-md px-3 text-sm transition-colors duration-150",
                      active ? "bg-white/10 font-medium text-white" : "text-white/65 hover:bg-white/5 hover:text-white",
                    )}
                    href={i.href}
                  >
                    {active && <span className="-translate-y-1/2 absolute top-1/2 left-0 h-5 w-[3px] bg-cyan" />}
                    <Icon className="size-4 shrink-0" />
                    <span className="flex-1 truncate">{i.label}</span>
                    {i.badge ? <span className="rounded-full bg-cyan px-1.5 py-px font-semibold text-[10px] text-navy tabular-nums">{i.badge}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function BottomTabs({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden">
      <ul className="mx-auto flex max-w-md">
        {items.slice(0, 5).map((i) => {
          const Icon = ICONS[i.icon] ?? Home;
          const active = isActive(path, i.href);
          return (
            <li className="flex-1" key={i.href}>
              <Link aria-current={active ? "page" : undefined} className={cn("relative flex h-14 flex-col items-center justify-center gap-0.5 text-[11px]", active ? "font-semibold text-navy dark:text-cyan" : "text-muted-foreground")} href={i.href}>
                {active && <span className="absolute top-0 h-[3px] w-8 bg-cyan" />}
                <Icon className="size-5" />
                <span className="max-w-full truncate px-1">{i.label}</span>
                {i.badge ? <span className="absolute top-2 left-[55%] size-2 rounded-full bg-cyan ring-2 ring-background" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function CommandMenu({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <>
      <button
        aria-label="Search or jump to a page"
        className="flex size-9 items-center justify-center gap-2 rounded-lg text-muted-foreground text-sm transition-colors hover:text-foreground md:w-full md:max-w-xs md:justify-start md:border md:bg-card md:px-3 md:shadow-xs md:hover:border-ring/40"
        onClick={() => setOpen(true)}
        type="button"
      >
        <Search className="size-4" />
        <span className="hidden flex-1 text-left md:inline">Search or jump to…</span>
        <kbd className="hidden rounded border bg-muted px-1.5 font-sans text-[10px] md:inline">⌘K</kbd>
      </button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="top-[20%] translate-y-0 gap-0 overflow-visible border-0 bg-transparent p-0 shadow-none sm:max-w-xl" showCloseButton={false}>
          <DialogTitle className="sr-only">Search</DialogTitle>
          <ActionSearchBar
            defaultOpen
            items={items.map((i) => {
              const Icon = ICONS[i.icon] ?? Home;
              return { id: i.href, label: i.label, group: i.group || "Go to", icon: <Icon className="size-4" />, href: i.href };
            })}
            label="Jump to a page"
            onSelect={(item) => {
              setOpen(false);
              router.push(item.id);
            }}
            placeholder="Where do you want to go?"
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function UserMenu({ user }: { user: { id: string; name: string; email: string; role: string } }) {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  return (
    <ProfileDropdown
      accounts={[{ id: user.id, name: user.name, email: user.email, plan: user.role }]}
      items={[
        { label: "Profile and account", icon: <UserCircle className="size-4" />, href: "/account" },
        { label: "Notifications", icon: <Bell className="size-4" />, href: "/notifications" },
        { label: "Help", icon: <LifeBuoy className="size-4" />, href: "/help" },
      ]}
      onSignOut={() => signOutAction()}
      onThemeChange={(t) => setTheme(t)}
      theme={mounted ? ((theme as "light" | "dark" | "system") ?? "system") : "system"}
    />
  );
}

export function CohortSwitcher({ cohorts, current }: { cohorts: { id: string; name: string; status: string }[]; current?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!cohorts.length) return null;
  return (
    <label className="mx-3 mb-2 block">
      <span className="mb-1.5 block px-1 font-semibold text-[10.5px] text-white/45 uppercase tracking-[0.16em]">Cohort</span>
      <select
        aria-label="Cohort"
        className={cn("h-9 w-full rounded-md border border-white/15 bg-white/5 px-2.5 font-medium text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan [&>option]:text-navy", pending && "opacity-60")}
        onChange={(e) => start(async () => {
          await switchCohort(e.target.value);
          router.refresh();
        })}
        value={current ?? ""}
      >
        {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.status !== "ACTIVE" ? ` · ${c.status.toLowerCase()}` : ""}</option>)}
      </select>
    </label>
  );
}
