import Image from "next/image";
import { cn } from "@/lib/utils";

/** The MSSN crest, navy on light surfaces and white on navy or in dark mode. */
export function Crest({ size = 36, inverse, className }: { size?: number; inverse?: boolean; className?: string }) {
  const h = Math.round(size * 1.09);
  if (inverse) return <Image alt="" className={className} height={h} priority src="/brand/mssn-crest-white.svg" width={size} />;
  return (
    <span className={cn("inline-flex shrink-0", className)}>
      <Image alt="" className="dark:hidden" height={h} priority src="/brand/mssn-crest.svg" width={size} />
      <Image alt="" className="hidden dark:block" height={h} priority src="/brand/mssn-crest-white.svg" width={size} />
    </span>
  );
}

/** Crest plus the EMSS lockup. `compact` shows the crest only. */
export function Logo({ name = "EMSS", compact, inverse, className }: { name?: string; compact?: boolean; inverse?: boolean; className?: string }) {
  return (
    <span aria-label={`${name} Mentorship`} className={cn("inline-flex items-center gap-2.5", className)} role="img">
      <Crest inverse={inverse} size={compact ? 30 : 34} />
      {!compact && (
        <span className={cn("flex flex-col leading-none", inverse ? "text-white" : "text-navy dark:text-white")}>
          <span className="font-bold text-[15px] tracking-tight">{name}</span>
          <span className={cn("mt-1 font-medium text-[11px] uppercase tracking-[0.14em]", inverse ? "text-cyan" : "text-muted-foreground")}>Mentorship</span>
        </span>
      )}
    </span>
  );
}
