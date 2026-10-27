"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { setCardDates } from "@/app/actions";
import { CardEditor } from "@/components/CardEditor";
import { useT } from "@/components/I18nProvider";
import { AvatarStack } from "@/components/atoms";
import { StateIcon } from "@/components/BoardToolbar";
import { addDays, diffDays, weekday, type ISODate } from "@/lib/dates";
import type { CardRow, Member, Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

const ROW_H = 40;
const SIDE_W = 224; // the sticky card-name column

type Dates = { startDate: string | null; dueDate: string | null };
type DragMode = "move" | "left" | "right";
type Drag = { id: string; mode: DragMode; delta: number; moved: boolean };

/**
 * New dates after dragging by `d` days. Moving keeps which ends are set; resizing makes both ends explicit.
 * A card with only one date is a one-day bar.
 */
function shifted(c: Dates, mode: DragMode, d: number): Dates {
  const s0 = (c.startDate ?? c.dueDate)!;
  const e0 = (c.dueDate ?? c.startDate)!;
  if (mode === "move") return { startDate: c.startDate && addDays(c.startDate, d), dueDate: c.dueDate && addDays(c.dueDate, d) };
  if (mode === "left") {
    const s = addDays(s0, d);
    return { startDate: s > e0 ? e0 : s, dueDate: e0 };
  }
  const e = addDays(e0, d);
  return { startDate: s0, dueDate: e < s0 ? s0 : e };
}

export function TimelineView({
  from,
  span,
  dayWidth,
  today,
  cards,
  members,
  tags,
  groupByBoard,
}: {
  from: ISODate;
  span: number;
  dayWidth: number;
  today: ISODate;
  cards: CardRow[];
  members: Member[];
  tags: Tag[];
  groupByBoard: boolean;
}) {
  const t = useT();
  const [editing, setEditing] = useState<CardRow | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // Dates saved from a drag, shown until the server's fresh data arrives.
  const [overrides, setOverrides] = useState<Record<string, Dates>>({});
  const [, startTransition] = useTransition();
  useEffect(() => setOverrides({}), [cards]);

  const to = addDays(from, span - 1);
  const days = Array.from({ length: span }, (_, i) => addDays(from, i));
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags]);

  const dated = (c: CardRow): CardRow => ({ ...c, ...overrides[c.id] });
  const view = cards.map(dated);

  const placed = view
      .filter((c) => (c.startDate ?? c.dueDate) && (c.dueDate ?? c.startDate)! >= from && (c.startDate ?? c.dueDate)! <= to)
    .sort((a, b) => (a.startDate ?? a.dueDate)!.localeCompare((b.startDate ?? b.dueDate)!));
  const byGroup = new Map<string, { name: string; rows: CardRow[] }>();
  for (const c of placed) {
    const key = groupByBoard ? c.boardId : c.columnId;
    if (!byGroup.has(key)) byGroup.set(key, { name: groupByBoard ? c.boardName : c.columnName, rows: [] });
    byGroup.get(key)!.rows.push(c);
  }
  const groups = [...byGroup.values()];
  const undated = view.filter((c) => !c.startDate && !c.dueDate && !c.done);

  function save(card: CardRow, next: Dates) {
    setOverrides((o) => ({ ...o, [card.id]: next }));
    startTransition(() => setCardDates(card.id, next.startDate, next.dueDate));
  }

  // Plane-style bar dragging: body moves, edges resize. A press without movement opens the card.
  function beginDrag(e: React.PointerEvent, card: CardRow, mode: DragMode) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const x0 = e.clientX;
    let state: Drag = { id: card.id, mode, delta: 0, moved: false };
    setDrag(state);
    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      const next = { ...state, delta: Math.round(dx / dayWidth), moved: state.moved || Math.abs(dx) > 3 };
      if (next.delta !== state.delta || next.moved !== state.moved) setDrag((state = next));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      setDrag(null);
      if (!state.moved) setEditing(card);
      else if (state.delta !== 0) save(card, shifted(card, mode, state.delta));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }

  const todayOffset = diffDays(today, from);
  const width = span * dayWidth;
  const rowProps = { from, span, dayWidth, today, drag, memberById, tagById, onDrag: beginDrag, onOpen: setEditing, onSave: save };

  if (groups.length === 0 && undated.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card px-6 py-16 text-center">
        <p className="font-medium">{t.timeline.emptyTitle}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t.timeline.emptyHint}</p>
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto rounded-lg border bg-card shadow-xs", drag?.moved && "cursor-grabbing select-none")}>
      <div className="relative" style={{ width: width + SIDE_W }}>
        <DayHeader days={days} dayWidth={dayWidth} today={today} />

        {/* Weekend shading + today line, behind rows */}
        <div className="pointer-events-none absolute top-0 bottom-0 flex" style={{ left: SIDE_W }}>
          {days.map((d) => (
            <div key={d} style={{ width: dayWidth }} className={cn("h-full shrink-0", weekday(d) >= 5 && "bg-muted/50")} />
          ))}
        </div>
        {todayOffset >= 0 && todayOffset < span && (
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-[5] w-0.5 rounded-full bg-primary"
            style={{ left: SIDE_W + todayOffset * dayWidth + dayWidth / 2 - 1 }}
            aria-hidden
          />
        )}

        {groups.map((g) => (
          <section key={g.name}>
            <GroupHeader name={g.name} count={g.rows.length} width={width} />
            {g.rows.map((card) => (
              <BarRow key={card.id} card={card} {...rowProps} />
            ))}
          </section>
        ))}

        {undated.length > 0 && (
          <section>
            <GroupHeader name={t.timeline.noDates} count={undated.length} width={width} hint={t.timeline.noDatesHint} />
            {undated.map((card) => (
              <BarRow key={card.id} card={card} {...rowProps} />
            ))}
          </section>
        )}
      </div>

      {editing && (
        <CardEditor
          card={editing}
          members={members}
          boardTags={tags.filter((t) => t.boardId === editing.boardId)}
          boardName={editing.boardName}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/** Weeks labeled on Mondays; day numbers only when there's room for them (week and month zoom). */
function DayHeader({ days, dayWidth, today }: { days: ISODate[]; dayWidth: number; today: ISODate }) {
  const t = useT();
  const showDays = dayWidth >= 24;
  return (
    <div className="sticky top-0 z-10 flex border-b bg-card">
      <div className="sticky left-0 z-10 shrink-0 border-r bg-card" style={{ width: SIDE_W }} />
      {days.map((d, i) => {
        const wd = weekday(d);
        return (
          <div
            key={d}
            style={{ width: dayWidth }}
            className={cn(
              "relative shrink-0 pt-1.5 pb-1 text-center text-[11px] text-muted-foreground",
              wd >= 5 && "bg-muted/60",
              !showDays && wd === 0 && "border-l",
            )}
          >
            <div className="h-4 whitespace-nowrap pl-1 text-left font-medium text-foreground">
              {(wd === 0 || i === 0) && t.fmt.day(d)}
            </div>
            {showDays && (
              <span
                className={cn(
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1",
                  d === today && "bg-primary font-semibold text-primary-foreground",
                )}
              >
                {dayWidth >= 56 ? `${t.fmt.weekday(d)} ${+d.slice(8)}` : +d.slice(8)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GroupHeader({ name, count, width, hint }: { name: string; count: number; width: number; hint?: string }) {
  return (
    <div className="flex items-center gap-2 border-b bg-muted/70 px-4 py-1.5 text-xs" style={{ width: width + SIDE_W }}>
      <span className="sticky left-4 flex items-center gap-2">
        <span className="font-semibold text-muted-foreground">{name}</span>
        <span className="text-muted-foreground tabular-nums">{count}</span>
        {hint && <span className="text-muted-foreground/70">· {hint}</span>}
      </span>
    </div>
  );
}

type RowProps = {
  card: CardRow;
  from: ISODate;
  span: number;
  dayWidth: number;
  today: ISODate;
  drag: Drag | null;
  memberById: Map<string, Member>;
  tagById: Map<string, Tag>;
  onDrag: (e: React.PointerEvent, card: CardRow, mode: DragMode) => void;
  onOpen: (card: CardRow) => void;
  onSave: (card: CardRow, next: Dates) => void;
};

function BarRow({ card, from, span, dayWidth, today, drag, memberById, onDrag, onOpen, onSave }: RowProps) {
  const t = useT();
  const dragging = drag?.id === card.id ? drag : null;
  const shown = dragging ? shifted(card, dragging.mode, dragging.delta) : card;
  const start = shown.startDate ?? shown.dueDate;
  const end = shown.dueDate ?? shown.startDate;

  return (
    <div className="group/row relative flex border-b border-border/60 hover:bg-accent" style={{ height: ROW_H }}>
      <button
        type="button"
        onClick={() => onOpen(card)}
        className="sticky left-0 z-[6] flex shrink-0 items-center gap-2 border-r bg-card px-4 text-left text-[13px] group-hover/row:bg-secondary hover:text-primary"
        style={{ width: SIDE_W }}
      >
        {/* Plane's Gantt sidebar row: state icon, title, and the length in days on the right */}
        <StateIcon done={card.done} inProgress={card.inProgress} className="size-3.5" />
        <span className={cn("min-w-0 flex-1 truncate font-medium", card.done && "text-muted-foreground line-through")}>{card.title}</span>
        {start && end && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{t.timeline.days(diffDays(end, start) + 1)}</span>}
      </button>

      {start && end ? (
        <Bar
          card={card}
          start={start}
          end={end}
          from={from}
          span={span}
          dayWidth={dayWidth}
          today={today}
          dragging={dragging}
          people={card.assigneeIds.map((id) => memberById.get(id)).filter((m): m is Member => !!m)}
          onDrag={onDrag}
          onOpen={onOpen}
          onNudge={(d) => onSave(card, shifted(card, "move", d))}
        />
      ) : (
        <AddDate from={from} span={span} dayWidth={dayWidth} title={card.title} onPick={(day) => onSave(card, { startDate: day, dueDate: day })} />
      )}
    </div>
  );
}

function Bar({
  card,
  start,
  end,
  from,
  span,
  dayWidth,
  today,
  dragging,
  people,
  onDrag,
  onOpen,
  onNudge,
}: {
  card: CardRow;
  start: ISODate;
  end: ISODate;
  from: ISODate;
  span: number;
  dayWidth: number;
  today: ISODate;
  dragging: Drag | null;
  people: Member[];
  onDrag: (e: React.PointerEvent, card: CardRow, mode: DragMode) => void;
  onOpen: (card: CardRow) => void;
  onNudge: (days: number) => void;
}) {
  const t = useT();
  const s = diffDays(start, from);
  const e = diffDays(end, from);
  const cs = Math.max(0, s);
  const ce = Math.min(span - 1, e);
  if (ce < 0 || cs > span - 1) return null;
  const late = !card.done && !!card.dueDate && card.dueDate < today;
  const barW = (ce - cs + 1) * dayWidth - 4;
  const handle = "absolute top-0 z-[8] h-full w-2.5 cursor-col-resize opacity-0 group-hover/bar:opacity-100";
  const grip = "absolute top-1/2 left-1/2 h-3.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current/50";

  return (
    <div className="group/bar absolute z-[6]" style={{ left: SIDE_W + cs * dayWidth + 2, top: 6, width: barW, height: ROW_H - 12 }}>
      {dragging?.moved && (
        <span className="absolute -top-5 left-0 z-[9] rounded-sm bg-brand-soft px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap text-primary shadow-xs">
          {t.timeline.range(start, end)}
        </span>
      )}
      <div
        role="button"
        tabIndex={0}
        onPointerDown={(ev) => onDrag(ev, card, "move")}
        onKeyDown={(ev) => {
          if (ev.key === "Enter" || ev.key === " ") {
            ev.preventDefault();
            onOpen(card);
          }
          if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
            ev.preventDefault();
            onNudge(ev.key === "ArrowLeft" ? -1 : 1);
          }
        }}
        title={t.timeline.barTitle(card.title, start, end)}
        aria-label={t.timeline.barAria(card.title, start, end)}
        // Plane's Gantt block: the state colour softened toward the surface, with dark text on it.
        style={{ backgroundColor: `color-mix(in oklch, ${late ? "var(--destructive)" : card.done ? "var(--success)" : card.inProgress ? "var(--warning)" : "var(--primary)"} ${card.done ? 22 : 28}%, var(--card))` }}
        className={cn(
          "flex h-full cursor-grab items-center justify-between gap-1 overflow-hidden rounded-sm px-2.5 text-[13px] text-foreground shadow-xs outline-none hover:brightness-[0.97] focus-visible:ring-3 focus-visible:ring-ring/50",
          card.done && "text-muted-foreground",
          late && "ring-1 ring-destructive/40",
          dragging?.moved && "cursor-grabbing shadow-md ring-2 ring-ring/60",
          s < 0 && "rounded-l-none",
          e > span - 1 && "rounded-r-none",
        )}
      >
        <span className="truncate">{barW >= 72 ? card.title : ""}</span>
        {barW >= 44 && <AvatarStack members={people} max={2} size={18} />}
      </div>
      {s >= 0 && (
        <span className={cn(handle, "-left-1")} onPointerDown={(ev) => onDrag(ev, card, "left")} aria-hidden>
          <span className={grip} />
        </span>
      )}
      {e <= span - 1 && (
        <span className={cn(handle, "-right-1")} onPointerDown={(ev) => onDrag(ev, card, "right")} aria-hidden>
          <span className={grip} />
        </span>
      )}
    </div>
  );
}

/** Plane's "add block": a + that follows the pointer along an undated row; click schedules that day. */
function AddDate({
  from,
  span,
  dayWidth,
  title,
  onPick,
}: {
  from: ISODate;
  span: number;
  dayWidth: number;
  title: string;
  onPick: (day: ISODate) => void;
}) {
  const t = useT();
  const [hover, setHover] = useState<number | null>(null);
  const day = hover === null ? null : addDays(from, hover);
  return (
    <div
      className="absolute inset-y-0 right-0"
      style={{ left: SIDE_W }}
      onMouseMove={(e) => {
        const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
        setHover(Math.min(span - 1, Math.max(0, Math.floor(x / dayWidth))));
      }}
      onMouseLeave={() => setHover(null)}
    >
      {day && (
        <button
          type="button"
          onClick={() => onPick(day)}
          title={t.timeline.scheduleOn(day)}
          aria-label={t.timeline.scheduleAria(title, day)}
          className="absolute top-1/2 grid size-7 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-sm border border-border-strong bg-card text-muted-foreground shadow-xs hover:text-foreground"
          style={{ left: hover! * dayWidth + dayWidth / 2 }}
        >
          <Plus className="size-3.5" />
        </button>
      )}
    </div>
  );
}
