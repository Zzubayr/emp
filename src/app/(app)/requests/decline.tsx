"use client";

import { useState } from "react";
import { respondRequest } from "@/actions/matching";
import { ActionForm, Submit } from "@/components/app/action-form";
import { NativeSelect } from "@/components/app/bits";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function DeclineButton({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} size="sm" variant="ghost">Decline</Button>
      <Dialog onOpenChange={setOpen} open={open}>
        <DialogContent>
          <ActionForm action={respondRequest.bind(null, id, false)} onDone={() => setOpen(false)}>
            <DialogHeader>
              <DialogTitle>Decline {name}'s request?</DialogTitle>
              <DialogDescription>They can choose another mentor straight away. The reason is shared with the program team only.</DialogDescription>
            </DialogHeader>
            <NativeSelect className="my-4" name="reason">
              <option>I do not have the time right now</option>
              <option>Their goals are outside my experience</option>
              <option>I am at capacity</option>
              <option>Other</option>
            </NativeSelect>
            <div className="flex justify-end gap-2"><Button onClick={() => setOpen(false)} type="button" variant="ghost">Cancel</Button><Submit variant="destructive">Decline request</Submit></div>
          </ActionForm>
        </DialogContent>
      </Dialog>
    </>
  );
}
