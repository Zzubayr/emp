import Link from "next/link";
import { Crest } from "@/components/app/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Crest size={56} />
      <h1 className="mt-6 font-bold text-2xl">We could not find that page</h1>
      <p className="mt-2 max-w-sm text-muted-foreground text-sm">It may have been moved, or you may not have access to it. If you think this is a mistake, contact the program team.</p>
      <Link className="mt-6 inline-flex h-10 items-center rounded-md bg-primary px-5 font-medium text-primary-foreground text-sm" href="/home">Back to home</Link>
    </div>
  );
}
