import { cn } from "@/lib/utils";

export function Logo({ name = "EMP", compact, className }: { name?: string; compact?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative flex size-8 items-center justify-center rounded-[10px] bg-linear-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_4px_12px_-2px_rgb(99_102_241/0.5)]">
        <svg aria-hidden className="size-[18px] text-white" fill="none" viewBox="0 0 24 24">
          <circle cx="8" cy="9" fill="currentColor" r="3.2" />
          <circle cx="16.5" cy="10" fill="currentColor" opacity=".75" r="2.5" />
          <path d="M2.5 19c.6-3 2.8-4.6 5.5-4.6s4.9 1.600 5.500 4.600" stroke="currentColor" strokeLinecap="round" strokeWidth="2.200" />
          <path d="M14.500 15c2.600-.5 5.400.8 6.500 4" opacity=".75" stroke="currentColor" strokeLinecap="round" strokeWidth="2.200" />
        </svg>
      </span>
      {!compact && <span className="font-semibold text-[17px] tracking-tight">{name}</span>}
    </span>
  );
}
