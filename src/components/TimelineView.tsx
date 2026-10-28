"use client";

/*
  The timeline runs on Plane's gantt chart mechanics (apps/web/components/gantt-chart), AGPL-3.0,
  (c) Plane Software, Inc.: its view generators, endless scrolling, drag and resize, jump-to-bar and
  add-date. React state stands in for Plane's MobX timeline store. The look is the app's own.
*/
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type Modifier,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus } from "lucide-react";
import { toast } from "sonner";
import { addCard, moveCard, quickUpdateCard, setCardDates } from "@/app/actions";
import { CardQuickProps, type QuickPatch } from "@/components/CardQuickProps";
import { CardEditor } from "@/components/CardEditor";
import { useT } from "@/components/I18nProvider";
import { PageHeader } from "@/components/atoms";
import { StateIcon } from "@/components/BoardToolbar";
import { GanttChartBlock } from "@/components/gantt/blocks/block";
import { BlockRow } from "@/components/gantt/blocks/block-row";
import { BLOCK_HEIGHT, SIDEBAR_WIDTH } from "@/components/gantt/constants";
import { TimelineChartContext, type TimelineChartStore } from "@/components/gantt/context";
import { currentViewDataWithView } from "@/components/gantt/data";
import { ChartAddBlock } from "@/components/gantt/helpers/add-block";
import type { BlockDateUpdate } from "@/components/gantt/helpers/use-gantt-resizable";
import { EStartOfTheWeek, type BlockPosition, type ChartDataType, type IGanttBlock, type TGanttViews } from "@/components/gantt/types";
import {
  fromISO,
  getDateFromPositionOnGantt,
  getItemPositionWidth,
  getNumberOfDaysBetweenTwoDates,
  monthView,
  quarterView,
  toISO,
  weekView,
  type IMonthBlock,
  type IMonthView,
  type IWeekBlock,
} from "@/components/gantt/views";
import { Pager } from "@/components/Pager";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { addDays, diffDays, weekday, type ISODate } from "@/lib/dates";
import type { CardRow, Member, Tag, TimelineColumn } from "@/lib/types";
import { cn } from "@/lib/utils";

type Dates = { startDate: string | null; dueDate: string | null };
/** Changes made on the timeline (dates, priority, people), shown until the server's fresh data arrives. */
type Override = Partial<Pick<CardRow, "startDate" | "dueDate" | "priority" | "assigneeIds">>;

// Row dragging (dnd-kit, as on the board): rows are "card:<id>", column groups "col:<id>".
const rowKey = (id: string) => `card:${id}`;
const groupKey = (id: string) => `col:${id}`;
const rawId = (key: string | number) => String(key).slice(String(key).indexOf(":") + 1);
const isGroup = (key: string | number) => String(key).startsWith("col:");
// A column heading's height (px-4 py-1.5 text-xs).
const GROUP_HEADER_HEIGHT = 30;
// Rows only move up and down.
const vertical: Modifier = ({ transform }) => ({ ...transform, x: 0 });
// The row under the pointer wins over its group; fall back to the nearest for keyboard drags.
const rowCollisions: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length) return [hits.find((h) => !isGroup(h.id)) ?? hits[0]];
  return closestCenter(args);
};
type RenderView = IWeekBlock[] | IMonthView | IMonthBlock[];
type ChartState = { view: TGanttViews; data: ChartDataType; render: RenderView };
// How far the pager's arrows scroll, in days, per zoom.
const PAGER_STEP: Record<TGanttViews, number> = { week: 7, month: 14, quarter: 28 };
type PendingScroll = { kind: "shift"; by: number } | { kind: "date"; date: Date } | { kind: "block"; id: string };

// Plane's timelineViewHelpers, with weeks starting on Monday as everywhere else in the app.
function generateChart(view: TGanttViews, data: ChartDataType, side: null | "left" | "right", targetDate?: Date) {
  if (view === "week") return weekView.generateChart(data, side, targetDate, EStartOfTheWeek.MONDAY);
  if (view === "month") return monthView.generateChart(data, side, targetDate, EStartOfTheWeek.MONDAY);
  return quarterView.generateChart(data, side, targetDate);
}
function mergeRenderPayloads(view: TGanttViews, a: RenderView, b: RenderView): RenderView {
  if (view === "week") return weekView.mergeRenderPayloads(a as IWeekBlock[], b as IWeekBlock[]);
  if (view === "month") return monthView.mergeRenderPayloads(a as IMonthView, b as IMonthView);
  return quarterView.mergeRenderPayloads(a as IMonthBlock[], b as IMonthBlock[]);
}

/** The bar's colours: a soft fill and border in the card's state colour, with a solid strip on the left; red when late. */
function barStyle(card: CardRow, today: ISODate): React.CSSProperties {
  const late = !card.done && !!card.dueDate && card.dueDate < today;
  const tone = late ? "var(--destructive)" : card.done ? "var(--success)" : card.inProgress ? "var(--warning)" : "var(--primary)";
  return {
    backgroundColor: `color-mix(in oklch, ${tone} ${card.done ? 12 : 16}%, var(--card))`,
    borderColor: `color-mix(in oklch, ${tone} 40%, var(--card))`,
    boxShadow: `inset 3px 0 0 ${tone}`,
  };
}

export function TimelineView({
  today,
  cards,
  columns,
  members,
  tags,
  groupByBoard,
  boardName,
  filter,
  initialView = "month",
}: {
  today: ISODate;
  cards: CardRow[];
  /** The kanban columns cards are grouped by, in board order. */
  columns: TimelineColumn[];
  members: Member[];
  tags: Tag[];
  groupByBoard: boolean;
  /** For the header's description; null on the all-boards timeline. */
  boardName?: string | null;
  /** The board picker, shown beside the zoom and pager. */
  filter?: React.ReactNode;
  initialView?: TGanttViews;
}) {
  const t = useT();
  const [editing, setEditing] = useState<CardRow | null>(null);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [, startTransition] = useTransition();
  useEffect(() => setOverrides({}), [cards]);

  // ---- Plane's timeline store ----
  const [chart, setChart] = useState<ChartState | null>(null);
  const chartRef = useRef<ChartState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragPositions, setDragPositions] = useState<Record<string, BlockPosition>>({});
  const [visible, setVisible] = useState<{ from: ISODate; to: ISODate } | null>(null);
  const ganttContainerRef = useRef<HTMLDivElement>(null);
  const pendingScroll = useRef<PendingScroll | null>(null);
  const growing = useRef(false);

  /** Plane's updateCurrentViewRenderPayload: build the chart around a date, or add days to one side. */
  const updateCurrentViewRenderPayload = (side: null | "left" | "right", view: TGanttViews, targetDate?: Date) => {
    const prev = chartRef.current;
    if (side !== null && !prev) return;
    const viewData = prev && prev.view === view && side !== null ? prev.data : structuredClone(currentViewDataWithView(view)!);
    if (side === null) viewData.data.currentDate = targetDate ?? fromISO(today);
    const currentRender = generateChart(view, viewData, side, targetDate);
    let next: ChartState;
    if (side === "left") {
      next = { view, data: currentRender.state, render: mergeRenderPayloads(view, currentRender.payload, prev!.render) };
      // Days added on the left push everything right; scroll by as much so the view stays put.
      if (!targetDate) pendingScroll.current = { kind: "shift", by: currentRender.scrollWidth };
    } else if (side === "right") {
      next = { view, data: currentRender.state, render: mergeRenderPayloads(view, prev!.render, currentRender.payload) };
    } else {
      next = { view, data: currentRender.state, render: currentRender.payload };
      pendingScroll.current = { kind: "date", date: currentRender.state.data.currentDate };
    }
    // Later calls before the next render build on this one.
    chartRef.current = next;
    setChart(next);
    return next;
  };

  const handleToday = () => updateCurrentViewRenderPayload(null, chartRef.current?.view ?? initialView);

  // handling the scroll positioning from left and right
  useEffect(() => {
    handleToday();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Cards as Plane's gantt blocks ----
  const view = cards.map((c): CardRow => ({ ...c, ...overrides[c.id] }));
  // A card with one date is a one-day bar on it.
  const blockFor = (card: CardRow): IGanttBlock => {
    const block: IGanttBlock = { id: card.id, start_date: card.startDate ?? card.dueDate, target_date: card.dueDate ?? card.startDate };
    block.position = dragPositions[card.id] ?? (chart ? getItemPositionWidth(chart.data, block) : undefined);
    return block;
  };
  // ---- Groups: kanban columns, rows in board order. Dragging a row reorders it or changes its column. ----
  const byId = new Map(view.map((c) => [c.id, c]));
  const columnById = new Map(columns.map((c) => [c.id, c]));
  // Done cards without dates stay off the timeline.
  const loadedLists = useMemo(
    () =>
      Object.fromEntries(
        columns.map((col) => [col.id, cards.filter((c) => c.columnId === col.id && (c.startDate || c.dueDate || !c.done)).map((c) => c.id)]),
      ),
    [cards, columns],
  );
  const [lists, setLists] = useState<Record<string, string[]>>(loadedLists);
  const [rowDrag, setRowDrag] = useState<{ id: string; lists: Record<string, string[]> } | null>(null);
  useEffect(() => {
    if (!rowDrag) setLists(loadedLists);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadedLists]);
  const columnOf = (id: string, from = lists) => Object.keys(from).find((col) => from[col].includes(id));
  /** The card as it shows now: in whichever column its row sits, with that column's state. */
  const shownCard = (id: string, colId: string): CardRow => {
    const col = columnById.get(colId)!;
    return { ...byId.get(id)!, columnId: col.id, columnName: col.name, done: col.isDone, inProgress: col.isInProgress };
  };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onRowDragOver({ active, over }: DragOverEvent) {
    if (!over) return;
    const id = rawId(active.id);
    const from = columnOf(id);
    const to = isGroup(over.id) ? rawId(over.id) : columnOf(rawId(over.id));
    if (!from || !to) return;
    // Over a row of its own column, the sortable list handles it.
    if (from === to && !isGroup(over.id)) return;
    // A card stays on its board: over another board's column, the row goes back to where it started.
    if (columnById.get(to)?.boardId !== byId.get(id)?.boardId) {
      if (rowDrag) setLists(rowDrag.lists);
      return;
    }
    // Over a column but no row: its heading means the top, its "+ New card" row the bottom. (Always the
    // end made the heading slide away from under the pointer, and the row jump back and forth.)
    const dragged = active.rect.current.translated;
    const y = dragged ? dragged.top + dragged.height / 2 : over.rect.top;
    const atTop = y < over.rect.top + GROUP_HEADER_HEIGHT + BLOCK_HEIGHT / 2;
    setLists((prev) => {
      const target = prev[to].filter((x) => x !== id);
      const at = isGroup(over.id) ? (atTop ? 0 : target.length) : Math.max(0, target.indexOf(rawId(over.id)));
      target.splice(at, 0, id);
      if (target.join() === prev[to].join()) return prev;
      return { ...prev, [from]: prev[from].filter((x) => x !== id), [to]: target };
    });
  }

  function onRowDragEnd({ active, over }: DragEndEvent) {
    const id = rawId(active.id);
    const before = rowDrag?.lists ?? lists;
    setRowDrag(null);
    const target = over && (isGroup(over.id) ? rawId(over.id) : columnOf(rawId(over.id)));
    // Dropped outside, or on another board's column: nothing changes.
    if (!over || !target || columnById.get(target)?.boardId !== byId.get(id)?.boardId) return setLists(before);
    const col = columnOf(id);
    if (!col) return setLists(before);
    let list = lists[col];
    if (!isGroup(over.id) && list.includes(rawId(over.id))) list = arrayMove(list, list.indexOf(id), list.indexOf(rawId(over.id)));
    setLists((prev) => ({ ...prev, [col]: list }));
    if (col === columnOf(id, before) && list.join() === before[col].join()) return;
    // The server counts positions among all the column's cards, hidden ones too: go in before the next shown one.
    const all = cards.filter((c) => c.columnId === col && c.id !== id).map((c) => c.id);
    const next = list[list.indexOf(id) + 1];
    const index = next && all.includes(next) ? all.indexOf(next) : all.length;
    startTransition(() => moveCard(id, col, index));
  }

  /** Priority and people from the row's chips: show at once, save, and roll back if saving fails. */
  function patch(card: CardRow, change: QuickPatch) {
    const before = overrides[card.id];
    setOverrides((o) => ({ ...o, [card.id]: { ...o[card.id], ...change } }));
    startTransition(async () => {
      try {
        await quickUpdateCard(card.id, change);
      } catch {
        setOverrides((o) => ({ ...o, [card.id]: before ?? {} }));
        toast.error(t.quick.saveFailed);
      }
    });
  }

  const dayWidth = chart?.data.data.dayWidth ?? 0;
  const chartStart = chart ? toISO(chart.data.data.startDate) : today;
  const span = chart ? diffDays(toISO(chart.data.data.endDate), chartStart) + 1 : 0;
  const itemsContainerWidth = span * dayWidth;
  const days = useMemo(() => Array.from({ length: span }, (_, i) => addDays(chartStart, i)), [chartStart, span]);

  /** The days between the card-name column and the right edge, for the header's description. */
  function updateVisible(el: HTMLElement) {
    if (!chart) return;
    const from = addDays(chartStart, Math.floor(el.scrollLeft / dayWidth));
    const to = addDays(from, Math.max(0, Math.floor((el.clientWidth - SIDEBAR_WIDTH) / dayWidth) - 1));
    if (from !== visible?.from || to !== visible?.to) setVisible({ from, to });
  }

  // Scroll after the chart has the new days in it (Plane does this straight away or after a timeout).
  useLayoutEffect(() => {
    const scrollContainer = ganttContainerRef.current;
    const pending = pendingScroll.current;
    pendingScroll.current = null;
    growing.current = false;
    if (!scrollContainer || !chart) return;
    if (pending?.kind === "shift") scrollContainer.scrollLeft += pending.by;
    else if (pending?.kind === "date") {
      // Plane's handleScrollToCurrentSelectedDate: the date a little left of the middle.
      const clientVisibleWidth: number = scrollContainer?.clientWidth;
      const daysDifference = getNumberOfDaysBetweenTwoDates(new Date(chart.data.data.startDate), new Date(pending.date));
      scrollContainer.scrollLeft = Math.abs(daysDifference) * dayWidth - (clientVisibleWidth / 2 - dayWidth) + SIDEBAR_WIDTH / 2;
    } else if (pending?.kind === "block") {
      const card = view.find((c) => c.id === pending.id);
      const position = card && blockFor(card).position;
      if (position) scrollContainer.scrollLeft = position.marginLeft - 4;
    }
    updateVisible(scrollContainer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chart]);

  // handling scroll functionality
  const onScroll = (e: React.UIEvent<HTMLDivElement, UIEvent>) => {
    if (!chart) return;
    updateVisible(e.currentTarget);
    if (growing.current) return;
    const { clientWidth, scrollLeft, scrollWidth } = e.currentTarget;

    const approxRangeLeft = scrollLeft;
    const approxRangeRight = scrollWidth - (scrollLeft + clientWidth);
    const calculatedRangeRight = itemsContainerWidth - (scrollLeft + clientWidth);

    if (approxRangeRight < clientWidth || calculatedRangeRight < clientWidth) {
      growing.current = true;
      updateCurrentViewRenderPayload("right", chart.view);
    }
    if (approxRangeLeft < clientWidth) {
      growing.current = true;
      updateCurrentViewRenderPayload("left", chart.view);
    }
  };

  const handleScrollToBlock = (block: IGanttBlock) => {
    if (!chart) return;
    const scrollToDate = fromISO((block.start_date ?? block.target_date)!);
    if (scrollToDate.getTime() < chart.data.data.startDate.getTime()) updateCurrentViewRenderPayload("left", chart.view, scrollToDate);
    else if (scrollToDate.getTime() > chart.data.data.endDate.getTime()) updateCurrentViewRenderPayload("right", chart.view, scrollToDate);
    else setChart({ ...chart });
    // Scroll to the block once it's on the chart; extending to a target date doesn't shift the view.
    pendingScroll.current = { kind: "block", id: block.id };
  };

  const scrollByDays = (n: number) => ganttContainerRef.current?.scrollBy({ left: n * dayWidth, behavior: "smooth" });

  function save(card: CardRow, next: Dates) {
    setOverrides((o) => ({ ...o, [card.id]: { ...o[card.id], ...next } }));
    startTransition(() => setCardDates(card.id, next.startDate, next.dueDate));
  }
  /** New dates from a drag. Moving keeps which ends are set; resizing makes both ends explicit. */
  const updateBlockDates = (update: BlockDateUpdate) => {
    const card = view.find((c) => c.id === update.id);
    setDragPositions((p) => {
      const rest = { ...p };
      delete rest[update.id];
      return rest;
    });
    if (!card || !update.start_date || !update.target_date) return;
    const s0 = (card.startDate ?? card.dueDate) as ISODate;
    const e0 = (card.dueDate ?? card.startDate) as ISODate;
    const start = toISO(update.start_date);
    const end = toISO(update.target_date);
    const d = diffDays(start, s0);
    const next: Dates =
      update.direction === "move"
        ? { startDate: card.startDate && addDays(card.startDate as ISODate, d), dueDate: card.dueDate && addDays(card.dueDate as ISODate, d) }
        : update.direction === "left"
          ? { startDate: start, dueDate: e0 }
          : { startDate: s0, dueDate: end };
    if (next.startDate !== card.startDate || next.dueDate !== card.dueDate) save(card, next);
  };
  const nudge = (card: CardRow, d: number) =>
    save(card, { startDate: card.startDate && addDays(card.startDate as ISODate, d), dueDate: card.dueDate && addDays(card.dueDate as ISODate, d) });

  const store: TimelineChartStore | null = chart && {
    currentView: chart.view,
    currentViewData: chart.data,
    isDragging,
    setIsDragging,
    updateBlockPosition: (id, position) => setDragPositions((p) => ({ ...p, [id]: position })),
    getDateFromPositionOnGantt: (position, offsetDays) => getDateFromPositionOnGantt(position, chart.data, offsetDays),
    getNumberOfDaysFromPosition: (position) => (position ? Math.round(position / dayWidth) : undefined),
  };

  const currentView = chart?.view ?? initialView;
  const todayOffset = diffDays(today, chartStart);

  const row = (card: CardRow) => {
    const block = blockFor(card);
    const start = block.start_date as ISODate | null;
    const end = block.target_date as ISODate | null;
    const length = block.position ? Math.round(block.position.width / dayWidth) : null;
    const barW = (block.position?.width ?? 0) - 4;
    return (
      <SortableRow key={card.id} id={card.id}>
        {(handle) => (
          <>
        <div
          className="sticky left-0 z-[6] flex shrink-0 items-center gap-2 border-r bg-card pr-3 pl-2 text-[13px] group-hover/row:bg-secondary"
          style={{ width: SIDEBAR_WIDTH }}
        >
          {/* Plane's Gantt sidebar row: state and title (drag it to reorder or change column), then priority,
              people and the length in days, as on a board card. */}
          <button
            type="button"
            data-row-name
            {...handle}
            onClick={() => setEditing(card)}
            title={t.timeline.dragRow}
            className="flex min-w-0 flex-1 cursor-grab touch-none items-center gap-2 rounded-sm px-2 py-1 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 active:cursor-grabbing"
          >
            {/* The drag grip shows in place of the state icon on hover, as on the board's columns */}
            <span className="grid size-3.5 shrink-0 place-items-center">
              <StateIcon done={card.done} inProgress={card.inProgress} className="size-3.5 group-hover/row:hidden" />
              <GripVertical data-grip className="hidden size-3.5 text-muted-foreground group-hover/row:block" aria-hidden />
            </span>
            <span className={cn("min-w-0 flex-1 truncate font-medium", card.done && "text-muted-foreground line-through")}>{card.title}</span>
          </button>
          <span className="flex shrink-0 items-center [&>div]:flex-nowrap [&>div]:gap-1.5 [&>div]:pt-0">
            <CardQuickProps
              card={card}
              members={members}
              today={today}
              done={card.done}
              show={{ priority: true, dates: false, assignees: true }}
              onPatch={(p) => patch(card, p)}
            />
          </span>
          {start && length && <span className="w-12 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{t.timeline.days(length)}</span>}
        </div>
        <div className="relative shrink-0" style={{ width: itemsContainerWidth }}>
          <BlockRow
            block={block}
            title={card.title}
            handleScrollToBlock={handleScrollToBlock}
            ganttContainerRef={ganttContainerRef}
            addBlock={<ChartAddBlock title={card.title} onAdd={(day) => save(card, { startDate: toISO(day), dueDate: toISO(day) })} />}
          />
          {start && end && (
            <GanttChartBlock
              block={block}
              enableBlockLeftResize
              enableBlockRightResize
              enableBlockMove
              ganttContainerRef={ganttContainerRef}
              updateBlockDates={updateBlockDates}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => setEditing(card)}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") {
                    ev.preventDefault();
                    setEditing(card);
                  }
                  if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
                    ev.preventDefault();
                    nudge(card, ev.key === "ArrowLeft" ? -1 : 1);
                  }
                }}
                title={t.timeline.barTitle(card.title, start, end)}
                aria-label={t.timeline.barAria(card.title, start, end)}
                style={barStyle(card, today)}
                className={cn(
                  "flex h-full cursor-grab items-center overflow-hidden rounded-md border pr-2 pl-3 text-[13px] font-medium text-foreground shadow-xs outline-none hover:brightness-[0.98] focus-visible:ring-3 focus-visible:ring-ring/50",
                  card.done && "text-muted-foreground line-through decoration-muted-foreground/40",
                  isDragging && "cursor-grabbing",
                )}
              >
                {barW >= 36 && <span className="truncate">{card.title}</span>}
              </div>
            </GanttChartBlock>
          )}
        </div>
          </>
        )}
      </SortableRow>
    );
  };

  return (
    <>
      <PageHeader
        title={t.timeline.title}
        description={visible ? t.timeline.description(visible.from, visible.to, boardName ?? null) : "\u00a0"}
        actions={
          <>
            {filter}
            <Tabs value={currentView} onValueChange={(v) => updateCurrentViewRenderPayload(null, v as TGanttViews)}>
              <TabsList aria-label={t.timeline.zoom}>
                {(["week", "month", "quarter"] as const).map((z) => (
                  <TabsTrigger key={z} value={z}>
                    {t.timeline.zooms[z]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Pager
              prev={() => scrollByDays(-PAGER_STEP[currentView])}
              today={handleToday}
              next={() => scrollByDays(PAGER_STEP[currentView])}
              prevLabel={t.timeline.earlier}
              nextLabel={t.timeline.later}
              todayLabel={t.common.today}
            />
          </>
        }
      />
      {/* As tall as the rows, up to the space left on the page; then it scrolls down too. */}
      <div className="flex min-h-0 flex-col px-4 py-5 md:px-6">
        {columns.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card px-6 py-16 text-center">
            <p className="font-medium">{t.timeline.emptyTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.timeline.emptyHint}</p>
          </div>
        ) : (
          <div
            // Plane's #gantt-container. overscroll-x-contain: a swipe at an edge doesn't go back a page.
            ref={ganttContainerRef}
            data-timeline-scroll
            data-chart-start={chart ? chartStart : undefined}
            data-day-width={dayWidth || undefined}
            className={cn("min-h-0 overflow-auto overscroll-x-contain rounded-lg border bg-card shadow-xs", isDragging && "cursor-grabbing select-none")}
            onScroll={onScroll}
          >
            {store && chart && (
              <TimelineChartContext.Provider value={store}>
                <div className="relative" style={{ width: itemsContainerWidth + SIDEBAR_WIDTH }}>
                  <DayHeader days={days} dayWidth={dayWidth} today={today} />

                  {/* Column borders, weekend shading and the today line, behind rows */}
                  <ChartGrid days={days} dayWidth={dayWidth} />
                  {todayOffset >= 0 && todayOffset < span && (
                    <div
                      data-today-line
                      className="pointer-events-none absolute top-0 bottom-0 z-[5] w-0.5 rounded-full bg-primary"
                      style={{ left: SIDEBAR_WIDTH + todayOffset * dayWidth + dayWidth / 2 - 1 }}
                      aria-hidden
                    />
                  )}

                  <DndContext
                    id="timeline-rows"
                    sensors={sensors}
                    collisionDetection={rowCollisions}
                    modifiers={[vertical]}
                    // Rows only move up and down, so only scroll up and down while dragging one.
                    autoScroll={{ threshold: { x: 0, y: 0.2 } }}
                    // Rows change place as the drag goes on: keep measuring them.
                    measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
                    onDragStart={({ active }) => setRowDrag({ id: rawId(active.id), lists })}
                    onDragOver={onRowDragOver}
                    onDragEnd={onRowDragEnd}
                    onDragCancel={() => {
                      if (rowDrag) setLists(rowDrag.lists);
                      setRowDrag(null);
                    }}
                  >
                    {columns.map((col) => (
                      <GroupSection key={col.id} id={col.id}>
                        <GroupHeader column={col} showBoard={groupByBoard} count={lists[col.id]?.length ?? 0} width={itemsContainerWidth} />
                        <SortableContext items={(lists[col.id] ?? []).map(rowKey)} strategy={verticalListSortingStrategy}>
                          {(lists[col.id] ?? []).map((id) => row(shownCard(id, col.id)))}
                        </SortableContext>
                        <AddCardRow columnId={col.id} width={itemsContainerWidth} />
                      </GroupSection>
                    ))}
                  </DndContext>
                </div>
              </TimelineChartContext.Provider>
            )}
          </div>
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
    </>
  );
}

/**
 * The chart's grid as repeating backgrounds rather than a cell per day (zoomed out it spans thousands of
 * days): a border on every column, as Plane draws them, over the weekend shading. Columns are days in
 * week zoom, and weeks in month and quarter zoom.
 */
function gridBackground(days: ISODate[], dayWidth: number, shade: string): React.CSSProperties {
  const week = 7 * dayWidth;
  const offset = days.length ? weekday(days[0]) * dayWidth : 0;
  const col = dayWidth >= 56 ? dayWidth : week;
  // Lines on the left edge of each day, or of each Monday.
  const linePos = col === week ? (week - offset) % week : 0;
  return {
    backgroundImage: [
      "linear-gradient(to right, var(--border) 1px, transparent 1px)",
      `linear-gradient(to right, transparent ${5 * dayWidth}px, ${shade} ${5 * dayWidth}px)`,
    ].join(", "),
    backgroundSize: `${col}px 100%, ${week}px 100%`,
    backgroundPosition: `${linePos}px 0, ${-offset}px 0`,
  };
}

const ChartGrid = memo(function ChartGrid({ days, dayWidth }: { days: ISODate[]; dayWidth: number }) {
  return (
    <div
      data-grid
      className="pointer-events-none absolute top-0 bottom-0"
      style={{ left: SIDEBAR_WIDTH, width: days.length * dayWidth, ...gridBackground(days, dayWidth, "color-mix(in oklch, var(--muted) 30%, transparent)") }}
    />
  );
});

/**
 * Weeks labeled on Mondays; day numbers only when there's room for them (week and month zoom). Without
 * them (quarter) there's a cell per week. Redraws only when the days change, not on every scroll.
 */
const DayHeader = memo(function DayHeader({ days, dayWidth, today }: { days: ISODate[]; dayWidth: number; today: ISODate }) {
  const t = useT();
  const showDays = dayWidth >= 24;
  const weeks = showDays ? [] : days.flatMap((d, i) => (weekday(d) === 0 || i === 0 ? [{ d, n: Math.min(7 - weekday(d), days.length - i) }] : []));
  return (
    <div className="sticky top-0 z-10 flex border-b bg-card">
      <div className="sticky left-0 z-10 shrink-0 border-r bg-card" style={{ width: SIDEBAR_WIDTH }} />
      <div data-grid-header className="flex" style={gridBackground(days, dayWidth, "color-mix(in oklch, var(--muted) 35%, transparent)")}>
        {showDays
          ? days.map((d, i) => (
              <div
                key={d}
                data-day={d}
                data-weekstart={weekday(d) === 0 || undefined}
                style={{ width: dayWidth }}
                className="relative shrink-0 pt-1.5 pb-1 text-center text-[11px] text-muted-foreground"
              >
                <div className="h-4 whitespace-nowrap pl-1 text-left font-medium text-foreground">{(weekday(d) === 0 || i === 0) && t.fmt.day(d)}</div>
                <span
                  className={cn(
                    "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1",
                    d === today && "bg-primary font-semibold text-primary-foreground",
                  )}
                >
                  {dayWidth >= 56 ? `${t.fmt.weekday(d)} ${+d.slice(8)}` : +d.slice(8)}
                </span>
              </div>
            ))
          : weeks.map(({ d, n }) => (
              <div key={d} data-week={d} style={{ width: n * dayWidth }} className="relative shrink-0 pt-1.5 pb-1 text-[11px]">
                <div className="h-4 truncate pl-1 font-medium whitespace-nowrap text-foreground">{t.fmt.day(d)}</div>
              </div>
            ))}
      </div>
    </div>
  );
});

/**
 * A column's heading row. Its part over the card column is opaque and sticky, like the rows' names, so
 * column lines and the today line don't show through it when the chart scrolls sideways.
 */
function GroupHeader({ column, showBoard, count, width }: { column: TimelineColumn; showBoard: boolean; count: number; width: number }) {
  return (
    <div data-group className="flex border-b text-xs" style={{ width: width + SIDEBAR_WIDTH }}>
      <div
        data-group-label
        className="sticky left-0 z-[6] flex shrink-0 items-center gap-2 border-r px-4 py-1.5"
        style={{ width: SIDEBAR_WIDTH, backgroundColor: "color-mix(in oklch, var(--muted) 45%, var(--card))" }}
      >
        {showBoard && <span className="max-w-32 shrink-0 truncate text-muted-foreground">{column.boardName}</span>}
        <StateIcon done={column.isDone} inProgress={column.isInProgress} className="size-3 shrink-0" />
        <span className="truncate font-semibold text-muted-foreground">{column.name}</span>
        <span className="text-muted-foreground tabular-nums">{count}</span>
      </div>
      <div className="min-w-0 flex-1 bg-muted/45" />
    </div>
  );
}

/** A column's rows, and where a dragged row can land when the column is empty. */
function GroupSection({ id, children }: { id: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: groupKey(id) });
  return (
    <section ref={setNodeRef} data-group-id={id} className={cn(isOver && "bg-brand-soft/40")}>
      {children}
    </section>
  );
}

/** One card's row; the name is the drag handle (a press without movement still opens the card). */
function SortableRow({ id, children }: { id: string; children: (handle: React.HTMLAttributes<HTMLElement>) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rowKey(id) });
  return (
    <div
      ref={setNodeRef}
      data-sidebar-row={id}
      className={cn("group/row relative flex border-b border-border/60 bg-card/0 hover:bg-accent", isDragging && "z-[8] bg-card opacity-80 shadow-md")}
      style={{ height: BLOCK_HEIGHT, transform: CSS.Translate.toString(transform), transition }}
    >
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

/** "+ New card" at the end of a column, like the board's quick add: Enter adds and stays open, Esc closes. */
function AddCardRow({ columnId, width }: { columnId: string; width: number }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [, startTransition] = useTransition();
  const submit = (keepOpen: boolean) => {
    const text = title.trim();
    if (text) {
      setTitle("");
      startTransition(() => addCard(columnId, text));
    }
    if (!keepOpen || !text) setOpen(keepOpen && !!text);
  };
  return (
    <div className="flex border-b border-border/60" style={{ width: width + SIDEBAR_WIDTH, height: 36 }}>
      <div className="sticky left-0 z-[6] flex shrink-0 items-center border-r bg-card px-2" style={{ width: SIDEBAR_WIDTH }}>
        {open ? (
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit(true);
              }
              if (e.key === "Escape") {
                setTitle("");
                setOpen(false);
              }
            }}
            onBlur={() => submit(false)}
            maxLength={200}
            placeholder={t.column.addPlaceholder}
            aria-label={t.column.addCard}
            className="h-7 w-full rounded-md border border-primary bg-card px-2 text-[13px] font-medium ring-1 ring-primary outline-none placeholder:text-muted-foreground"
          />
        ) : (
          <button
            type="button"
            data-add-card
            onClick={() => setOpen(true)}
            className="flex h-7 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-[13px] font-medium text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Plus className="size-3.5" /> {t.column.newCard}
          </button>
        )}
      </div>
    </div>
  );
}
