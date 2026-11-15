"use client";

import { ArrowDown, ArrowUp, Check, Languages, RotateCw, Search, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { pickMentor, requestMentor, saveRanking } from "@/actions/matching";
import { ActionButton, ActionForm, Submit } from "@/components/app/action-form";
import { Tag, UserAvatar } from "@/components/app/bits";
import CardFlip from "@/components/kokonutui/card-flip";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type MentorCard = {
  id: string; name: string; avatar: number; headline: string | null; bio: string | null; faculty: string | null;
  expertise: string[]; languages: string[]; spots: number; score: number; reasons: string[]; windows: number;
};

export function MentorChooser({ cards, mode, cohortId, trackId, requested, ranking, maxRequests }: { cards: MentorCard[]; mode: "PICK" | "REQUEST" | "RANK"; cohortId: string; trackId: string; requested: string[]; ranking: string[]; maxRequests: number }) {
  const [q, setQ] = useState("");
  const [asking, setAsking] = useState<MentorCard | null>(null);
  const [rank, setRank] = useState<string[]>(ranking);
  const shown = cards.filter((c) => !q || `${c.name} ${c.headline} ${c.expertise.join(" ")} ${c.faculty}`.toLowerCase().includes(q.toLowerCase()));
  const move = (i: number, d: number) => {
    const next = [...rank];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setRank(next);
  };
  const dirty = JSON.stringify(rank) !== JSON.stringify(ranking);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 size-4 text-muted-foreground" />
        <Input aria-label="Search mentors" className="pl-9" onChange={(e) => setQ(e.target.value)} placeholder="Search by name or expertise" value={q} />
      </div>

      {mode === "RANK" && (
        <ActionForm action={saveRanking.bind(null, cohortId, trackId)} className="surface p-4">
          <input name="ranking" type="hidden" value={JSON.stringify(rank)} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="font-medium text-sm">Your ranking <span className="font-normal text-muted-foreground">({rank.length} of 3)</span></div>
            <Submit disabled={!rank.length || !dirty} size="sm">{dirty ? "Save ranking" : "Saved"}</Submit>
          </div>
          {rank.length === 0 ? <p className="mt-2 text-muted-foreground text-sm">Tap “Add to ranking” on up to three mentors, in order of preference.</p> : (
            <ol className="mt-3 space-y-2">
              {rank.map((id, i) => {
                const c = cards.find((x) => x.id === id);
                if (!c) return null;
                return (
                  <li className="flex items-center gap-3 rounded-xl border bg-card p-2" key={id}>
                    <span className="flex size-7 items-center justify-center rounded-full bg-brand font-semibold text-primary-foreground text-xs">{i + 1}</span>
                    <UserAvatar size="sm" user={c} /><span className="flex-1 truncate font-medium text-sm">{c.name}</span>
                    <Button aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} size="icon" type="button" variant="ghost"><ArrowUp className="size-4" /></Button>
                    <Button aria-label="Move down" disabled={i === rank.length - 1} onClick={() => move(i, 1)} size="icon" type="button" variant="ghost"><ArrowDown className="size-4" /></Button>
                    <Button aria-label="Remove" onClick={() => setRank(rank.filter((x) => x !== id))} size="icon" type="button" variant="ghost"><X className="size-4" /></Button>
                  </li>
                );
              })}
            </ol>
          )}
        </ActionForm>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((c) => {
          const full = c.spots <= 0;
          const sent = requested.includes(c.id);
          const ranked = rank.indexOf(c.id);
          const cta =
            full ? <Button className="w-full" disabled variant="outline">Full</Button>
            : mode === "PICK" ? <ActionButton action={pickMentor.bind(null, cohortId, trackId, c.id)} className="w-full" confirm={`Choose ${c.name} as your mentor? You will be paired straight away.`} confirmLabel="Yes, choose">Choose {c.name.split(" ")[0]}</ActionButton>
            : mode === "REQUEST" ? (sent ? <Button className="w-full" disabled variant="outline"><Check className="size-4" /> Request sent</Button> : <Button className="w-full" disabled={requested.length >= maxRequests} onClick={() => setAsking(c)}>Send request</Button>)
            : ranked >= 0 ? <Button className="w-full" onClick={() => setRank(rank.filter((x) => x !== c.id))} variant="outline"><Check className="size-4" /> Ranked #{ranked + 1}</Button>
            : <Button className="w-full" disabled={rank.length >= 3} onClick={() => setRank([...rank, c.id])}>Add to ranking</Button>;
          return (
            <CardFlip
              back={
                <div className="flex h-full flex-col p-5 text-left">
                  <div className="font-semibold">{c.name}</div>
                  <p className="mt-2 line-clamp-6 flex-1 text-muted-foreground text-sm leading-relaxed">{c.bio || "This mentor has not written a bio yet."}</p>
                  {c.reasons.length > 0 && (
                    <ul className="mt-3 space-y-1.5 border-t pt-3 text-xs">
                      {c.reasons.map((r) => <li className="flex gap-1.5" key={r}><Sparkles className="mt-px size-3.5 shrink-0 text-brand" />{r}</li>)}
                    </ul>
                  )}
                </div>
              }
              className="aspect-auto h-[352px] w-full focus-visible:ring-brand"
              faceClassName="surface overflow-hidden"
              front={
                <div className={cn("flex h-full flex-col p-5 text-left", full && "opacity-60")}>
                  <div className="flex items-start justify-between">
                    <UserAvatar size="lg" user={c} />
                    <span className={cn("rounded-full px-2 py-0.5 font-medium text-xs", full ? "bg-muted text-muted-foreground" : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300")}>{full ? "Full" : `${c.spots} spot${c.spots > 1 ? "s" : ""} left`}</span>
                  </div>
                  <div className="mt-3 font-semibold">{c.name}</div>
                  <p className="line-clamp-2 min-h-10 text-muted-foreground text-sm">{c.headline || c.faculty || "Mentor"}</p>
                  <div className="mt-3 flex flex-1 flex-wrap content-start gap-1.5">{c.expertise.slice(0, 4).map((e) => <Tag key={e}>{e}</Tag>)}</div>
                  <div className="mb-3 flex items-center justify-between text-muted-foreground text-xs">
                    <span className="flex items-center gap-1"><Languages className="size-3.5" />{c.languages.slice(0, 2).join(", ") || "English"}</span>
                    {c.score > 0 && <span className="flex items-center gap-1 font-medium text-brand"><Sparkles className="size-3.5" />{c.score}% fit</span>}
                  </div>
                  {/* stop the click from flipping the card */}
                  <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} role="presentation">{cta}</div>
                  <span className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><RotateCw className="size-3" /> Tap the card for bio and fit</span>
                </div>
              }
              key={c.id}
              label={`${c.name}: flip for bio`}
            />
          );
        })}
      </div>
      {shown.length === 0 && <p className="py-8 text-center text-muted-foreground text-sm">No mentors match “{q}”.</p>}

      <Dialog onOpenChange={(o) => !o && setAsking(null)} open={Boolean(asking)}>
        <DialogContent>
          {asking && (
            <ActionForm action={requestMentor.bind(null, cohortId, trackId, asking.id)} onDone={() => setAsking(null)}>
              <DialogHeader>
                <DialogTitle>Ask {asking.name} to be your mentor</DialogTitle>
                <DialogDescription>A short note helps them say yes. What would you like help with, and why them?</DialogDescription>
              </DialogHeader>
              <Textarea autoFocus className="my-4" maxLength={600} minLength={20} name="note" placeholder="Hi! I am a 100 level student hoping to…" required rows={5} />
              <div className="flex justify-end gap-2"><Button onClick={() => setAsking(null)} type="button" variant="ghost">Cancel</Button><Submit>Send request</Submit></div>
            </ActionForm>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
