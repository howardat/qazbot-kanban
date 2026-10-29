"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  Settings2,
  SquarePen,
  Trash2,
  UnfoldHorizontal,
} from "lucide-react";
import {
  addCard,
  addColumn,
  createTag,
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
import { TagBadge, BoardIcon } from "@/components/atoms";
import { CardQuickProps, type QuickPatch } from "@/components/CardQuickProps";
import { CardEditor } from "@/components/CardEditor";
import { useT } from "@/components/I18nProvider";
import { AppliedFilters, DisplayMenu, FiltersMenu, hasFilters, matches, NO_FILTERS, SortMenu, StateIcon, useDisplay, useSort, type Display, type Filters } from "@/components/BoardToolbar";
import { BoardCard } from "@/components/BoardCard";
import { BoardSettings, type BoardInfo } from "@/components/BoardSettings";
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
import { sortCards } from "@/lib/card-sort";
import { addDays, type ISODate } from "@/lib/dates";
import { TAG_COLORS } from "@/lib/tag-colors";
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
  currentUserId: string;
  columns: { id: string; name: string; isDone: boolean }[];
  editingId: string | null;
  display: Display;
  open: (card: CardData) => void;
  moveTo: (cardId: string, columnId: string) => void;
  remove: (cardId: string) => void;
  patch: (cardId: string, patch: QuickPatch) => void;
  /** The board's labels, including ones just made from a card. */
  tags: Tag[];
  createLabel: (card: CardData, name: string) => void;
  /** People who may be newly assigned here: everyone, or a private board's audience. */
  assignable: Member[];
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
  assignableIds,
  layout = "board",
}: {
  board: BoardInfo;
  columns: ColumnData[];
  members: Member[];
  tags: Tag[];
  today: ISODate;
  currentUserId: string;
  canDelete: boolean;
  /** On a private board, who may be assigned (its members and creator); null when it's open to all. */
  assignableIds: string[] | null;
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
  const [sort, setSort] = useSort(board.id);
  // Where a dragged card started, so a drag inside a sorted column changes nothing.
  const dragFrom = useRef<string | null>(null);
  const [collapsed, toggleCollapsed] = useCollapsed(board.id);
  const [, startTransition] = useTransition();

  // ?card=<id> (from search) opens that card's panel, then leaves the URL clean.
  const params = useSearchParams();
  const router = useRouter();
  const wanted = params.get("card");
  useEffect(() => {
    if (!wanted) return;
    const card = initial.flatMap((c) => c.cards).find((c) => c.id === wanted);
    if (card) setEditing(card);
    router.replace(layout === "list" ? `/boards/${board.id}/list` : `/boards/${board.id}`, { scroll: false });
  }, [wanted, initial, router, board.id, layout]);

  // Server data wins whenever it changes (after revalidation), unless a drag is in progress.
  useEffect(() => {
    if (!activeKey) setCols(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Labels made from a card's picker show at once, before the refreshed board brings them in.
  const [madeTags, setMadeTags] = useState<Tag[]>([]);
  const allTags = useMemo(() => [...tags, ...madeTags.filter((m) => !tags.some((x) => x.id === m.id))], [tags, madeTags]);
  // A private board only takes assignees who can see it.
  const assignable = useMemo(() => (assignableIds ? members.filter((m) => assignableIds.includes(m.id)) : members), [members, assignableIds]);
  const maps = useMemo(
    () => ({ memberById: new Map(members.map((m) => [m.id, m])), tagById: new Map(allTags.map((t) => [t.id, t])) }),
    [members, allTags],
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
  /** A label typed into a card's picker: create it with the next palette colour and put it on the card. */
  function createLabel(card: CardData, name: string) {
    startTransition(async () => {
      try {
        const tag = await createTag(board.id, { name, color: TAG_COLORS[allTags.length % TAG_COLORS.length] });
        setMadeTags((list) => [...list, tag]);
        patch(card.id, { tagIds: [...card.tagIds, tag.id] });
      } catch {
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
    currentUserId,
    columns: cols.map(({ id, name, isDone }) => ({ id, name, isDone })),
    editingId: editing?.id ?? null,
    display,
    tags: allTags,
    createLabel,
    open: setEditing,
    moveTo,
    remove,
    patch,
    assignable,
  };

  // Filters only hide cards. Drag handlers look cards up by id in the full `cols`, so a move while
  // filtering lands at the right spot among the hidden cards too.
  const filtering = hasFilters(filters);
  const filteredCols = filtering ? cols.map((c) => ({ ...c, cards: c.cards.filter((card) => matches(filters, card)) })) : cols;
  // "Show empty columns" off hides columns with nothing to show (never the one a drag is passing over).
  const shownCols = display.emptyColumns ? filteredCols : filteredCols.filter((c) => c.cards.length > 0);
  // "Order by" only changes what's drawn; the stored (manual) order stays as it is.
  const nameOf = (profileId: string) => {
    const m = maps.memberById.get(profileId);
    return m ? displayName(m) : "";
  };
  const visibleCols = sort.key === "manual" ? shownCols : shownCols.map((c) => ({ ...c, cards: sortCards(c.cards, sort, nameOf) }));
  const cardCount = cols.reduce((n, c) => n + c.cards.length, 0);

  function columnOf(key: string, list = cols) {
    if (isCol(key)) return list.find((c) => c.id === rawId(key));
    return list.find((c) => c.cards.some((card) => card.id === rawId(key)));
  }

  function onDragStart(e: DragStartEvent) {
    setActiveKey(String(e.active.id));
    dragFrom.current = columnOf(String(e.active.id))?.id ?? null;
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
    // Sorted columns have no manual order to change: a drop in the same column is a no-op, and a
    // drop in another column just moves the card there.
    if (sort.key !== "manual") {
      if (col.id !== dragFrom.current) startTransition(() => moveCard(rawId(active), col.id, 1_000_000));
      return;
    }
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
              <SortMenu value={sort} onChange={setSort} />
              <DisplayMenu value={display} onChange={setDisplay} />
              <TagManager boardId={board.id} tags={tags} />
              <BoardMenu board={board} members={members} canDelete={canDelete} />
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

      {editing && <CardEditor card={editing} members={members} assignable={assignable} boardTags={allTags} onClose={() => setEditing(null)} />}
    </main>
  );
}

/** The board's icon, as in the sidebar. */
function BoardMark({ id, name }: { id: string; name: string }) {
  return <BoardIcon board={{ id, name }} size={20} />;
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

/** The board's "…" menu: settings for everyone who sees it, delete for its creator and admins. */
function BoardMenu({ board, members, canDelete }: { board: BoardInfo; members: Member[]; canDelete: boolean }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={t.board.options}>
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setSettings(true)}>
            <Settings2 /> {t.board.settings}
          </DropdownMenuItem>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => setOpen(true)}>
                <Trash2 /> {t.board.deleteBoard}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <BoardSettings board={board} members={members} open={settings} onOpenChange={setSettings} />
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
        className={cn("flex max-h-full w-11 shrink-0 flex-col rounded-xl bg-muted/45 p-1 dark:bg-black/15", isDragging && "opacity-50")}
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
      className={cn("flex max-h-full w-[350px] shrink-0 flex-col rounded-xl bg-muted/45 px-2 pb-2 dark:bg-black/15", isDragging && "opacity-50")}
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
      <div className="-mx-0.5 flex min-h-2 flex-col gap-2 overflow-y-auto p-0.5">
        <SortableContext items={column.cards.map((c) => cardKey(c.id))} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => (
            <SortableCard key={card.id} card={card} ctx={ctx} done={column.isDone} />
          ))}
        </SortableContext>
        <AddCard column={column} ctx={ctx} open={adding} setOpen={setAdding} />
      </div>
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
  // Opening the card from here must not hand focus back to the ⋯ button as the menu closes: that focus
  // lands outside the side panel, which reads it as a click away and closes again at once.
  const opening = useRef(false);
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
        <DropdownMenuContent
          align="end"
          className="w-52"
          onCloseAutoFocus={(e) => {
            if (opening.current) e.preventDefault();
            opening.current = false;
          }}
        >
          <DropdownMenuItem
            onSelect={() => {
              opening.current = true;
              ctx.open(card);
            }}
          >
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

/** A card on the board: see BoardCard. The drag overlay draws the same card without controls. */
function CardView({ card, ctx, done, overlay }: { card: CardData; ctx: Ctx; done: boolean; overlay?: boolean }) {
  return (
    <BoardCard
      card={card}
      done={done}
      members={ctx.memberById}
      assignable={ctx.assignable}
      tags={ctx.tags}
      today={ctx.today}
      selected={ctx.editingId === card.id}
      overlay={overlay}
      show={ctx.display}
      onPatch={(p) => ctx.patch(card.id, p)}
      onCreateTag={(name) => ctx.createLabel(card, name)}
    />
  );
}

/**
 * Quick-add rules shared by the board and list layouts. The draft is a card like any other (title plus
 * the same priority, deadline and people chips) that only exists here until it has a title. Enter saves
 * and starts a fresh draft, moving focus away saves it (a blank draft is just dropped), Esc discards.
 */
function useQuickAdd(column: ColumnData, ctx: Ctx, setOpen: (open: boolean) => void) {
  // The same defaults the server gives a new card: due tomorrow, assigned to whoever adds it.
  const fresh = (): Required<Pick<CardData, "priority" | "dueDate" | "assigneeIds">> => ({
    priority: null,
    dueDate: addDays(ctx.today, 1),
    // New cards go to whoever adds them, if they may be assigned on this board.
    assigneeIds: ctx.assignable.some((m) => m.id === ctx.currentUserId) ? [ctx.currentUserId] : [],
  });
  const [title, setTitle] = useState("");
  const [props, setProps] = useState(fresh);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const discarded = useRef(false);

  const close = () => {
    setTitle("");
    setProps(fresh());
    setOpen(false);
  };
  const commit = (keepOpen: boolean) => {
    const text = title.trim();
    if (!text) {
      if (!keepOpen) close();
      return;
    }
    if (saving.current) return;
    saving.current = true;
    startTransition(async () => {
      try {
        await addCard(column.id, text, undefined, props);
      } finally {
        saving.current = false;
      }
      if (!keepOpen) return close();
      setTitle("");
      setProps(fresh());
      inputRef.current?.focus();
    });
  };

  const draft: CardData = {
    id: "draft",
    boardId: "",
    columnId: column.id,
    title,
    description: "",
    startDate: null,
    storyPoints: null,
    createdBy: ctx.currentUserId,
    createdVia: "app",
    createdAt: new Date(0).toISOString(),
    tagIds: [],
    ...props,
  };

  return {
    draft,
    pending,
    // The draft has no labels chip, so only priority, deadline and people come through here.
    onPatch: (p: Omit<QuickPatch, "tagIds">) => setProps((prev) => ({ ...prev, ...p })),
    // On the draft's wrapper: focus moving to its own chips, or into their menus and pickers (portalled),
    // still counts as being on the draft.
    draftProps: {
      onFocus: () => (discarded.current = false),
      // Clicking a chip keeps focus in the title (Safari doesn't focus buttons on click, so the blur
      // below would otherwise see focus leave the draft).
      onMouseDown: (e: React.MouseEvent<HTMLElement>) => {
        if (e.currentTarget.contains(e.target as Node) && e.target !== inputRef.current) e.preventDefault();
      },
      onBlur: (e: React.FocusEvent<HTMLElement>) => {
        const next = e.relatedTarget;
        if (next && (e.currentTarget.contains(next) || next.closest("[data-radix-popper-content-wrapper]"))) return;
        if (!discarded.current) commit(false);
      },
    },
    inputProps: {
      ref: inputRef,
      autoFocus: true,
      value: title,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value),
      onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit(true);
        }
        if (e.key === "Escape") {
          discarded.current = true;
          close();
        }
      },
      // Read-only (not disabled) while saving, so the field keeps focus and doesn't fire a stray blur.
      readOnly: pending,
      maxLength: 200,
    },
  };
}

/** Plane's quick add: a "+ New card" row after the cards; it opens a blank draft card that saves only with a title. */
function AddCard({ column, ctx, open, setOpen }: { column: ColumnData; ctx: Ctx; open: boolean; setOpen: (open: boolean) => void }) {
  const t = useT();
  const { draft, pending, onPatch, draftProps, inputProps } = useQuickAdd(column, ctx, setOpen);
  const draftRef = useRef<HTMLDivElement>(null);
  // The header's "+" opens the draft at the bottom of the column; bring it into view.
  useEffect(() => {
    if (open) draftRef.current?.scrollIntoView({ block: "nearest" });
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full shrink-0 cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground outline-none hover:bg-foreground/[0.05] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Plus className="size-3.5" /> {t.column.newCard}
      </button>
    );
  }
  // The same shell and chips as CardView, with the title as a field.
  return (
    <div
      ref={draftRef}
      {...draftProps}
      className={cn("shrink-0 rounded-lg border border-primary bg-card p-3 text-[13px] shadow-xs ring-1 ring-primary", pending && "opacity-70")}
    >
      <input
        {...inputProps}
        placeholder={t.column.addPlaceholder}
        aria-label={t.column.addCard}
        className="w-full bg-transparent text-[14px] leading-5 font-medium outline-none placeholder:text-muted-foreground"
      />
      <CardQuickProps card={draft} members={[...ctx.memberById.values()]} assignable={ctx.assignable} today={ctx.today} done={column.isDone} show={ctx.display} onPatch={onPatch} />
    </div>
  );
}

/** Labels on a card, as Plane shows them: the one label, or a single "3 labels" pill with the first colour. */
function LabelChips({ tags }: { tags: Tag[] }) {
  const t = useT();
  if (tags.length === 0) return null;
  if (tags.length === 1) return <TagBadge tag={tags[0]} />;
  return (
    <span title={tags.map((x) => x.name).join(", ")}>
      <TagBadge tag={{ name: t.tags.count(tags.length), color: tags[0].color }} />
    </span>
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
      <div className="sticky top-0 z-[2] flex items-center gap-2 border-b bg-muted/45 py-1 pr-4 pl-4 backdrop-blur-sm hover:bg-muted/60 md:pl-6">
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
          <ListQuickAdd column={column} ctx={ctx} open={adding} setOpen={setAdding} />
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
        <CardQuickProps card={card} members={[...ctx.memberById.values()]} assignable={ctx.assignable} today={ctx.today} done={done} show={show} onPatch={(p) => ctx.patch(card.id, p)} tags={ctx.tags} onCreateTag={(name) => ctx.createLabel(card, name)}>
          <LabelChips tags={cardTags} />
        </CardQuickProps>
        <CardMenu card={card} ctx={ctx} className="static" />
      </span>
    </li>
  );
}

/** Plane's list quick add: a "+ New card" row that opens a draft row with the same chips as the others. */
function ListQuickAdd({ column, ctx, open, setOpen }: { column: ColumnData; ctx: Ctx; open: boolean; setOpen: (open: boolean) => void }) {
  const t = useT();
  const { draft, pending, onPatch, draftProps, inputProps } = useQuickAdd(column, ctx, setOpen);
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
    <div
      {...draftProps}
      className={cn("flex min-h-11 flex-col gap-2 border-b bg-card py-1.5 pr-4 pl-4 text-[13px] shadow-sm md:flex-row md:items-center md:pl-6", pending && "opacity-70")}
    >
      <input
        {...inputProps}
        placeholder={t.column.addPlaceholder}
        aria-label={t.column.addCard}
        className="min-w-0 flex-1 bg-transparent py-1 font-medium outline-none placeholder:text-muted-foreground"
      />
      <span className="flex shrink-0 items-center gap-2 [&>div]:pt-0">
        <CardQuickProps card={draft} members={[...ctx.memberById.values()]} assignable={ctx.assignable} today={ctx.today} done={column.isDone} show={ctx.display} onPatch={onPatch} />
      </span>
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
