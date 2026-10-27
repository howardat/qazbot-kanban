"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  ChevronRight,
  CircleCheck,
  FoldHorizontal,
  GripVertical,
  MoreHorizontal,
  Plus,
  SquarePen,
  Trash2,
  UnfoldHorizontal,
} from "lucide-react";
import {
  addCard,
  addColumn,
  deleteBoard,
  deleteCard,
  deleteColumn,
  moveCard,
  moveColumn,
  quickUpdateCard,
  renameBoard,
  renameColumn,
  setColumnDone,
  setColumnInProgress,
} from "@/app/actions";
import { AvatarStack, DueBadge, TagBadge } from "@/components/atoms";
import { CardQuickProps, type QuickPatch } from "@/components/CardQuickProps";
import { CardEditor } from "@/components/CardEditor";
import { useT } from "@/components/I18nProvider";
import { AppliedFilters, DisplayMenu, FiltersMenu, hasFilters, matches, NO_FILTERS, PriorityIcon, StateIcon, useDisplay, type Display, type Filters } from "@/components/BoardToolbar";
import { TagManager } from "@/components/TagManager";
import { ViewBar } from "@/components/ViewTabs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ISODate } from "@/lib/dates";
import type { CardData, Member, Tag } from "@/lib/types";
import { avatarHue } from "@/lib/colors";
import { cn } from "@/lib/utils";

export type ColumnData = { id: string; name: string; isDone: boolean; isInProgress: boolean; cards: CardData[] };

const colKey = (id: string) => `col:${id}`;
const cardKey = (id: string) => `card:${id}`;
const rawId = (key: string) => key.slice(key.indexOf(":") + 1);
const isCol = (key: string) => key.startsWith("col:");

// Hit-test by pointer position (stable while cards move between columns), preferring cards over
// their column. Columns only collide with columns. Falls back to closestCorners (e.g. keyboard drags).
const collisionDetection: CollisionDetection = (args) => {
  const draggingColumn = isCol(String(args.active.id));
  const scoped = draggingColumn
    ? { ...args, droppableContainers: args.droppableContainers.filter((c) => isCol(String(c.id))) }
    : args;
  const hits = pointerWithin(scoped);
  if (hits.length > 0) {
    const cardHit = draggingColumn ? undefined : hits.find((h) => !isCol(String(h.id)));
    return [cardHit ?? hits[0]];
  }
  return closestCorners(scoped);
};

type Ctx = {
  memberById: Map<string, Member>;
  tagById: Map<string, Tag>;
  today: ISODate;
  columns: { id: string; name: string; isDone: boolean }[];
  editingId: string | null;
  display: Display;
  open: (card: CardData) => void;
  moveTo: (cardId: string, columnId: string) => void;
  remove: (cardId: string) => void;
  patch: (cardId: string, patch: QuickPatch) => void;
};

// Collapsed columns are a per-viewer preference, remembered per board in this browser only.
function useCollapsed(boardId: string) {
  const key = `qazbot:collapsed:${boardId}`;
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      setIds(JSON.parse(localStorage.getItem(key) ?? "[]"));
    } catch {
      setIds([]);
    }
  }, [key]);
  const toggle = (colId: string) =>
    setIds((prev) => {
      const next = prev.includes(colId) ? prev.filter((x) => x !== colId) : [...prev, colId];
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {}
      return next;
    });
  return [ids, toggle] as const;
}

export function Board({
  board,
  columns: initial,
  members,
  tags,
  today,
  currentUserId,
  canDelete,
  layout = "board",
}: {
  board: { id: string; name: string };
  columns: ColumnData[];
  members: Member[];
  tags: Tag[];
  today: ISODate;
  currentUserId: string;
  canDelete: boolean;
  /** Kanban columns, or Plane's list: one section per column with a row per card. */
  layout?: "board" | "list";
}) {
  const t = useT();
  const dndId = useId();
  const [cols, setCols] = useState(initial);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<CardData | null>(null);
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [display, setDisplay] = useDisplay();
  const [collapsed, toggleCollapsed] = useCollapsed(board.id);
  const [, startTransition] = useTransition();

  // Server data wins whenever it changes (after revalidation), unless a drag is in progress.
  useEffect(() => {
    if (!activeKey) setCols(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const maps = useMemo(
    () => ({ memberById: new Map(members.map((m) => [m.id, m])), tagById: new Map(tags.map((t) => [t.id, t])) }),
    [members, tags],
  );

  // Card menu actions: update the board right away, then save.
  function moveTo(cardId: string, columnId: string) {
    setCols((prev) => {
      const card = prev.flatMap((c) => c.cards).find((c) => c.id === cardId);
      if (!card) return prev;
      return prev.map((c) => {
        const rest = c.cards.filter((x) => x.id !== cardId);
        return c.id === columnId ? { ...c, cards: [...rest, { ...card, columnId }] } : { ...c, cards: rest };
      });
    });
    startTransition(() => moveCard(cardId, columnId, 1_000_000));
  }
  /** Quick buttons on a card: show the change at once, save it, and roll back if saving fails. */
  function patch(cardId: string, change: QuickPatch) {
    const before = cols;
    setCols((prev) => prev.map((c) => ({ ...c, cards: c.cards.map((x) => (x.id === cardId ? { ...x, ...change } : x)) })));
    startTransition(async () => {
      try {
        await quickUpdateCard(cardId, change);
      } catch {
        setCols(before);
        toast.error(t.quick.saveFailed);
      }
    });
  }
  function remove(cardId: string) {
    setCols((prev) => prev.map((c) => ({ ...c, cards: c.cards.filter((x) => x.id !== cardId) })));
    startTransition(() => deleteCard(cardId));
  }

  const ctx: Ctx = {
    ...maps,
    today,
    columns: cols.map(({ id, name, isDone }) => ({ id, name, isDone })),
    editingId: editing?.id ?? null,
    display,
    open: setEditing,
    moveTo,
    remove,
    patch,
  };

  // Filters only hide cards. Drag handlers look cards up by id in the full `cols`, so a move while
  // filtering lands at the right spot among the hidden cards too.
  const filtering = hasFilters(filters);
  const filteredCols = filtering ? cols.map((c) => ({ ...c, cards: c.cards.filter((card) => matches(filters, card)) })) : cols;
  // "Show empty columns" off hides columns with nothing to show (never the one a drag is passing over).
  const visibleCols = display.emptyColumns ? filteredCols : filteredCols.filter((c) => c.cards.length > 0);
  const cardCount = cols.reduce((n, c) => n + c.cards.length, 0);

  function columnOf(key: string, list = cols) {
    if (isCol(key)) return list.find((c) => c.id === rawId(key));
    return list.find((c) => c.cards.some((card) => card.id === rawId(key)));
  }

  function onDragStart(e: DragStartEvent) {
    setActiveKey(String(e.active.id));
  }

  // Move a card across columns live while hovering.
  function onDragOver(e: DragOverEvent) {
    const active = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    if (!over || isCol(active)) return;
    setCols((prev) => {
      const from = columnOf(active, prev);
      const to = columnOf(over, prev);
      if (!from || !to || from.id === to.id) return prev;
      const card = from.cards.find((c) => c.id === rawId(active))!;
      const overIndex = isCol(over) ? to.cards.length : to.cards.findIndex((c) => c.id === rawId(over));
      const insertAt = overIndex < 0 ? to.cards.length : overIndex;
      return prev.map((c) => {
        if (c.id === from.id) return { ...c, cards: c.cards.filter((x) => x.id !== card.id) };
        if (c.id === to.id) {
          const next = [...c.cards];
          next.splice(insertAt, 0, { ...card, columnId: to.id });
          return { ...c, cards: next };
        }
        return c;
      });
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const active = String(e.active.id);
    const over = e.over ? String(e.over.id) : null;
    setActiveKey(null);
    if (!over) {
      setCols(initial);
      return;
    }

    if (isCol(active)) {
      const target = columnOf(over);
      const fromIdx = cols.findIndex((c) => c.id === rawId(active));
      const toIdx = target ? cols.findIndex((c) => c.id === target.id) : -1;
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
      setCols(arrayMove(cols, fromIdx, toIdx));
      startTransition(() => moveColumn(rawId(active), toIdx));
      return;
    }

    const col = columnOf(active);
    if (!col) return;
    const fromIdx = col.cards.findIndex((c) => c.id === rawId(active));
    let toIdx = fromIdx;
    if (!isCol(over) && columnOf(over)?.id === col.id) {
      toIdx = col.cards.findIndex((c) => c.id === rawId(over));
    }
    const nextCards = arrayMove(col.cards, fromIdx, toIdx);
    setCols(cols.map((c) => (c.id === col.id ? { ...c, cards: nextCards } : c)));
    startTransition(() => moveCard(rawId(active), col.id, toIdx));
  }

  const activeCard =
    activeKey && !isCol(activeKey) ? cols.flatMap((c) => c.cards).find((c) => c.id === rawId(activeKey)) : null;
  const activeDone = activeCard ? !!cols.find((c) => c.id === activeCard.columnId)?.isDone : false;

  return (
    <main className="flex h-full flex-col">
      <div className="border-b">
        <ViewBar
          boardId={board.id}
          active={layout}
          actions={
            <>
              <FiltersMenu value={filters} onChange={setFilters} members={members} tags={tags} currentUserId={currentUserId} />
              <DisplayMenu value={display} onChange={setDisplay} />
              <TagManager boardId={board.id} tags={tags} />
              {canDelete && <DeleteBoard board={board} />}
            </>
          }
        >
          {/* Plane-style breadcrumb: Boards › this board (renamable in place) */}
          <nav aria-label={t.nav.boards} className="flex min-w-0 items-center gap-1.5 text-sm">
            <span className="hidden text-muted-foreground sm:inline">{t.nav.boards}</span>
            <ChevronRight className="hidden size-3.5 text-muted-foreground/60 sm:inline" aria-hidden />
            <BoardMark id={board.id} name={board.name} />
            <BoardTitle board={board} />
          </nav>
          <span className="hidden text-xs text-muted-foreground tabular-nums lg:inline">{t.board.summary(cardCount, cols.length)}</span>
        </ViewBar>
        <AppliedFilters value={filters} onChange={setFilters} members={members} tags={tags} />
      </div>

      {layout === "list" ? (
        <ListView
          cols={visibleCols}
          ctx={ctx}
          backlogId={cols[0] && !cols[0].isDone && !cols[0].isInProgress ? cols[0].id : null}
          collapsed={collapsed}
          onToggleCollapse={toggleCollapsed}
        />
      ) : (
      <div className="flex-1 overflow-x-auto px-4 py-4 md:px-6">
        <DndContext
          id={dndId}
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => {
            setActiveKey(null);
            setCols(initial);
          }}
        >
          <div className="flex h-full items-start gap-3">
            <SortableContext items={visibleCols.map((c) => colKey(c.id))} strategy={horizontalListSortingStrategy}>
              {visibleCols.map((col) => (
                <Column
                  key={col.id}
                  column={col}
                  ctx={ctx}
                  first={col.id === cols[0]?.id && !col.isDone && !col.isInProgress}
                  collapsed={collapsed.includes(col.id)}
                  onToggleCollapse={() => toggleCollapsed(col.id)}
                />
              ))}
            </SortableContext>
            <AddColumn boardId={board.id} />
          </div>
          <DragOverlay>{activeCard && <CardView card={activeCard} ctx={ctx} done={activeDone} overlay />}</DragOverlay>
        </DndContext>
      </div>
      )}

      {editing && <CardEditor card={editing} members={members} boardTags={tags} onClose={() => setEditing(null)} />}
    </main>
  );
}

/** Square initial chip in the board's hue, as in the sidebar. */
function BoardMark({ id, name }: { id: string; name: string }) {
  return (
    <span aria-hidden className="avatar grid size-5 shrink-0 place-items-center rounded-sm text-[10px] font-semibold" style={{ "--hue": avatarHue(id) } as React.CSSProperties}>
      {name.trim()[0]?.toUpperCase() ?? "B"}
    </span>
  );
}

function BoardTitle({ board }: { board: { id: string; name: string } }) {
  const t = useT();
  const [name, setName] = useState(board.name);
  useEffect(() => setName(board.name), [board.name]);
  return (
    <input
      value={name}
      onChange={(e) => setName(e.target.value)}
      onBlur={() => name.trim() && name !== board.name && renameBoard(board.id, name)}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      size={Math.max(8, name.length)}
      className="max-w-full min-w-0 rounded-md bg-transparent px-1 py-0.5 text-sm font-semibold outline-none hover:bg-accent focus:bg-accent"
      aria-label={t.board.nameAria}
    />
  );
}

function DeleteBoard({ board }: { board: { id: string; name: string } }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={t.board.options}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem variant="destructive" onSelect={() => setOpen(true)}>
            <Trash2 /> {t.board.deleteBoard}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.board.deleteTitle(board.name)}</DialogTitle>
            <DialogDescription>{t.board.deleteBody}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t.board.keepBoard}</Button>
            </DialogClose>
            <Button variant="destructive" disabled={pending} onClick={() => startTransition(() => deleteBoard(board.id))}>
              <Trash2 /> {t.board.deleteBoard}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Column({
  column,
  ctx,
  first,
  collapsed,
  onToggleCollapse,
}: {
  column: ColumnData;
  ctx: Ctx;
  /** The board's first column, drawn as the backlog. */
  first: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: colKey(column.id),
  });
  const [name, setName] = useState(column.name);
  const [isDone, setIsDone] = useState(column.isDone);
  const [isInProgress, setIsInProgress] = useState(column.isInProgress);
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const [adding, setAdding] = useState(false);
  useEffect(() => setName(column.name), [column.name]);
  useEffect(() => setIsDone(column.isDone), [column.isDone]);
  useEffect(() => setIsInProgress(column.isInProgress), [column.isInProgress]);

  // Plane-style collapsed column: a narrow strip with the name running vertically. Still a drop target.
  if (collapsed) {
    return (
      <section
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        className={cn("flex max-h-full w-11 shrink-0 flex-col rounded-xl bg-muted/70 p-1 dark:bg-black/20", isDragging && "opacity-50")}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          title={t.column.expand(column.name)}
          className="flex cursor-pointer flex-col items-center gap-1 rounded-md py-1.5 text-[13px] outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <UnfoldHorizontal className="size-3.5 text-muted-foreground" aria-hidden />
          <StateIcon done={isDone} inProgress={isInProgress} first={first} className="size-3.5" />
          <span className="max-h-80 truncate font-medium [writing-mode:vertical-lr]">{column.name}</span>
          <span className="text-[13px] font-medium text-muted-foreground tabular-nums">{column.cards.length}</span>
        </button>
      </section>
    );
  }

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("flex max-h-full w-[350px] shrink-0 flex-col rounded-xl bg-muted/70 px-2 pb-2 dark:bg-black/20", isDragging && "opacity-50")}
    >
      {/* Plane-style group header: state glyph, name, count; tools show on hover. The grip is the glyph. */}
      <header className="group/col flex shrink-0 items-center gap-1 px-1 py-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <span {...attributes} {...listeners} aria-label={t.column.drag} className="grid size-5 cursor-grab place-items-center rounded-sm hover:bg-accent">
              <span className="group-hover/col:hidden">
                <StateIcon done={isDone} inProgress={isInProgress} first={first} />
              </span>
              <GripVertical className="hidden size-3.5 text-muted-foreground group-hover/col:block" />
            </span>
          </TooltipTrigger>
          <TooltipContent>{isDone ? t.column.countsAsDone : isInProgress ? t.column.countsAsInProgress : t.column.drag}</TooltipContent>
        </Tooltip>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== column.name && renameColumn(column.id, name)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          size={Math.max(4, name.length)}
          className="max-w-48 min-w-0 rounded-sm bg-transparent px-1 py-0.5 text-[13px] font-medium outline-none hover:bg-accent focus:bg-card"
          aria-label={t.column.nameAria}
        />
        <span className="pl-1 text-[13px] font-medium text-muted-foreground tabular-nums">{column.cards.length}</span>
        <span className="ml-auto flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" className="size-5 [&_svg]:size-3.5" aria-label={t.column.collapseAria} onClick={onToggleCollapse}>
                <FoldHorizontal />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.column.collapse}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-xs" className="size-5 [&_svg]:size-3.5" aria-label={t.column.addCard} onClick={() => setAdding(true)}>
                <Plus />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t.column.addCard}</TooltipContent>
          </Tooltip>
        <DropdownMenu onOpenChange={(open) => !open && setConfirming(false)}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" className="size-5 [&_svg]:size-3.5" aria-label={t.column.options}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuCheckboxItem
              checked={isDone}
              onCheckedChange={(v) => {
                setIsDone(!!v);
                if (v) setIsInProgress(false);
                setColumnDone(column.id, !!v);
              }}
            >
              <span>
                {t.column.cardsDone}
                <span className="block text-xs text-muted-foreground">{t.column.cardsDoneHint}</span>
              </span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              checked={isInProgress}
              onCheckedChange={(v) => {
                setIsInProgress(!!v);
                if (v) setIsDone(false);
                setColumnInProgress(column.id, !!v);
              }}
            >
              <span>
                {t.column.cardsInProgress}
                <span className="block text-xs text-muted-foreground">{t.column.cardsInProgressHint}</span>
              </span>
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={(e) => {
                if (!confirming) {
                  e.preventDefault();
                  setConfirming(true);
                } else deleteColumn(column.id);
              }}
            >
              <Trash2 />
              {confirming ? t.column.confirmDelete(column.cards.length) : t.column.deleteColumn}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </span>
      </header>
      <div className="-mx-0.5 flex min-h-[120px] flex-col gap-2 overflow-y-auto p-0.5">
        <SortableContext items={column.cards.map((c) => cardKey(c.id))} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => (
            <SortableCard key={card.id} card={card} ctx={ctx} done={column.isDone} />
          ))}
        </SortableContext>
      </div>
      <AddCard columnId={column.id} open={adding} setOpen={setAdding} />
    </section>
  );
}

function SortableCard({ card, ctx, done }: { card: CardData; ctx: Ctx; done: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: cardKey(card.id),
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "group/card relative rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        isDragging && "opacity-30",
      )}
      {...attributes}
      {...listeners}
      onClick={() => ctx.open(card)}
    >
      <CardView card={card} ctx={ctx} done={done} />
      {!isDragging && <CardMenu card={card} ctx={ctx} />}
    </div>
  );
}

/** Plane's hover quick actions on a card: open, move to another column, delete. */
function CardMenu({ card, ctx, className }: { card: CardData; ctx: Ctx; className?: string }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  // The menu lives inside the draggable card (and React events bubble out of its portal), so keep
  // its clicks and key presses from opening the card or starting a drag.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div
      className={cn(
        "absolute top-2 right-2 rounded-md bg-card opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100 has-data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100",
        className,
      )}
      onPointerDown={stop}
      onClick={stop}
      onKeyDown={stop}
    >
      <DropdownMenu onOpenChange={(open) => !open && setConfirming(false)}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-xs" className="size-6 text-muted-foreground [&_svg]:size-3.5" aria-label={t.card.actionsFor(card.title)}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => ctx.open(card)}>
            <SquarePen /> {t.card.open}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowRightLeft /> {t.card.moveTo}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
              {ctx.columns.map((c) => (
                <DropdownMenuItem key={c.id} disabled={c.id === card.columnId} onSelect={() => ctx.moveTo(card.id, c.id)}>
                  {c.isDone && <CircleCheck className="text-success" />}
                  <span className="truncate">{c.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={(e) => {
              if (!confirming) {
                e.preventDefault();
                setConfirming(true);
              } else ctx.remove(card.id);
            }}
          >
            <Trash2 /> {confirming ? t.card.confirmDelete : t.card.delete}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Plane-style card: title, then one row of property chips (priority, dates, tags, people). */
function CardView({ card, ctx, done, overlay }: { card: CardData; ctx: Ctx; done: boolean; overlay?: boolean }) {
  const show = ctx.display;
  const cardTags = show.tags ? card.tagIds.map((id) => ctx.tagById.get(id)).filter((t): t is Tag => !!t) : [];
  const people = card.assigneeIds.map((id) => ctx.memberById.get(id)).filter((m): m is Member => !!m);
  const late = !done && !!card.dueDate && card.dueDate < ctx.today;
  const tagChips = cardTags.map((t) => <TagBadge key={t.id} tag={t} />);
  return (
    <article
      className={cn(
        "cursor-pointer rounded-lg border bg-card p-3 text-[13px] shadow-xs transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-sm",
        late && "border-destructive/30 hover:border-destructive/50",
        ctx.editingId === card.id && "border-primary ring-1 ring-primary hover:border-primary",
        overlay && "rotate-1 shadow-lg",
      )}
    >
      {/* One line, like Plane; the full title is on hover */}
      <h3 title={card.title} className={cn("line-clamp-1 pr-6 leading-5 font-medium break-all", done && "text-muted-foreground line-through decoration-muted-foreground/40")}>
        {card.title}
      </h3>
      {show.description && card.description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{card.description}</p>}
      {overlay ? (
        <div className="flex flex-wrap items-center gap-2 pt-2">
          {show.priority && card.priority && (
            <span className="grid size-5 place-items-center rounded-sm border border-border-strong">
              <PriorityIcon priority={card.priority} className="size-3" />
            </span>
          )}
          {show.dates && <DueBadge start={card.startDate} due={card.dueDate} today={ctx.today} done={done} />}
          {tagChips}
          {show.assignees && (
            <span className="ml-auto">
              <AvatarStack members={people} size={20} />
            </span>
          )}
        </div>
      ) : (
        <CardQuickProps card={card} members={[...ctx.memberById.values()]} today={ctx.today} done={done} show={show} onPatch={(p) => ctx.patch(card.id, p)}>
          {tagChips}
        </CardQuickProps>
      )}
    </article>
  );
}

/** Plane's quick add: a "+ New card" row under the column; it opens a card-shaped field, Enter adds and stays open. */
function AddCard({ columnId, open, setOpen }: { columnId: string; open: boolean; setOpen: (open: boolean) => void }) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 flex w-full shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-medium text-muted-foreground outline-none hover:bg-foreground/[0.05] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Plus className="size-3.5" /> {t.column.newCard}
      </button>
    );
  }
  const submit = () => {
    if (!title.trim() || pending) return;
    startTransition(async () => {
      await addCard(columnId, title);
      setTitle("");
    });
  };
  return (
    <div className="m-0.5 mt-1 overflow-hidden rounded-lg border bg-card shadow-sm">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") setOpen(false);
        }}
        onBlur={() => !title.trim() && setOpen(false)}
        maxLength={200}
        disabled={pending}
        placeholder={t.column.addPlaceholder}
        aria-label={t.column.addCard}
        className="w-full bg-transparent px-3 py-3 text-[13px] font-medium outline-none placeholder:text-muted-foreground"
      />
      <div className="bg-muted/60 px-3 py-2 text-[11px] text-muted-foreground italic">{t.column.addHint}</div>
    </div>
  );
}

// ---------- List layout (Plane's list) ----------

/**
 * Plane's list layout: a grey band per column (state icon, name, count, add), then a row per card with
 * the title on the left and the same property chips on the right. Click a band to fold it.
 */
function ListView({
  cols,
  ctx,
  backlogId,
  collapsed,
  onToggleCollapse,
}: {
  cols: ColumnData[];
  ctx: Ctx;
  backlogId: string | null;
  collapsed: string[];
  onToggleCollapse: (id: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      {cols.map((col) => (
        <ListGroup key={col.id} column={col} ctx={ctx} first={col.id === backlogId} folded={collapsed.includes(col.id)} onToggle={() => onToggleCollapse(col.id)} />
      ))}
    </div>
  );
}

function ListGroup({ column, ctx, first, folded, onToggle }: { column: ColumnData; ctx: Ctx; first: boolean; folded: boolean; onToggle: () => void }) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  return (
    <section aria-label={column.name}>
      <div className="sticky top-0 z-[2] flex items-center gap-2 border-b bg-muted/70 py-1 pr-4 pl-4 backdrop-blur-sm hover:bg-muted md:pl-6">
        <button type="button" onClick={onToggle} aria-expanded={!folded} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 py-1.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", !folded && "rotate-90")} />
          <StateIcon done={column.isDone} inProgress={column.isInProgress} first={first} className="size-3.5" />
          <span className="truncate text-[13px] font-medium">{column.name}</span>
          <span className="pl-1 text-[13px] font-medium text-muted-foreground tabular-nums">{column.cards.length}</span>
        </button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="size-5 [&_svg]:size-3.5"
              aria-label={t.column.addCard}
              onClick={() => {
                if (folded) onToggle();
                setAdding(true);
              }}
            >
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t.column.addCard}</TooltipContent>
        </Tooltip>
      </div>
      {!folded && (
        <>
          <ul>
            {column.cards.map((card) => (
              <ListRow key={card.id} card={card} ctx={ctx} done={column.isDone} />
            ))}
          </ul>
          <ListQuickAdd columnId={column.id} open={adding} setOpen={setAdding} />
        </>
      )}
    </section>
  );
}

/** One card as a list row: title, then the property chips and the card menu on the right. */
function ListRow({ card, ctx, done }: { card: CardData; ctx: Ctx; done: boolean }) {
  const show = ctx.display;
  const cardTags = show.tags ? card.tagIds.map((id) => ctx.tagById.get(id)).filter((t): t is Tag => !!t) : [];
  const late = !done && !!card.dueDate && card.dueDate < ctx.today;
  return (
    <li
      className={cn(
        "group/card relative flex min-h-11 cursor-pointer flex-col gap-2 border-b py-2.5 pr-4 pl-4 text-[13px] transition-colors hover:bg-foreground/[0.03] md:flex-row md:items-center md:pl-6",
        ctx.editingId === card.id && "bg-brand-soft/60",
      )}
      onClick={() => ctx.open(card)}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {late && <span className="size-1.5 shrink-0 rounded-full bg-destructive" aria-hidden />}
        <span title={card.title} className={cn("truncate font-medium", done && "text-muted-foreground line-through decoration-muted-foreground/40")}>
          {card.title}
        </span>
        {show.description && card.description && <span className="hidden truncate text-xs text-muted-foreground lg:inline">{card.description}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-2 [&>div]:pt-0">
        <CardQuickProps card={card} members={[...ctx.memberById.values()]} today={ctx.today} done={done} show={show} onPatch={(p) => ctx.patch(card.id, p)}>
          {cardTags.map((t) => (
            <TagBadge key={t.id} tag={t} />
          ))}
        </CardQuickProps>
        <CardMenu card={card} ctx={ctx} className="static" />
      </span>
    </li>
  );
}

/** Plane's list quick add: a "+ New card" row; Enter adds and keeps the field open. */
function ListQuickAdd({ columnId, open, setOpen }: { columnId: string; open: boolean; setOpen: (open: boolean) => void }) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full cursor-pointer items-center gap-2 border-b py-2.5 pr-4 pl-4 text-[13px] font-medium text-muted-foreground outline-none hover:bg-foreground/[0.03] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:pl-6"
      >
        <Plus className="size-3.5" /> {t.column.newCard}
      </button>
    );
  return (
    <div className="flex items-center gap-3 border-b bg-card py-1 pr-4 pl-4 shadow-sm md:pl-6">
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && title.trim() && !pending) {
            e.preventDefault();
            startTransition(async () => {
              await addCard(columnId, title);
              setTitle("");
            });
          }
          if (e.key === "Escape") setOpen(false);
        }}
        onBlur={() => !title.trim() && setOpen(false)}
        maxLength={200}
        disabled={pending}
        placeholder={t.column.addPlaceholder}
        aria-label={t.column.addCard}
        className="min-w-0 flex-1 bg-transparent py-2 text-[13px] font-medium outline-none placeholder:text-muted-foreground"
      />
      <span className="hidden shrink-0 text-[11px] text-muted-foreground italic sm:inline">{t.column.addHint}</span>
    </div>
  );
}

function AddColumn({ boardId }: { boardId: string }) {
  const t = useT();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="w-[350px] shrink-0"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        startTransition(async () => {
          await addColumn(boardId, name);
          setName("");
        });
      }}
    >
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        disabled={pending}
        placeholder={t.board.addColumn}
        aria-label={t.board.newColumnAria}
        className="h-11 rounded-xl border-dashed bg-transparent shadow-none"
      />
    </form>
  );
}
