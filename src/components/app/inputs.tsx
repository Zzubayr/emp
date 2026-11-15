"use client";

import { Check, Plus, Star, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { fmtMinutes } from "@/lib/time";
import { cn } from "@/lib/utils";

export function TagPicker({ name, options, defaultValue = [], max = 8 }: { name: string; options: string[]; defaultValue?: string[]; max?: number }) {
  const [sel, setSel] = useState<string[]>(defaultValue);
  const all = [...new Set([...options, ...defaultValue])];
  return (
    <div>
      <input name={name} type="hidden" value={JSON.stringify(sel)} />
      <div className="flex flex-wrap gap-2">
        {all.map((o) => {
          const on = sel.includes(o);
          return (
            <button
              aria-pressed={on}
              className={cn(
                "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-[background-color,border-color,scale] duration-150 active:scale-[0.97]",
                on ? "border-brand bg-brand text-primary-foreground" : "bg-card hover:border-brand/50 hover:bg-brand-soft",
              )}
              key={o}
              onClick={() => setSel(on ? sel.filter((x) => x !== o) : sel.length >= max ? sel : [...sel, o])}
              type="button"
            >
              {on && <Check className="size-3.5" />}
              {o}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-muted-foreground text-xs">{sel.length} of {max} selected</p>
    </div>
  );
}

export function StarInput({ name, label, hint }: { name: string; label: string; hint?: string }) {
  const [v, setV] = useState(0);
  const [hover, setHover] = useState(0);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <div className="font-medium text-sm">{label}</div>
        {hint && <div className="text-muted-foreground text-xs">{hint}</div>}
      </div>
      <input name={name} required type="hidden" value={v || ""} />
      <div aria-label={label} className="flex" onMouseLeave={() => setHover(0)} role="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            aria-checked={v === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className="flex size-11 items-center justify-center rounded-lg transition-transform duration-150 hover:scale-110 active:scale-95"
            key={n}
            onClick={() => setV(n)}
            onMouseEnter={() => setHover(n)}
            role="radio"
            type="button"
          >
            <Star className={cn("size-7 transition-colors", (hover || v) >= n ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40")} />
          </button>
        ))}
      </div>
    </div>
  );
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIMES = Array.from({ length: 33 }, (_, i) => 6 * 60 + i * 30); // 6:00 AM to 10:00 PM

export type Rule = { weekday: number; startMin: number; endMin: number };

export function AvailabilityEditor({ name, defaultValue }: { name: string; defaultValue: Rule[] }) {
  const [rules, setRules] = useState<Rule[]>(defaultValue);
  const set = (i: number, patch: Partial<Rule>) => setRules(rules.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      <input name={name} type="hidden" value={JSON.stringify(rules)} />
      {[1, 2, 3, 4, 5, 6, 0].map((wd) => {
        const mine = rules.map((r, i) => ({ r, i })).filter((x) => x.r.weekday === wd);
        return (
          <div className="flex flex-col gap-2 rounded-xl border bg-card/50 p-3 sm:flex-row sm:items-start" key={wd}>
            <div className="flex w-28 shrink-0 items-center justify-between pt-1.5 sm:block">
              <span className={cn("font-medium text-sm", !mine.length && "text-muted-foreground")}>{DAYS[wd]}</span>
            </div>
            <div className="flex-1 space-y-2">
              {mine.length === 0 && <p className="pt-1.5 text-muted-foreground text-sm">Unavailable</p>}
              {mine.map(({ r, i }) => (
                <div className="flex items-center gap-2" key={i}>
                  <select aria-label={`${DAYS[wd]} start`} className="h-9 rounded-md border bg-transparent px-2 text-sm" onChange={(e) => set(i, { startMin: +e.target.value, endMin: Math.max(r.endMin, +e.target.value + 30) })} value={r.startMin}>
                    {TIMES.slice(0, -1).map((t) => <option key={t} value={t}>{fmtMinutes(t)}</option>)}
                  </select>
                  <span className="text-muted-foreground text-sm">to</span>
                  <select aria-label={`${DAYS[wd]} end`} className="h-9 rounded-md border bg-transparent px-2 text-sm" onChange={(e) => set(i, { endMin: +e.target.value })} value={r.endMin}>
                    {TIMES.filter((t) => t > r.startMin).map((t) => <option key={t} value={t}>{fmtMinutes(t)}</option>)}
                  </select>
                  <Button aria-label="Remove window" onClick={() => setRules(rules.filter((_, j) => j !== i))} size="icon" type="button" variant="ghost">
                    <Trash2 className="size-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              className="self-start"
              onClick={() => {
                const last = mine[mine.length - 1]?.r;
                const start = last ? Math.min(last.endMin + 60, 20 * 60) : 16 * 60;
                setRules([...rules, { weekday: wd, startMin: start, endMin: Math.min(start + 120, 22 * 60) }]);
              }}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Plus className="size-4" /> Add
            </Button>
          </div>
        );
      })}
    </div>
  );
}
