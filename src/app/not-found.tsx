import { Compass } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl border bg-card text-brand shadow-sm"><Compass className="size-6" /></span>
      <h1 className="mt-5 font-semibold text-2xl">We could not find that page</h1>
      <p className="mt-2 max-w-sm text-muted-foreground text-sm">It may have been moved, or you may not have access to it. If you think this is a mistake, contact the program team.</p>
      <Link className="mt-6 inline-flex h-10 items-center rounded-lg bg-primary px-5 font-medium text-primary-foreground text-sm" href="/home">Back to home</Link>
    </div>
  );
}
