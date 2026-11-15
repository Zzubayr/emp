import { Bell, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { UserAvatar } from "@/components/app/bits";
import { Logo } from "@/components/app/logo";
import { BottomTabs, CohortSwitcher, CommandMenu, type NavItem, SideNav, UserMenu } from "@/components/app/shell-client";
import { isAdminRole, isStaffRole, requireReady } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/constants";
import { db } from "@/lib/db";
import { currentCohort } from "@/lib/scope";
import { getSettings } from "@/lib/settings";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireReady();
  const s = await getSettings();
  const staff = isStaffRole(user.role);
  const [unread, requests] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    user.role === "MENTOR" ? db.match.count({ where: { mentorId: user.id, status: "REQUESTED" } }) : 0,
  ]);
  const { cohort, cohorts } = staff ? await currentCohort() : { cohort: null, cohorts: [] };

  let nav: NavItem[];
  if (staff) {
    const openCases = isAdminRole(user.role) && s.modules.safety ? await db.safetyCase.count({ where: { status: { not: "RESOLVED" } } }) : 0;
    nav = [
      { href: "/admin", label: "Dashboard", icon: "LayoutDashboard" },
      ...(isAdminRole(user.role) ? [{ href: "/admin/cohorts", label: "Cohorts", icon: "Layers", group: "Program" }] : []),
      { href: "/admin/tracks", label: "Tracks", icon: "Route", group: "Program" },
      { href: "/admin/people", label: "People", icon: "UsersRound", group: "Program" },
      { href: "/admin/matching", label: "Assignment", icon: "Shuffle", group: "Program" },
      { href: "/admin/pairs", label: "Pairs", icon: "HeartHandshake", group: "Monitor" },
      { href: "/admin/sessions", label: "Sessions", icon: "CalendarDays", group: "Monitor" },
      ...(s.modules.attendance ? [{ href: "/admin/attendance", label: "Attendance", icon: "ClipboardCheck", group: "Monitor" }] : []),
      ...(s.modules.feedback ? [{ href: "/admin/feedback", label: "Feedback", icon: "MessageSquareHeart", group: "Monitor" }] : []),
      ...(isAdminRole(user.role) && s.modules.safety ? [{ href: "/admin/safety", label: "Safety", icon: "ShieldAlert", group: "Monitor", badge: openCases }] : []),
      { href: "/admin/reports", label: "Reports", icon: "BarChart3", group: "Insight" },
      ...(isAdminRole(user.role) ? [{ href: "/admin/settings", label: "Settings", icon: "Settings", group: "Insight" }] : []),
    ];
  } else if (user.role === "MENTOR") {
    nav = [
      { href: "/home", label: "Home", icon: "Home" },
      { href: "/requests", label: "Requests", icon: "Inbox", badge: requests },
      { href: "/mentees", label: `My ${s.labelMentee.toLowerCase()}s`, icon: "Users" },
      { href: "/sessions", label: "Sessions", icon: "CalendarDays" },
      { href: "/availability", label: "Availability", icon: "CalendarClock" },
      { href: "/help", label: "Help", icon: "LifeBuoy" },
    ];
  } else {
    nav = [
      { href: "/home", label: "Home", icon: "Home" },
      { href: "/mentor", label: `My ${s.labelMentor.toLowerCase()}`, icon: "HeartHandshake" },
      { href: "/sessions", label: "Sessions", icon: "CalendarDays" },
      { href: "/availability", label: "Availability", icon: "CalendarClock" },
      { href: "/help", label: "Help", icon: "LifeBuoy" },
    ];
  }
  const mobile = staff ? [nav[0], ...nav.filter((n) => ["/admin/people", "/admin/matching", "/admin/pairs", "/admin/sessions"].includes(n.href))] : nav;

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
      <a className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground" href="#main">Skip to content</a>
      <aside className="sticky top-0 hidden h-dvh flex-col border-r bg-sidebar lg:flex">
        <div className="flex h-16 items-center px-5">
          <Link href={staff ? "/admin" : "/home"}><Logo name={s.shortName} /></Link>
        </div>
        {staff && <CohortSwitcher cohorts={cohorts.map((c) => ({ id: c.id, name: c.name, status: c.status }))} current={cohort?.id} />}
        <SideNav items={nav} />
        {s.modules.safety && (
          <div className="p-3">
            <Link className="flex items-center gap-2.5 rounded-xl border border-dashed p-3 text-muted-foreground text-xs transition-colors hover:border-rose-400/60 hover:text-foreground" href="/report">
              <ShieldAlert className="size-4 shrink-0 text-rose-500" />
              <span>Something not right? <span className="font-medium text-foreground">Report a concern</span></span>
            </Link>
          </div>
        )}
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur-lg sm:px-6">
          <Link className="lg:hidden" href={staff ? "/admin" : "/home"}><Logo compact name={s.shortName} /></Link>
          <div className="flex flex-1 justify-end md:justify-start"><CommandMenu items={nav} /></div>
          {s.modules.safety && (
            <Link aria-label="Report a concern" className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-rose-500 lg:hidden" href="/report">
              <ShieldAlert className="size-[18px]" />
            </Link>
          )}
          <Link aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} className="relative flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground" href="/notifications">
            <Bell className="size-[18px]" />
            {unread > 0 && <span className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 font-semibold text-[10px] text-primary-foreground">{unread > 9 ? "9+" : unread}</span>}
          </Link>
          <div className="hidden sm:block">
            <UserMenu user={{ id: user.id, name: user.name, email: user.email, role: ROLE_LABEL[user.role] }} />
          </div>
          <Link aria-label="Account" className="sm:hidden" href="/account"><UserAvatar user={user} /></Link>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24 sm:px-6 lg:pb-12" id="main">{children}</main>
      </div>
      <BottomTabs items={mobile} />
    </div>
  );
}
