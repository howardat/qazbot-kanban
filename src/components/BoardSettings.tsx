"use client";

import { useState, useTransition } from "react";
import { Check, Globe, Lock } from "lucide-react";
import { toast } from "sonner";
import { setBoardMemberIds, setBoardRoom } from "@/app/actions";
import { Avatar } from "@/components/atoms";
import { useT } from "@/components/I18nProvider";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WORK_ROOMS, type WorkRoom } from "@/lib/rooms";
import { displayName, type Member } from "@/lib/types";
import { cn } from "@/lib/utils";

export type BoardInfo = {
  id: string;
  name: string;
  room: WorkRoom;
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
  const [picked, setPicked] = useState(board.memberIds);
  const [, startTransition] = useTransition();
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
  const toggle = (id: string) => {
    const before = picked;
    const next = picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id];
    setPicked(next);
    startTransition(async () => {
      try {
        await setBoardMemberIds(board.id, next);
      } catch {
        setPicked(before);
        toast.error(s.saveFailed);
      }
    });
  };
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
              {WORK_ROOMS.map((r) => (
                <SelectItem key={r} value={r}>
                  {t.rooms[r]}
                </SelectItem>
              ))}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
