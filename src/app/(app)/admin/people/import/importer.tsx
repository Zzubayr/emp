"use client";

import { AlertTriangle, ArrowLeft, CheckCircle2, Download, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { commitImport, previewImport, type PreviewRow } from "@/actions/people";
import { Field, NativeSelect, Panel, Tag } from "@/components/app/bits";
import FileUpload from "@/components/kokonutui/file-upload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ROLE_LABEL } from "@/lib/constants";
import { cn } from "@/lib/utils";

const SAMPLE = "name,email,role,track,level,faculty,student id,notes\nAda Obi,ada.obi@example.edu,mentee,100 Level;Tech,100,Engineering,EMS/27/0001,Wants help choosing a major\nKola Ade,kola.ade@example.com,mentor,Tech,Graduate,Engineering,,Alumnus and backend engineer";

export function Importer({ cohortId, cohortName, tracks }: { cohortId: string; cohortName: string; tracks: string[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [role, setRole] = useState("mentee");
  const [track, setTrack] = useState("");
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [mapping, setMapping] = useState<string[]>([]);
  const [invite, setInvite] = useState(true);
  const [pending, start] = useTransition();

  const preview = (source: string) =>
    start(async () => {
      const r = await previewImport(source, cohortId, { role, track });
      if (!r.ok) return void toast.error(r.error);
      setRows(r.rows);
      setMapping(r.mapping);
    });

  if (rows) {
    const good = rows.filter((r) => r.errors.length === 0);
    const bad = rows.length - good.length;
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="surface p-5"><div className="text-muted-foreground text-xs">Rows read</div><div className="mt-1 font-semibold text-3xl tabular-nums">{rows.length}</div></div>
          <div className="surface p-5"><div className="flex items-center gap-1.5 text-emerald-600 text-xs"><CheckCircle2 className="size-3.5" /> Ready to add</div><div className="mt-1 font-semibold text-3xl tabular-nums">{good.length}</div></div>
          <div className="surface p-5"><div className="flex items-center gap-1.5 text-rose-600 text-xs"><AlertTriangle className="size-3.5" /> Need fixing</div><div className="mt-1 font-semibold text-3xl tabular-nums">{bad}</div></div>
        </div>
        <Panel bodyClassName="p-0" description={mapping.join("  ·  ")} title="Preview">
          <div className="max-h-[460px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card"><tr className="border-b text-left text-muted-foreground text-xs"><th className="px-5 py-2.5 font-medium">#</th><th className="px-3 py-2.5 font-medium">Name</th><th className="px-3 py-2.5 font-medium">Email</th><th className="px-3 py-2.5 font-medium">Role</th><th className="px-3 py-2.5 font-medium">Tracks</th><th className="px-5 py-2.5 font-medium">Check</th></tr></thead>
              <tbody className="divide-y">
                {[...rows].sort((a, b) => b.errors.length - a.errors.length).map((r) => (
                  <tr className={cn(r.errors.length && "bg-rose-500/5")} key={r.line}>
                    <td className="px-5 py-2.5 text-muted-foreground tabular-nums">{r.line}</td>
                    <td className="px-3 py-2.5 font-medium">{r.name || "–"}</td>
                    <td className="px-3 py-2.5">{r.email || "–"}</td>
                    <td className="px-3 py-2.5">{ROLE_LABEL[r.role] ?? r.role}</td>
                    <td className="px-3 py-2.5"><div className="flex flex-wrap gap-1">{r.tracks.map((t) => <Tag key={t}>{t}</Tag>)}</div></td>
                    <td className="px-5 py-2.5">{r.errors.length ? <span className="text-rose-600 text-xs">{r.errors.join("; ")}</span> : <span className="flex items-center gap-1 text-emerald-600 text-xs"><CheckCircle2 className="size-3.5" />{r.note ?? "New person"}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm"><input checked={invite} className="size-4 accent-[var(--brand)]" onChange={(e) => setInvite(e.target.checked)} type="checkbox" /> Email an invite to everyone added who has not signed in before</label>
          <div className="flex gap-2">
            <Button onClick={() => setRows(null)} variant="ghost"><ArrowLeft className="size-4" /> Back</Button>
            <Button
              className="h-11"
              disabled={pending || good.length === 0}
              onClick={() => start(async () => {
                const r = await commitImport(good.map(({ line: _l, errors: _e, note: _n, ...p }) => p), cohortId, invite);
                if (!r.ok) return void toast.error(r.error);
                toast.success(r.message);
                router.push("/admin/people");
                router.refresh();
              })}
            >
              {pending && <Loader2 className="size-4 animate-spin" />} Add {good.length} {good.length === 1 ? "person" : "people"} to {cohortName}
            </Button>
          </div>
        </div>
        {bad > 0 && <p className="text-muted-foreground text-sm">Rows that need fixing are skipped. Correct them in your file and import again; people already added are simply updated.</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Panel description="CSV exported from Excel or Google Sheets, up to 2,000 rows" title="Upload a file">
          <FileUpload
            acceptedFileTypes={[".csv", ".txt"]}
            className="w-full max-w-none"
            maxFiles={1}
            maxFileSize={2 * 1024 * 1024}
            multiple={false}
            onUpload={async (file, { onProgress }) => {
              onProgress(40);
              const content = await file.text();
              onProgress(100);
              setText(content);
              preview(content);
            }}
          />
        </Panel>
        <Panel description="Copy cells from a spreadsheet, or type one person per line: name, email" title="Or paste rows">
          <Textarea className="font-mono text-xs" onChange={(e) => setText(e.target.value)} placeholder={SAMPLE} rows={8} value={text} />
          <div className="mt-3 flex justify-end"><Button disabled={pending || !text.trim()} onClick={() => preview(text)}>{pending && <Loader2 className="size-4 animate-spin" />} Check rows</Button></div>
        </Panel>
      </div>
      <div className="space-y-6">
        <Panel description="Used when a row has no role or track column" title="Defaults">
          <div className="space-y-4">
            <Field label="Role"><NativeSelect onChange={(e) => setRole(e.target.value)} value={role}><option value="mentee">Mentee</option><option value="mentor">Mentor</option></NativeSelect></Field>
            <Field label="Track"><NativeSelect onChange={(e) => setTrack(e.target.value)} value={track}><option value="">None (use the file)</option>{tracks.map((t) => <option key={t}>{t}</option>)}</NativeSelect></Field>
          </div>
        </Panel>
        <Panel title="Columns">
          <ul className="space-y-1.5 text-muted-foreground text-sm">
            <li><span className="font-medium text-foreground">email</span> (required, unique)</li>
            <li><span className="font-medium text-foreground">name</span> (required)</li>
            <li><span className="font-medium text-foreground">role</span>: mentee or mentor</li>
            <li><span className="font-medium text-foreground">track</span>: separate two with a semicolon</li>
            <li>level, faculty, student id, notes</li>
          </ul>
          <Button asChild className="mt-4 w-full" size="sm" variant="outline"><a download="emp-import-template.csv" href={`data:text/csv;charset=utf-8,${encodeURIComponent(SAMPLE)}`}><Download className="size-4" /> Download template</a></Button>
        </Panel>
      </div>
    </div>
  );
}
