"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { addCard, rescheduleCard } from "@/app/actions";
import { CardEditor } from "@/components/CardEditor";
import { useT } from "@/components/I18nProvider";
import { AvatarStack } from "@/components/atoms";
import { addDays, monthOf, weekday, type ISODate } from "@/lib/dates";
import type { CardRow, Member, Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

const MONTH_CAP = 3; // chips per day before "N more", as in Plane's month layout

/** A board a quick-added card can land on, and the open column it goes into. */
export type QuickAddTarget = { boardId: string; name: string; columnId: string };

export function CalendarView({
  view,
  days: allDays,
  month,
  weekends,
  today,
  cards: initial,
  members,
  tags,
  showBoard,
  targets,
}: {
  view: "month" | "week";
  days: ISODate[];
  month: string | null;
  weekends: boolean;
  today: ISODate;
  cards: CardRow[];
  members: Member[];
  tags: Tag[];
  showBoard: boolean;
  targets: QuickAddTarget[];
}) {
  const t = useT();
  const dndId = useId();
  const [cards, setCards] = useState(initial);
  const [dragging, setDragging] = useState<CardRow | null>(null);
  const [editing, setEditing] = useState<CardRow | null>(null);
  const [targetId, setTargetId] = useState(targets[0]?.boardId ?? "");
  const [, startTransition] = useTransition();
  useEffect(() => setCards(initial), [initial]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);
  const days = weekends ? allDays : allDays.filter((d) => weekday(d) < 5);
  const cols = weekends ? 7 : 5;

  const byDay = useMemo(() => {
    const m = new Map<string, CardRow[]>();
    for (const c of cards) if (c.dueDate) m.set(c.dueDate, [...(m.get(c.dueDate) ?? []), c]);
    return m;
  }, [cards]);
  const unscheduled = cards.filter((c) => !c.dueDate && !c.done);

  function onDragEnd(e: DragEndEvent) {
    setDragging(null);
    const day = e.over?.id ? String(e.over.id) : null;
    const card = cards.find((c) => c.id === e.active.id);
    if (!day || !card || card.dueDate === day) return;
    setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, dueDate: day } : c)));
    startTransition(() => rescheduleCard(card.id, day));
  }

  const ctx = { memberById, tagById, today, showBoard, onOpen: setEditing };
  const quickAdd = { targets, targetId, setTargetId };

  return (
    <DndContext
      id={dndId}
      sensors={sensors}
      onDragStart={(e) => setDragging(cards.find((c) => c.id === e.active.id) ?? null)}
      onDragEnd={onDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="overflow-x-auto rounded-lg border bg-card shadow-xs">
          <div className={cn("grid", cols === 7 ? "min-w-[46rem] grid-cols-7" : "min-w-[34rem] grid-cols-5")}>
            {/* Weekday names from a known Monday (5 Jan 2026), in the viewer's language */}
            {Array.from({ length: cols }, (_, i) => (
              <div key={i} className={cn("flex h-11 items-center justify-end border-b bg-muted/35 px-4 text-[13px] font-medium capitalize", i < cols - 1 && "border-r border-r-border/70")}>
                {t.fmt.weekday(addDays("2026-01-05", i))}
              </div>
            ))}
            {days.map((day, i) => (
              <DayCell
                key={day}
                day={day}
                view={view}
                inMonth={!month || monthOf(day) === month}
                weekend={weekday(day) >= 5}
                isToday={day === today}
                lastCol={i % cols === cols - 1}
                lastRow={i >= days.length - cols}
                cards={byDay.get(day) ?? []}
                ctx={ctx}
                quickAdd={quickAdd}
              />
            ))}
          </div>
        </div>

        <aside className="self-start overflow-hidden rounded-lg border bg-card shadow-xs">
          <div className="border-b px-4 py-2.5">
            <h2 className="text-sm font-medium">{t.calendar.noDeadline}</h2>
            <p className="text-xs text-muted-foreground">{t.calendar.noDeadlineHint}</p>
          </div>
          <div className="flex max-h-[28rem] min-h-16 flex-col gap-1 overflow-y-auto p-2">
            {unscheduled.map((c) => (
              <Chip key={c.id} card={c} {...ctx} />
            ))}
            {unscheduled.length === 0 && <p className="px-1 text-xs text-muted-foreground">{t.calendar.allScheduled}</p>}
          </div>
        </aside>
      </div>

      <DragOverlay>{dragging && <ChipBody card={dragging} {...ctx} overlay />}</DragOverlay>

      {editing && (
        <CardEditor
          card={editing}
          members={members}
          boardTags={tags.filter((t) => t.boardId === editing.boardId)}
          boardName={editing.boardName}
          onClose={() => setEditing(null)}
        />
      )}
    </DndContext>
  );
}

type QuickAddCtx = { targets: QuickAddTarget[]; targetId: string; setTargetId: (id: string) => void };

function DayCell({
  day,
  view,
  inMonth,
  weekend,
  isToday,
  lastCol,
  lastRow,
  cards,
  ctx,
  quickAdd,
}: {
  day: ISODate;
  view: "month" | "week";
  inMonth: boolean;
  weekend: boolean;
  isToday: boolean;
  lastCol: boolean;
  lastRow: boolean;
  cards: CardRow[];
  ctx: ChipCtx;
  quickAdd: QuickAddCtx;
}) {
  const t = useT();
  const { setNodeRef, isOver } = useDroppable({ id: day });
  const [expanded, setExpanded] = useState(false);
  const capped = view === "month" && !expanded && cards.length > MONTH_CAP + 1;
  const shown = capped ? cards.slice(0, MONTH_CAP) : cards;
  const date = +day.slice(8);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group/day relative flex flex-col",
        view === "week" ? "min-h-[26rem]" : "min-h-28",
        !lastCol && "border-r border-r-border/70",
        !lastRow && "border-b border-b-border/70",
        weekend && "bg-muted/25",
        isOver && "bg-brand-soft opacity-80",
      )}
    >
      {/* Plane's day header: number top-right, month name on the 1st, today filled */}
      <div className={cn("flex items-center justify-end gap-1 px-2 py-1.5 text-[11px]", inMonth ? "font-medium" : "text-muted-foreground/60", weekend && "bg-muted/35")}>
        {(date === 1 || view === "week") && <span className="text-muted-foreground">{t.fmt.monthShort(day)}</span>}
        <span
          className={cn(
            "inline-flex size-5 items-center justify-center rounded-full",
            isToday && "bg-primary font-semibold text-primary-foreground",
          )}
          aria-current={isToday ? "date" : undefined}
        >
          {date}
        </span>
      </div>
      <div className="flex flex-col gap-1 px-1.5 pb-1.5">
        {shown.map((c) => (
          <Chip key={c.id} card={c} {...ctx} />
        ))}
        {capped && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="w-fit cursor-pointer rounded-sm px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-accent"
          >
            {t.calendar.more(cards.length - MONTH_CAP)}
          </button>
        )}
      </div>
      {quickAdd.targets.length > 0 && (
        <div className="px-1.5 pb-1.5">
          <DayQuickAdd day={day} {...quickAdd} />
        </div>
      )}
    </div>
  );
}

/** Add a card due on this day without leaving the calendar. Shown on hover, like Plane's. */
function DayQuickAdd({ day, targets, targetId, setTargetId }: { day: ISODate } & QuickAddCtx) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  const target = targets.find((x) => x.boardId === targetId) ?? targets[0];

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 flex w-full cursor-pointer items-center gap-1 rounded-sm px-1.5 py-1 text-[11px] text-muted-foreground opacity-0 outline-none group-hover/day:opacity-100 hover:bg-accent hover:text-foreground focus-visible:opacity-100 [@media(hover:none)]:hidden"
      >
        <Plus className="size-3" /> {t.calendar.addCard}
      </button>
    );
  }
  return (
    <form
      className="mt-1 flex flex-col gap-1 rounded-sm border bg-card p-1 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        startTransition(async () => {
          await addCard(target.columnId, title, { dueDate: day });
          setTitle("");
        });
      }}
    >
      <input
        autoFocus
        value={title}
        disabled={pending}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        onBlur={(e) => !title.trim() && !e.currentTarget.form?.contains(e.relatedTarget) && setOpen(false)}
        placeholder={t.calendar.quickAddPlaceholder}
        aria-label={t.calendar.quickAddAria(day)}
        className="h-6 w-full min-w-0 bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground/70"
      />
      {targets.length > 1 && (
        <select
          value={target.boardId}
          onChange={(e) => setTargetId(e.target.value)}
          aria-label={t.common.board}
          className="h-6 w-full min-w-0 rounded-sm bg-muted px-1 text-[11px] text-muted-foreground outline-none"
        >
          {targets.map((x) => (
            <option key={x.boardId} value={x.boardId}>
              {x.name}
            </option>
          ))}
        </select>
      )}
    </form>
  );
}

type ChipCtx = {
  memberById: Map<string, Member>;
  tagById: Map<string, Tag>;
  today: ISODate;
  showBoard: boolean;
  onOpen: (c: CardRow) => void;
};

function Chip({ card, ...ctx }: { card: CardRow } & ChipCtx) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: card.id });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={() => ctx.onOpen(card)} className={isDragging ? "opacity-30" : ""}>
      <ChipBody card={card} {...ctx} />
    </div>
  );
}

// Plane's calendar block: a thin bar in the card's state colour, then the title. Red when late.
function ChipBody({ card, memberById, today, showBoard, overlay }: { card: CardRow; overlay?: boolean } & ChipCtx) {
  const late = !card.done && !!card.dueDate && card.dueDate < today;
  const people = card.assigneeIds.map((id) => memberById.get(id)).filter((m): m is Member => !!m);
  return (
    <div
      className={cn(
        "flex h-7 cursor-pointer items-center gap-1.5 rounded-sm border bg-card pr-1 text-[11px] font-medium hover:border-border-strong",
        late && "border-destructive/30 bg-destructive/5",
        card.done && "text-muted-foreground line-through",
        overlay && "shadow-lg",
      )}
      title={`${card.title} (${card.boardName}, ${card.columnName})`}
    >
      <span
        className={cn(
          "ml-1 h-4 w-0.5 shrink-0 rounded-full",
          late ? "bg-destructive" : card.done ? "bg-success" : card.inProgress ? "bg-warning" : "bg-muted-foreground/40",
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1 truncate">
        {card.title}
        {showBoard && <span className="ml-1 text-muted-foreground">{card.boardName}</span>}
      </span>
      <AvatarStack members={people} max={1} size={16} />
    </div>
  );
}
