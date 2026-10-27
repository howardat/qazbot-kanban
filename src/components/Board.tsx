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
  CircleCheck,
  CircleDot,
  FoldHorizontal,
  GripVertical,
  MoreHorizontal,
  Plus,
  SquarePen,
  Trash2,
  UnfoldHorizontal,
  X,
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
import { Avatar, AvatarStack, DueBadge, TagBadge } from "@/components/atoms";
import { CardQuickProps, type QuickPatch } from "@/components/CardQuickProps";
import { CardEditor } from "@/components/CardEditor";
import { useT } from "@/components/I18nProvider";
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
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ISODate } from "@/lib/dates";
import { displayName, type CardData, type Member, type Tag } from "@/lib/types";
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
}: {
  board: { id: string; name: string };
  columns: ColumnData[];
  members: Member[];
  tags: Tag[];
  today: ISODate;
  currentUserId: string;
  canDelete: boolean;
}) {
  const t = useT();
  const dndId = useId();
  const [cols, setCols] = useState(initial);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [editing, setEditing] = useState<CardData | null>(null);
  const [personFilter, setPersonFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
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
    open: setEditing,
    moveTo,
    remove,
    patch,
  };

  // Filters only hide cards. Drag handlers look cards up by id in the full `cols`, so a move while
  // filtering lands at the right spot among the hidden cards too.
  const filtering = !!personFilter || !!tagFilter;
  const visibleCols = filtering
    ? cols.map((c) => ({
        ...c,
        cards: c.cards.filter(
          (card) =>
            (!personFilter || card.assigneeIds.includes(personFilter)) && (!tagFilter || card.tagIds.includes(tagFilter)),
        ),
      }))
    : cols;
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
          active="board"
          actions={
            <>
              <TagManager boardId={board.id} tags={tags} />
              {canDelete && <DeleteBoard board={board} />}
            </>
          }
        >
          <BoardTitle board={board} />
          <span className="hidden text-xs text-muted-foreground tabular-nums lg:inline">
            {t.board.summary(cardCount, cols.length)}
          </span>
        </ViewBar>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 md:px-6">
          <div className="flex items-center gap-1.5" role="group" aria-label={t.board.byPerson}>
            <FilterPill
              active={personFilter === currentUserId}
              onClick={() => setPersonFilter(personFilter === currentUserId ? null : currentUserId)}
            >
              {t.board.myCards}
            </FilterPill>
            {/* Wide enough gaps that a selected person's ring isn't covered by the next avatar. */}
            <div className="flex items-center gap-2 px-0.5">
              {members.map((m) => (
                <Tooltip key={m.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      aria-pressed={personFilter === m.id}
                      aria-label={t.board.showFor(displayName(m))}
                      onClick={() => setPersonFilter(personFilter === m.id ? null : m.id)}
                      className={cn(
                        "grid size-6 cursor-pointer place-items-center rounded-full outline-none transition focus-visible:ring-3 focus-visible:ring-ring/50",
                        personFilter === m.id ? "ring-2 ring-brand ring-offset-1 ring-offset-card" : "opacity-75 hover:opacity-100",
                      )}
                    >
                      <Avatar member={m} size={24} className="pointer-events-none ring-0" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>{displayName(m)}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t.board.byTag}>
              {tags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={tagFilter === t.id}
                  onClick={() => setTagFilter(tagFilter === t.id ? null : t.id)}
                  className={cn(
                    "cursor-pointer rounded-md transition",
                    tagFilter === t.id ? "ring-2 ring-brand ring-offset-1 ring-offset-card" : "opacity-80 hover:opacity-100",
                  )}
                >
                  <TagBadge tag={t} />
                </button>
              ))}
            </div>
          )}
          {filtering && (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setPersonFilter(null);
                  setTagFilter(null);
                }}
              >
                <X /> {t.board.clearFilters}
              </Button>
              {t.board.dragPaused}
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto bg-tray px-4 py-3 md:px-6">
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
          <div className="flex h-full items-start gap-4">
            <SortableContext items={visibleCols.map((c) => colKey(c.id))} strategy={horizontalListSortingStrategy}>
              {visibleCols.map((col) => (
                <Column
                  key={col.id}
                  column={col}
                  ctx={ctx}
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

      {editing && <CardEditor card={editing} members={members} boardTags={tags} onClose={() => setEditing(null)} />}
    </main>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "h-7 cursor-pointer rounded-md border px-2.5 text-xs font-medium transition-colors",
        active
          ? "border-primary/30 bg-brand-soft text-primary"
          : "border-input bg-card text-muted-foreground shadow-xs hover:bg-secondary hover:text-foreground",
      )}
    >
      {children}
    </button>
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
      className="-ml-1 max-w-full min-w-0 rounded-md bg-transparent px-1 py-0.5 text-base font-semibold tracking-tight outline-none hover:bg-accent focus:bg-accent"
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
  collapsed,
  onToggleCollapse,
}: {
  column: ColumnData;
  ctx: Ctx;
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
        className={cn("flex max-h-full w-10 shrink-0 flex-col", isDragging && "opacity-50")}
      >
        <button
          type="button"
          onClick={onToggleCollapse}
          title={t.column.expand(column.name)}
          className="flex cursor-pointer flex-col items-center gap-2 rounded-md py-2 text-sm outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <UnfoldHorizontal className="size-3.5 text-muted-foreground" aria-hidden />
          {isDone && <CircleCheck className="size-3.5 text-success" aria-label={t.column.doneColumn} />}
          {isInProgress && <CircleDot className="size-3.5 text-primary" aria-label={t.column.inProgressColumn} />}
          <span className="max-h-80 truncate font-medium [writing-mode:vertical-lr]">{column.name}</span>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">{column.cards.length}</span>
        </button>
      </section>
    );
  }

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn("flex max-h-full w-80 shrink-0 flex-col", isDragging && "opacity-50")}
    >
      <header className="flex h-9 shrink-0 items-center gap-1">
        <span
          {...attributes}
          {...listeners}
          className={cn(
            "cursor-grab rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground",
          )}
          aria-label={t.column.drag}
        >
          <GripVertical className="size-4" />
        </span>
        {isDone && (
          <Tooltip>
            <TooltipTrigger asChild>
              <CircleCheck className="size-4 shrink-0 text-success" aria-label={t.column.doneColumn} />
            </TooltipTrigger>
            <TooltipContent>{t.column.countsAsDone}</TooltipContent>
          </Tooltip>
        )}
        {isInProgress && (
          <Tooltip>
            <TooltipTrigger asChild>
              <CircleDot className="size-4 shrink-0 text-primary" aria-label={t.column.inProgressColumn} />
            </TooltipTrigger>
            <TooltipContent>{t.column.countsAsInProgress}</TooltipContent>
          </Tooltip>
        )}
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== column.name && renameColumn(column.id, name)}
          onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          className="min-w-0 flex-1 rounded-sm bg-transparent px-1 py-0.5 text-sm font-medium outline-none hover:bg-accent focus:bg-card"
          aria-label={t.column.nameAria}
        />
        <span className="px-1 text-xs font-medium text-muted-foreground tabular-nums">
          {column.cards.length}
        </span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={t.column.collapseAria} onClick={onToggleCollapse}>
              <FoldHorizontal />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t.column.collapse}</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={t.column.addCard} onClick={() => setAdding(true)}>
              <Plus />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t.column.addCard}</TooltipContent>
        </Tooltip>
        <DropdownMenu onOpenChange={(open) => !open && setConfirming(false)}>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label={t.column.options}>
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
      </header>
      <div className="-mx-0.5 flex min-h-12 flex-col gap-2 overflow-y-auto p-0.5">
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
function CardMenu({ card, ctx }: { card: CardData; ctx: Ctx }) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  // The menu lives inside the draggable card (and React events bubble out of its portal), so keep
  // its clicks and key presses from opening the card or starting a drag.
  const stop = (e: React.SyntheticEvent) => e.stopPropagation();
  return (
    <div
      className="absolute top-2 right-2 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100 has-data-[state=open]:opacity-100 [@media(hover:none)]:opacity-100"
      onPointerDown={stop}
      onClick={stop}
      onKeyDown={stop}
    >
      <DropdownMenu onOpenChange={(open) => !open && setConfirming(false)}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon-xs" aria-label={t.card.actionsFor(card.title)}>
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

function CardView({ card, ctx, done, overlay }: { card: CardData; ctx: Ctx; done: boolean; overlay?: boolean }) {
  const cardTags = card.tagIds.map((id) => ctx.tagById.get(id)).filter((t): t is Tag => !!t);
  const people = card.assigneeIds.map((id) => ctx.memberById.get(id)).filter((m): m is Member => !!m);
  const late = !done && !!card.dueDate && card.dueDate < ctx.today;
  return (
    <article
      className={cn(
        "cursor-pointer rounded-lg border bg-card p-3 text-sm shadow-xs transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-sm",
        late && "border-destructive/30 hover:border-destructive/50",
        ctx.editingId === card.id && "border-primary hover:border-primary",
        overlay && "rotate-1 shadow-lg",
      )}
    >
      <h3
        className={cn(
          "pr-5 leading-snug font-medium break-words",
          done && "text-muted-foreground line-through decoration-muted-foreground/40",
        )}
      >
        {card.title}
      </h3>
      {card.description && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{card.description}</p>
      )}
      {cardTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {cardTags.map((t) => (
            <TagBadge key={t.id} tag={t} />
          ))}
        </div>
      )}
      {/* Properties row, as on Plane's cards: priority, dates and people, each editable in place */}
      <div className="mt-2.5">
        {overlay ? (
          <div className="flex items-center gap-1.5">
            <DueBadge start={card.startDate} due={card.dueDate} today={ctx.today} done={done} />
            <span className="ml-auto">
              <AvatarStack members={people} size={20} />
            </span>
          </div>
        ) : (
          <CardQuickProps card={card} members={[...ctx.memberById.values()]} today={ctx.today} done={done} onPatch={(p) => ctx.patch(card.id, p)} />
        )}
      </div>
    </article>
  );
}

function AddCard({ columnId, open, setOpen }: { columnId: string; open: boolean; setOpen: (open: boolean) => void }) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-1.5 flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <Plus className="size-4" /> {t.column.addCard}
      </button>
    );
  }
  return (
    <form
      className="mt-1.5 flex flex-col gap-2 p-0.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        startTransition(async () => {
          await addCard(columnId, title);
          setTitle("");
        });
      }}
    >
      <Textarea
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
          if (e.key === "Escape") setOpen(false);
        }}
        placeholder={t.column.addPlaceholder}
        rows={2}
        className="min-h-16 bg-card"
      />
      <div className="flex gap-1">
        <Button size="sm" disabled={pending}>
          {t.column.addCard}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          {t.common.cancel}
        </Button>
      </div>
    </form>
  );
}

function AddColumn({ boardId }: { boardId: string }) {
  const t = useT();
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="w-80 shrink-0"
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
        className="h-9 border-dashed bg-transparent shadow-none"
      />
    </form>
  );
}
