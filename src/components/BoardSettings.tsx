"use client";

import { useState, useTransition } from "react";
import { Check, Globe, Lock } from "lucide-react";
import { toast } from "sonner";
import { setBoardMemberIds, setBoardRoom } from "@/app/actions";
import { Avatar } from "@/components/atoms";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { AccessImpact } from "@/lib/board-access";
import { WORK_ROOMS, type WorkRoom } from "@/lib/rooms";
import { displayName, type Member } from "@/lib/types";
import { cn } from "@/lib/utils";

export type BoardInfo = {
  id: string;
  name: string;
  /** The office room this board's people sit in. */
  room: WorkRoom;
  /** Which board has each themed room (by name; "" for a board the viewer can't see). */
  roomBoards: Partial<Record<WorkRoom, string>>;
  createdBy: string | null;
  /** Who may see the board; empty means everyone. */
  memberIds: string[];
  /** The viewer is the creator or an admin, so may change memberIds. */
  canManage: boolean;
};

/** Board settings: the office room its people sit in, and who may see it. */
export function BoardSettings({ board, members, open, onOpenChange }: { board: BoardInfo; members: Member[]; open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const s = t.boardSettings;
  const [room, setRoom] = useState(board.room);
  // Access is staged: ticks change nothing until Save, which may first ask to confirm unassigning.
  const [saved, setSaved] = useState(board.memberIds);
  const [picked, setPicked] = useState(board.memberIds);
  const [impact, setImpact] = useState<AccessImpact | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = picked.length !== saved.length || picked.some((id) => !saved.includes(id));
  const creator = members.find((m) => m.id === board.createdBy);
  const others = members.filter((m) => m.id !== board.createdBy);

  const saveRoom = (next: WorkRoom) => {
    const before = room;
    setRoom(next);
    startTransition(async () => {
      try {
        await setBoardRoom(board.id, next);
      } catch {
        setRoom(before);
        toast.error(s.saveFailed);
      }
    });
  };
  const toggle = (id: string) => setPicked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const saveAccess = (confirmed: boolean) =>
    startTransition(async () => {
      try {
        const res = await setBoardMemberIds(board.id, picked, confirmed);
        if (res.saved) {
          setSaved(picked);
          setImpact(null);
        } else setImpact(res.impact);
      } catch {
        toast.error(s.saveFailed);
      }
    });
  const restricted = picked.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{s.title(board.name)}</DialogTitle>
          <DialogDescription>{s.description}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          <Label>{s.room}</Label>
          <Select value={room} onValueChange={(v) => saveRoom(v as WorkRoom)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WORK_ROOMS.map((r) => {
                // Another board's room: picking it swaps the two boards' rooms.
                const holder = r === board.room ? undefined : board.roomBoards[r];
                return (
                  <SelectItem key={r} value={r}>
                    {t.rooms[r]}
                    {r === "back_office" ? (
                      <span className="text-muted-foreground"> · {s.shared}</span>
                    ) : (
                      holder !== undefined && <span className="text-muted-foreground"> · {holder ? s.swapWith(holder) : s.taken}</span>
                    )}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{s.roomHint}</p>
        </div>

        <div className="grid gap-2">
          <Label>{s.access}</Label>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {restricted ? <Lock className="size-3.5" /> : <Globe className="size-3.5" />}
            {restricted ? s.restricted(picked.length) : s.everyone}
          </p>
          <ul className="max-h-64 overflow-y-auto rounded-md border">
            {creator && (
              <li className="flex items-center gap-2 border-b px-3 py-2 text-sm">
                <Avatar member={creator} size={22} className="ring-0" />
                <span className="min-w-0 flex-1 truncate">{displayName(creator)}</span>
                <span className="text-xs text-muted-foreground">{s.owner}</span>
              </li>
            )}
            {others.map((m) => {
              const on = picked.includes(m.id);
              return (
                <li key={m.id} className="border-b last:border-b-0">
                  <button
                    type="button"
                    disabled={!board.canManage}
                    onClick={() => toggle(m.id)}
                    aria-pressed={on}
                    className={cn("flex w-full items-center gap-2 px-3 py-2 text-left text-sm", board.canManage ? "cursor-pointer hover:bg-accent" : "cursor-default")}
                  >
                    <Avatar member={m} size={22} className="ring-0" />
                    <span className="min-w-0 flex-1 truncate">{displayName(m)}</span>
                    <span className={cn("grid size-4 place-items-center rounded-sm border", on ? "border-primary bg-primary text-primary-foreground" : "border-border-strong")}>
                      {on && <Check className="size-3" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!board.canManage && <p className="text-xs text-muted-foreground">{s.onlyOwner}</p>}
          {board.canManage && dirty && (
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPicked(saved)}>
                {s.reset}
              </Button>
              <Button size="sm" disabled={pending} onClick={() => saveAccess(false)}>
                {s.saveAccess}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>

      {/* Asked when the new access would unassign people from open cards */}
      <Dialog open={!!impact} onOpenChange={(o) => !o && setImpact(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{saved.length === 0 ? s.confirmPrivateTitle : s.confirmNarrowTitle}</DialogTitle>
            <DialogDescription>{impact && s.confirmBody(impact.cards, impact.people)}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{s.cancel}</Button>
            </DialogClose>
            <Button variant="destructive" disabled={pending} onClick={() => saveAccess(true)}>
              {saved.length === 0 ? s.confirmPrivate : s.confirmNarrow}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
