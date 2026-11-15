"use client";

import { useState } from "react";
import { cancelSession } from "@/actions/sessions";
import { ActionForm, Submit } from "@/components/app/action-form";
import { NativeSelect } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function CancelButton({ id, late, hours }: { id: string; late: boolean; hours: number }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="text-destructive hover:text-destructive" onClick={() => setOpen(true)} variant="ghost">Cancel session</Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <ActionForm action={cancelSession.bind(null, id)} onDone={() => setOpen(false)}>
            <DialogHeader>
              <DialogTitle>Cancel this session?</DialogTitle>
              <DialogDescription>{late ? `This is less than ${hours} hours away, so it will count as a late cancellation.` : "Your partner will be told straight away. If you just need a different time, reschedule instead."}</DialogDescription>
            </DialogHeader>
            <NativeSelect className="my-4" name="reason" required>
              <option value="">Choose a reason…</option>
              <option>Schedule clash</option><option>Exams or coursework</option><option>Feeling unwell</option><option>Work commitment</option><option>Technical problem</option><option>Something else</option>
            </NativeSelect>
            <div className="flex justify-end gap-2"><Button onClick={() => setOpen(false)} type="button" variant="ghost">Keep session</Button><Submit variant="destructive">Cancel session</Submit></div>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
