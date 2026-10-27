"use client";

import { useState } from "react";
import { enGB, ru } from "react-day-picker/locale";
import { CalendarPlus, Check, Flag, UserPlus, X } from "lucide-react";
import { Avatar, AvatarStack, DueBadge } from "@/components/atoms";
import { useT } from "@/components/I18nProvider";
import { Calendar } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ISODate } from "@/lib/dates";
import { PRIORITIES, PRIORITY_STYLE } from "@/lib/priority";
import { displayName, type CardData, type Member } from "@/lib/types";
import { cn } from "@/lib/utils";

export type QuickPatch = Partial<Pick<CardData, "dueDate" | "assigneeIds" | "priority">>;

const toDate = (iso: string) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Set values show as chips; unset ones are faint icon buttons that appear on hover (always on touch).
const ghost =
  "inline-flex h-6 cursor-pointer items-center gap-1 rounded-md border border-dashed px-1.5 text-xs text-muted-foreground outline-none hover:border-border-strong hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:opacity-100";
// Unset buttons go after the set chips (flex order), so their hidden space never opens a gap.
const hidden = "order-1 opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100";
const chip = "cursor-pointer rounded-md outline-none hover:ring-2 hover:ring-border focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Quick buttons on a board card for deadline, priority and assignees. Each opens a small picker and
 * saves right away through onPatch. Lives inside the draggable card, so its pointer and key events
 * don't start a drag or open the card.
 */
export function CardQuickProps({
  card,
  members,
  today,
  done,
  onPatch,
}: {
  card: CardData;
  members: Member[];
  today: ISODate;
  done: boolean;
  onPatch: (patch: QuickPatch) => void;
}) {
  const t = useT();
  const [dateOpen, setDateOpen] = useState(false);
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  const people = card.assigneeIds.map((id) => members.find((m) => m.id === id)).filter((m): m is Member => !!m);
  const toggle = (id: string) =>
    onPatch({ assigneeIds: card.assigneeIds.includes(id) ? card.assigneeIds.filter((x) => x !== id) : [...card.assigneeIds, id] });

  return (
    <div className="flex flex-wrap items-center gap-1.5" onPointerDown={stop} onClick={stop} onKeyDown={stop}>
      {/* Priority */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {card.priority ? (
            <button type="button" className={cn(chip, "inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-xs font-medium")} aria-label={t.quick.priority}>
              <Flag className={cn("size-3.5", PRIORITY_STYLE[card.priority])} fill="currentColor" />
              {t.priority[card.priority]}
            </button>
          ) : (
            <button type="button" className={cn(ghost, hidden)} aria-label={t.quick.priority} title={t.quick.priority}>
              <Flag className="size-3.5" />
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44" onClick={stop}>
          {PRIORITIES.map((p) => (
            <DropdownMenuItem key={p} onSelect={() => onPatch({ priority: p })}>
              <Flag className={PRIORITY_STYLE[p]} fill="currentColor" /> {t.priority[p]}
              {card.priority === p && <Check className="ml-auto" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onPatch({ priority: null })}>
            <Flag className="text-muted-foreground" /> {t.priority.none}
            {!card.priority && <Check className="ml-auto" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Deadline */}
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          {card.dueDate || card.startDate ? (
            <button type="button" className={chip} aria-label={t.quick.deadline}>
              <DueBadge start={card.startDate} due={card.dueDate} today={today} done={done} />
            </button>
          ) : (
            <button type="button" className={cn(ghost, hidden)} aria-label={t.quick.deadline} title={t.quick.deadline}>
              <CalendarPlus className="size-3.5" />
            </button>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-auto rounded-2xl p-0" align="start" onClick={stop}>
          <Calendar
            mode="single"
            locale={t.locale === "ru" ? ru : enGB}
            weekStartsOn={1}
            selected={card.dueDate ? toDate(card.dueDate) : undefined}
            defaultMonth={card.dueDate ? toDate(card.dueDate) : undefined}
            onSelect={(d) => {
              onPatch({ dueDate: d ? toISO(d) : null });
              setDateOpen(false);
            }}
          />
          {card.dueDate && (
            <button
              type="button"
              onClick={() => {
                onPatch({ dueDate: null });
                setDateOpen(false);
              }}
              className="flex w-full cursor-pointer items-center justify-center gap-1 border-t px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" /> {t.quick.clearDeadline}
            </button>
          )}
        </PopoverContent>
      </Popover>

      {/* Assignees */}
      <span className="order-2 ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {people.length ? (
              <button type="button" className={cn(chip, "rounded-full")} aria-label={t.quick.assignees}>
                <AvatarStack members={people} size={20} />
              </button>
            ) : (
              <button type="button" className={cn(ghost, hidden)} aria-label={t.quick.assignees} title={t.quick.assignees}>
                <UserPlus className="size-3.5" />
              </button>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-72 w-56 overflow-y-auto" onClick={stop}>
            {members.map((m) => (
              <DropdownMenuItem
                key={m.id}
                onSelect={(e) => {
                  e.preventDefault(); // keep the menu open to pick several people
                  toggle(m.id);
                }}
              >
                <Avatar member={m} size={20} className="ring-0" />
                <span className="min-w-0 flex-1 truncate">{displayName(m)}</span>
                {card.assigneeIds.includes(m.id) && <Check />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </div>
  );
}
