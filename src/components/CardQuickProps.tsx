"use client";

import { useState } from "react";
import { enGB, ru } from "react-day-picker/locale";
import { CalendarPlus, Check, Flag, Minus, UserPlus, X } from "lucide-react";
import { Avatar, AvatarStack, DueBadge } from "@/components/atoms";
import { PriorityIcon } from "@/components/BoardToolbar";
import { useT } from "@/components/I18nProvider";
import { Calendar } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ISODate } from "@/lib/dates";
import { PRIORITIES } from "@/lib/priority";
import { displayName, type CardData, type Member } from "@/lib/types";
import { cn } from "@/lib/utils";

export type QuickPatch = Partial<Pick<CardData, "dueDate" | "assigneeIds" | "priority">>;

const toDate = (iso: string) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Plane's property chips: 20px tall, hairline border, small text. Fields without a value still show as
// an icon-only chip (as in Plane), so every card has the same row and anything can be set in one click.
const ghost =
  "inline-flex h-5 cursor-pointer items-center gap-1 rounded-sm border-[0.5px] border-border-strong px-1.5 text-[11px] text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";
// Empty chips go after the set ones (flex order).
const hidden = "order-1";
const chip = "cursor-pointer rounded-sm outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50";

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
  show,
  onPatch,
  children,
}: {
  card: CardData;
  members: Member[];
  today: ISODate;
  done: boolean;
  /** Which properties the board's Display menu shows. */
  show: { priority: boolean; dates: boolean; assignees: boolean };
  onPatch: (patch: QuickPatch) => void;
  /** Read-only chips (tags) placed after the dates. */
  children?: React.ReactNode;
}) {
  const t = useT();
  const [dateOpen, setDateOpen] = useState(false);
  // Keep the chips' own clicks (and their portaled menus') from opening or dragging the card; a click on
  // the empty part of the row still falls through to the card.
  const stop = (e: React.SyntheticEvent) => {
    const target = e.target as Element;
    const control = target.closest("button, a, input, [role=button]");
    if (!e.currentTarget.contains(target) || (control && e.currentTarget.contains(control))) e.stopPropagation();
  };
  const people = card.assigneeIds.map((id) => members.find((m) => m.id === id)).filter((m): m is Member => !!m);
  const toggle = (id: string) =>
    onPatch({ assigneeIds: card.assigneeIds.includes(id) ? card.assigneeIds.filter((x) => x !== id) : [...card.assigneeIds, id] });

  return (
    <div className="flex flex-wrap items-center gap-2 pt-3" onPointerDown={stop} onClick={stop} onKeyDown={stop}>
      {/* Priority */}
      {show.priority && (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {card.priority ? (
            // Icon only, in a bordered square; the name is in the tooltip.
            <button
              type="button"
              className={cn(chip, "grid size-5 place-items-center border-[0.5px] border-border-strong", card.priority === "urgent" && "border-red-500/40 bg-red-500/10")}
              aria-label={`${t.quick.priority}: ${t.priority[card.priority]}`}
              title={t.priority[card.priority]}
            >
              <PriorityIcon priority={card.priority} className="size-3" />
            </button>
          ) : (
            <button type="button" className={cn(ghost, hidden)} aria-label={t.quick.priority} title={t.quick.priority}>
              <Flag className="size-3" />
            </button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44" onClick={stop}>
          {PRIORITIES.map((p) => (
            <DropdownMenuItem key={p} onSelect={() => onPatch({ priority: p })}>
              <PriorityIcon priority={p} /> {t.priority[p]}
              {card.priority === p && <Check className="ml-auto" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onPatch({ priority: null })}>
            <Minus className="text-muted-foreground" /> {t.priority.none}
            {!card.priority && <Check className="ml-auto" />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      )}

      {/* Deadline */}
      {show.dates && (
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          {card.dueDate || card.startDate ? (
            <button type="button" className={chip} aria-label={t.quick.deadline}>
              <DueBadge start={card.startDate} due={card.dueDate} today={today} done={done} />
            </button>
          ) : (
            <button type="button" className={cn(ghost, hidden)} aria-label={t.quick.deadline} title={t.quick.deadline}>
              <CalendarPlus className="size-3" />
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
      )}

      {children}

      {/* Assignees */}
      {show.assignees && (
      <span className="order-2 ml-auto">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            {people.length ? (
              <button type="button" className={cn(chip, "rounded-full")} aria-label={t.quick.assignees}>
                <AvatarStack members={people} size={20} />
              </button>
            ) : (
              <button type="button" className={cn(ghost, hidden)} aria-label={t.quick.assignees} title={t.quick.assignees}>
                <UserPlus className="size-3" />
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
      )}
    </div>
  );
}
