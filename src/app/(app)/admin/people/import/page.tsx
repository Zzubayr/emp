import Link from "next/link";
import { Empty, PageHeader, Panel } from "@/components/app/bits";
import { Layers } from "lucide-react";
import { adminCtx } from "@/lib/admin";
import { Importer } from "./importer";

export const metadata = { title: "Import people" };

export default async function ImportPeople() {
  const { cohort, tracks } = await adminCtx();
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        description={`Add many people to ${cohort?.name ?? "the cohort"} at once. Upload a CSV or paste rows from a spreadsheet. Nothing is saved until you confirm.`}
        eyebrow={<Link className="hover:underline" href="/admin/people">People</Link>}
        title="Import people"
      />
      {cohort ? <Importer cohortId={cohort.id} cohortName={cohort.name} tracks={tracks.map((t) => t.name)} /> : <Panel><Empty description="Create a cohort before importing people." icon={Layers} title="No cohort selected" /></Panel>}
    </div>
  );
}
