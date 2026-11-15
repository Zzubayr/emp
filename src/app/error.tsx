"use client";

import { RotateCw, TriangleAlert } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl border bg-card text-amber-500 shadow-sm"><TriangleAlert className="size-6" /></span>
      <h1 className="mt-5 font-semibold text-2xl">Something went wrong on our side</h1>
      <p className="mt-2 max-w-sm text-muted-foreground text-sm">Nothing you did was lost. Try again, and if it keeps happening, let the program team know what you were doing.</p>
      <button className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 font-medium text-primary-foreground text-sm" onClick={reset} type="button"><RotateCw className="size-4" /> Try again</button>
    </div>
  );
}
