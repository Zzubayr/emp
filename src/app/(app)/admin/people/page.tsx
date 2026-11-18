import { Download, Search, Upload } from "lucide-react";
import Link from "next/link";
import { NativeSelect, PageHeader, Panel } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { adminCtx } from "@/lib/admin";
import { isAdminRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { AddPerson, PeopleTable } from "./table";

export const metadata = { title: "People" };

export default async function People({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; status?: string; track?: string }> }) {
  const { user, cohort, tracks, trackIds } = await adminCtx();
  const sp = await searchParams;
  const admin = isAdminRole(user.role);
  const staffView = sp.role === "STAFF" && admin;
  const trackFilter = sp.track && trackIds.includes(sp.track) ? [sp.track] : trackIds;
  const where = {
    ...(staffView ? { role: { in: ["COORDINATOR", "ADMIN", "SUPER_ADMIN"] } } : { memberships: { some: { cohortId: cohort?.id ?? "-", trackId: { in: trackFilter }, ...(sp.role === "MENTEE" || sp.role === "MENTOR" ? { role: sp.role } : {}) } } }),
    ...(sp.status ? { status: sp.status } : { status: { not: "REMOVED" } }),
    ...(sp.q ? { OR: [{ name: { contains: sp.q, mode: "insensitive" as const } }, { email: { contains: sp.q, mode: "insensitive" as const } }, { studentId: { contains: sp.q, mode: "insensitive" as const } }] } : {}),
  };
  const [rows, total] = await Promise.all([
    db.user.findMany({ where, orderBy: [{ status: "asc" }, { name: "asc" }], take: 300, include: { memberships: { where: { cohortId: cohort?.id ?? "-" }, include: { track: { select: { name: true } } } } } }),
    db.user.count({ where }),
  ]);
  return (
    <div>
      <PageHeader
        actions={
          <>
            <Button asChild variant="outline"><a href="/api/export/people"><Download className="size-4" /> Export</a></Button>
            <Button asChild variant="outline"><Link href="/admin/people/import"><Upload className="size-4" /> Import</Link></Button>
            {cohort && <AddPerson admin={admin} cohortId={cohort.id} tracks={tracks.map((t) => t.name)} />}
          </>
        }
        description={`The allow list for ${cohort?.name ?? "this cohort"}. Only people listed here can sign in. Selection happens outside EMP; add the people you chose.`}
        title="People"
      />
      <Panel bodyClassName="p-0">
        <form className="flex flex-col gap-2 border-b p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
            <Input aria-label="Search" className="pl-9" defaultValue={sp.q} name="q" placeholder="Search name, email or student ID" />
          </div>
          <NativeSelect aria-label="Role" className="sm:w-36" defaultValue={sp.role ?? ""} name="role"><option value="">All roles</option><option value="MENTEE">Mentees</option><option value="MENTOR">Mentors</option>{admin && <option value="STAFF">Staff</option>}</NativeSelect>
          <NativeSelect aria-label="Status" className="sm:w-36" defaultValue={sp.status ?? ""} name="status"><option value="">Any status</option><option value="INVITED">Invited</option><option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="REMOVED">Removed</option></NativeSelect>
          <NativeSelect aria-label="Track" className="sm:w-44" defaultValue={sp.track ?? ""} name="track"><option value="">All tracks</option>{tracks.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</NativeSelect>
          <Button type="submit" variant="secondary">Filter</Button>
        </form>
        <PeopleTable
          rows={rows.map((u) => ({
            id: u.id, name: u.name, email: u.email, avatar: u.avatar, role: u.role, status: u.status, level: u.level,
            tracks: u.memberships.map((m) => m.track.name), invited: u.inviteCount, signedIn: Boolean(u.firstSignInAt), onboarded: Boolean(u.onboardedAt),
          }))}
          total={total}
        />
      </Panel>
    </div>
  );
}
