import { cn } from "@/lib/utils";

/** A placeholder block. Pulses gently; respects reduced motion. */
export function Bone({ className }: { className?: string }) {
  return <div aria-hidden className={cn("rounded bg-muted motion-safe:animate-pulse", className)} />;
}

function Loading({ children, label = "Loading" }: { children: React.ReactNode; label?: string }) {
  return (
    <div aria-busy="true" aria-live="polite" role="status">
      <span className="sr-only">{label}…</span>
      {children}
    </div>
  );
}

export function HeaderSkeleton({ actions = 0 }: { actions?: number }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2.5">
        <Bone className="h-3 w-24" />
        <Bone className="h-7 w-64 max-w-full" />
        <Bone className="h-3.5 w-80 max-w-full" />
      </div>
      {actions > 0 && <div className="flex gap-2">{Array.from({ length: actions }, (_, i) => <Bone className="h-9 w-28 rounded-md" key={i} />)}</div>}
    </div>
  );
}

export function StatsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div className="surface space-y-3 p-4 sm:p-5" key={i}><Bone className="h-3 w-20" /><Bone className="h-7 w-14" /><Bone className="h-3 w-24" /></div>
      ))}
    </div>
  );
}

export function PanelSkeleton({ rows = 4, className, avatar = true }: { rows?: number; className?: string; avatar?: boolean }) {
  return (
    <div className={cn("surface", className)}>
      <div className="border-b px-5 py-4"><Bone className="h-4 w-36" /></div>
      <div className="divide-y">
        {Array.from({ length: rows }, (_, i) => (
          <div className="flex items-center gap-3 px-5 py-3.5" key={i}>
            {avatar && <Bone className="size-9 shrink-0 rounded-full" />}
            <div className="flex-1 space-y-2"><Bone className={cn("h-3.5", ["w-3/4", "w-1/2", "w-2/3", "w-3/5", "w-4/5"][i % 5])} /><Bone className="h-3 w-1/3" /></div>
            <Bone className="h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="surface overflow-hidden">
      <div className="flex gap-2 border-b p-4"><Bone className="h-9 flex-1 rounded-md" /><Bone className="hidden h-9 w-36 rounded-md sm:block" /><Bone className="hidden h-9 w-36 rounded-md sm:block" /></div>
      <div className="divide-y">
        {Array.from({ length: rows }, (_, r) => (
          <div className="flex items-center gap-4 px-5 py-3.5" key={r}>
            <Bone className="size-7 shrink-0 rounded-full" />
            {Array.from({ length: cols }, (_, c) => <Bone className={cn("h-3.5 flex-1", c > 1 && "hidden md:block")} key={c} />)}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <div className="surface space-y-3 p-5" key={i}>
          <div className="flex justify-between"><Bone className="size-10 rounded-full" /><Bone className="h-5 w-16 rounded-full" /></div>
          <Bone className="h-4 w-1/2" /><Bone className="h-3 w-full" /><Bone className="h-3 w-4/5" />
          <div className="flex gap-1.5 pt-1"><Bone className="h-5 w-14" /><Bone className="h-5 w-16" /><Bone className="h-5 w-12" /></div>
        </div>
      ))}
    </div>
  );
}

/** Generic page: header, a stat row, a main column and a side column. */
export function PageSkeleton({ stats = true, label }: { stats?: boolean; label?: string }) {
  return (
    <Loading label={label}>
      <HeaderSkeleton />
      <div className="space-y-6">
        {stats && <StatsSkeleton />}
        <div className="grid gap-6 lg:grid-cols-3">
          <PanelSkeleton className="lg:col-span-2" rows={5} />
          <PanelSkeleton rows={3} />
        </div>
      </div>
    </Loading>
  );
}

export function ListPageSkeleton({ label, actions = 2 }: { label?: string; actions?: number }) {
  return <Loading label={label}><HeaderSkeleton actions={actions} /><TableSkeleton /></Loading>;
}

export function CardsPageSkeleton({ label }: { label?: string }) {
  return <Loading label={label}><HeaderSkeleton /><CardGridSkeleton /></Loading>;
}

export function DetailSkeleton({ label }: { label?: string }) {
  return (
    <Loading label={label}>
      <div className="mx-auto max-w-4xl">
        <HeaderSkeleton actions={2} />
        <div className="space-y-6">
          <div className="surface space-y-3 p-5"><Bone className="h-4 w-32" /><Bone className="h-10 w-full rounded-md" /></div>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="surface space-y-3 p-5"><Bone className="h-4 w-24" /><Bone className="h-28 w-full rounded-md" /></div>
            <div className="surface space-y-3 p-5"><Bone className="h-4 w-28" /><Bone className="h-28 w-full rounded-md" /></div>
          </div>
        </div>
      </div>
    </Loading>
  );
}

export function FormPageSkeleton({ label }: { label?: string }) {
  return (
    <Loading label={label}>
      <div className="mx-auto max-w-3xl">
        <HeaderSkeleton />
        {[0, 1].map((k) => (
          <div className="surface mb-6 p-5" key={k}>
            <Bone className="mb-5 h-4 w-32" />
            <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: 4 }, (_, i) => <div className="space-y-2" key={i}><Bone className="h-3 w-20" /><Bone className="h-9 w-full rounded-md" /></div>)}</div>
          </div>
        ))}
      </div>
    </Loading>
  );
}

export function BookingSkeleton() {
  return (
    <Loading label="Finding times that suit you both">
      <div className="mx-auto max-w-3xl">
        <HeaderSkeleton />
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="surface space-y-4 p-5">
            <div className="flex items-center gap-3"><Bone className="size-9 rounded-full" /><div className="space-y-1.5"><Bone className="h-3.5 w-24" /><Bone className="h-3 w-32" /></div></div>
            <Bone className="h-9 w-full rounded-md" />
            <div className="flex gap-2">{Array.from({ length: 5 }, (_, i) => <Bone className="h-16 flex-1 rounded-md" key={i} />)}</div>
            <Bone className="h-72 w-full rounded-md" />
          </div>
          <div className="surface space-y-4 p-5">{Array.from({ length: 3 }, (_, i) => <div className="space-y-2" key={i}><Bone className="h-3 w-16" /><Bone className="h-9 w-full rounded-md" /></div>)}</div>
        </div>
      </div>
    </Loading>
  );
}
