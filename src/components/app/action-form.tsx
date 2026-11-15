"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createContext, useContext, useRef, useState, useTransition, type ComponentProps, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ActionResult = { ok: true; message?: string; redirect?: string } | { ok: false; error: string };
type FormAction = (data: FormData) => Promise<ActionResult>;

const Pending = createContext(false);

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, after?: (r: ActionResult) => void) =>
    start(async () => {
      let r: ActionResult;
      try {
        r = await fn();
      } catch {
        r = { ok: false, error: "Something went wrong. Please try again." };
      }
      if (r.ok) {
        if (r.message) toast.success(r.message);
        if (r.redirect) router.push(r.redirect);
        else router.refresh();
      } else toast.error(r.error);
      after?.(r);
    });
  return { pending, run };
}

export function ActionForm({
  action, children, className, resetOnSuccess, onDone, ...rest
}: { action: FormAction; children: ReactNode; resetOnSuccess?: boolean; onDone?: () => void } & Omit<ComponentProps<"form">, "action">) {
  const ref = useRef<HTMLFormElement>(null);
  const { pending, run } = useRun();
  return (
    <form
      {...rest}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        run(() => action(data), (r) => {
          if (r.ok) {
            if (resetOnSuccess) ref.current?.reset();
            onDone?.();
          }
        });
      }}
      ref={ref}
    >
      <Pending.Provider value={pending}>{children}</Pending.Provider>
    </form>
  );
}

export function Submit({ children, className, ...props }: ComponentProps<typeof Button>) {
  const pending = useContext(Pending);
  return (
    <Button {...props} className={cn("min-w-24", className)} disabled={pending || props.disabled} type="submit">
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </Button>
  );
}

/** One-click server action, with an optional confirmation step. */
export function ActionButton({
  action, children, confirm, confirmLabel = "Confirm", destructive, ...props
}: { action: () => Promise<ActionResult>; confirm?: string; confirmLabel?: string; destructive?: boolean } & Omit<ComponentProps<typeof Button>, "onClick">) {
  const { pending, run } = useRun();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button {...props} disabled={pending || props.disabled} onClick={() => (confirm ? setOpen(true) : run(action))} type="button">
        {pending && <Loader2 className="size-4 animate-spin" />}
        {children}
      </Button>
      {confirm && (
        <AlertDialog onOpenChange={setOpen} open={open}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>{confirm}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className={destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
                onClick={() => run(action)}
              >
                {confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
