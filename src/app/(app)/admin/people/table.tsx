"use client";

import { Check, Mail, Plus, UserRoundX, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { bulkPeople, commitImport } from "@/actions/people";
import { Chip, Empty, Field, NativeSelect, Tag, UserAvatar } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LEVELS, ROLE_LABEL } from "@/lib/constants";

type Row = { id: string; name: string; email: string; avatar: number; role: string; status: string; level: string | null; tracks: string[]; invited: number; signedIn: boolean; onboarded: boolean };

export function PeopleTable({ rows, total }: { rows: Row[]; total: number }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const all = rows.length > 0 && sel.size === rows.length;
  const toggle = (id: string) => {
    const n = new Set(sel);
    n.has(id) ? n.delete(id) : n.add(id);
    setSel(n);
  };
  const run = (op: "invite" | "suspend" | "activate" | "remove") => {
    if (op === "remove" && !window.confirm(`Remove ${sel.size} people? Their pairs end, sessions are cancelled and partners are told.`)) return;
    start(async () => {
      const r = await bulkPeople([...sel], op);
      r.ok ? toast.success(r.message) : toast.error(r.error);
      setSel(new Set());
      router.refresh();
    });
  };
  if (rows.length === 0) return <Empty description="Try different filters, or add people to this cohort." icon={UsersRound} title="No one matches" />;
  return (
    <div>
      {sel.size > 0 && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 border-b bg-brand-soft px-4 py-2.5 text-sm">
          <span className="mr-2 font-medium">{sel.size} selected</span>
          <Button disabled={pending} onClick={() => run("invite")} size="sm" variant="outline"><Mail className="size-4" /> Send or resend invite</Button>
          <Button disabled={pending} onClick={() => run("activate")} size="sm" variant="outline"><Check className="size-4" /> Reactivate</Button>
          <Button disabled={pending} onClick={() => run("suspend")} size="sm" variant="outline">Suspend</Button>
          <Button className="text-destructive" disabled={pending} onClick={() => run("remove")} size="sm" variant="outline"><UserRoundX className="size-4" /> Remove</Button>
          <Button onClick={() => setSel(new Set())} size="sm" variant="ghost">Clear</Button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground text-xs">
              <th className="w-10 py-3 pl-5"><input aria-label="Select all" checked={all} className="size-4 accent-[var(--brand)]" onChange={() => setSel(all ? new Set() : new Set(rows.map((r) => r.id)))} type="checkbox" /></th>
              <th className="px-3 py-3 font-medium">Person</th><th className="px-3 py-3 font-medium">Role</th><th className="px-3 py-3 font-medium">Tracks</th><th className="px-3 py-3 font-medium">Progress</th><th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((r) => (
              <tr className="transition-colors hover:bg-accent/40" key={r.id}>
                <td className="py-3 pl-5"><input aria-label={`Select ${r.name}`} checked={sel.has(r.id)} className="size-4 accent-[var(--brand)]" onChange={() => toggle(r.id)} type="checkbox" /></td>
                <td className="px-3 py-3">
                  <Link className="flex items-center gap-3" href={`/admin/people/${r.id}`}>
                    <UserAvatar size="sm" user={r} />
                    <span className="min-w-0"><span className="block truncate font-medium hover:underline">{r.name}</span><span className="block truncate text-muted-foreground text-xs">{r.email}</span></span>
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-3">{ROLE_LABEL[r.role]}{r.level ? <span className="text-muted-foreground"> · {r.level}</span> : null}</td>
                <td className="px-3 py-3"><div className="flex flex-wrap gap-1">{r.tracks.map((t) => <Tag key={t}>{t}</Tag>)}</div></td>
                <td className="whitespace-nowrap px-3 py-3 text-muted-foreground text-xs">{r.onboarded ? "Profile done" : r.signedIn ? "Signed in, profile pending" : r.invited ? `Invite sent${r.invited > 1 ? ` ×${r.invited}` : ""}` : "Not invited yet"}</td>
                <td className="px-5 py-3"><Chip status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t px-5 py-3 text-muted-foreground text-xs">Showing {rows.length} of {total}.{total > rows.length ? " Narrow the filters to see the rest." : ""}</p>
    </div>
  );
}

export function AddPerson({ cohortId, tracks, admin }: { cohortId: string; tracks: string[]; admin: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("MENTEE");
  const [pending, start] = useTransition();
  const staff = role === "COORDINATOR" || role === "ADMIN";
  return (
    <>
      <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Add person</Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Add a person</DialogTitle><DialogDescription>They get an invite email and can sign in with a one-time code. Use the Google account they will join Meet with.</DialogDescription></DialogHeader>
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const g = (k: string) => String(fd.get(k) ?? "").trim();
              start(async () => {
                const r = await commitImport([{ email: g("email"), name: g("name"), role, tracks: staff ? [] : [g("track"), g("track2")].filter(Boolean), level: g("level"), studentId: g("studentId"), notes: g("notes") }], cohortId, fd.get("invite") === "on");
                if (!r.ok) return void toast.error(r.error === "No valid rows to add." ? "Check the email, name and track. A mentee can have one academic and one non-academic track." : r.error);
                toast.success(r.message);
                setOpen(false);
                router.refresh();
              });
            }}
          >
            <Field label="Full name"><Input minLength={2} name="name" required /></Field>
            <Field label="Email"><Input name="email" required type="email" /></Field>
            <Field label="Role">
              <NativeSelect onChange={(e) => setRole(e.target.value)} value={role}><option value="MENTEE">Mentee</option><option value="MENTOR">Mentor</option>{admin && <option value="COORDINATOR">Track coordinator</option>}{admin && <option value="ADMIN">Program admin</option>}</NativeSelect>
            </Field>
            {!staff && <Field label="Level"><NativeSelect name="level"><option value="">Not set</option>{LEVELS.map((l) => <option key={l}>{l}</option>)}</NativeSelect></Field>}
            {!staff && <Field label="Track"><NativeSelect name="track" required><option value="">Choose…</option>{tracks.map((t) => <option key={t}>{t}</option>)}</NativeSelect></Field>}
            {!staff && <Field hint="Optional" label="Second track"><NativeSelect name="track2"><option value="">None</option>{tracks.map((t) => <option key={t}>{t}</option>)}</NativeSelect></Field>}
            {!staff && <Field hint="Optional" label="Student ID"><Input name="studentId" /></Field>}
            {!staff && <Field className="sm:col-span-2" hint="Why they joined, from your application form." label="Application notes"><Textarea name="notes" rows={2} /></Field>}
            {staff && <p className="text-muted-foreground text-xs sm:col-span-2">{role === "COORDINATOR" ? "After adding, set them as coordinator on the tracks they should manage (Tracks → track → Track coordinator)." : "Program admins can see and manage everything except super admin accounts."}</p>}
            <label className="flex items-center gap-2 text-sm sm:col-span-2"><input className="size-4 accent-[var(--brand)]" defaultChecked name="invite" type="checkbox" /> Send the invite email now</label>
            <div className="flex justify-end gap-2 sm:col-span-2"><Button onClick={() => setOpen(false)} type="button" variant="ghost">Cancel</Button><Button disabled={pending} type="submit">Add person</Button></div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
