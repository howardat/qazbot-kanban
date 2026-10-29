import "server-only";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { boards, cardAssignees, cards, cardTags, columns, profiles, tags } from "@/db/schema";
import { onVisible, visibleBoardIds, type Viewer } from "@/lib/board-access";
import type { CardRow, Member, Tag, TimelineColumn } from "@/lib/types";

export async function loadMembers(): Promise<Member[]> {
  return db
    .select({ id: profiles.id, name: profiles.name, email: profiles.email, image: profiles.image, avatar: profiles.avatar })
    .from(profiles)
    .orderBy(asc(profiles.name), asc(profiles.email));
}

export async function loadTags(viewer: Viewer, boardId?: string): Promise<Tag[]> {
  const q = db.select().from(tags).orderBy(asc(tags.name));
  const [rows, visible] = await Promise.all([boardId ? q.where(eq(tags.boardId, boardId)) : q, visibleBoardIds(viewer)]);
  return onVisible(rows, visible);
}

/** Cards the viewer may see (optionally one board's) with board/column context, assignees and tags attached. */
export async function loadCards(viewer: Viewer, boardId?: string): Promise<CardRow[]> {
  const base = db
    .select({
      card: cards,
      boardName: boards.name,
      columnName: columns.name,
      done: columns.isDone,
      inProgress: columns.isInProgress,
    })
    .from(cards)
    .innerJoin(columns, eq(columns.id, cards.columnId))
    .innerJoin(boards, eq(boards.id, cards.boardId))
    .orderBy(asc(columns.position), asc(cards.position));
  const [all, visible] = await Promise.all([boardId ? base.where(eq(cards.boardId, boardId)) : base, visibleBoardIds(viewer)]);
  const rows = visible ? all.filter((r) => visible.has(r.card.boardId)) : all;
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.card.id);
  const [assignees, cardTagRows] = await Promise.all([
    db.select().from(cardAssignees).where(inArray(cardAssignees.cardId, ids)),
    db.select().from(cardTags).where(inArray(cardTags.cardId, ids)),
  ]);
  const group = <T extends { cardId: string }>(list: T[], pick: (x: T) => string) => {
    const m = new Map<string, string[]>();
    for (const x of list) m.set(x.cardId, [...(m.get(x.cardId) ?? []), pick(x)]);
    return m;
  };
  const byCardAssignees = group(assignees, (a) => a.profileId);
  const byCardTags = group(cardTagRows, (t) => t.tagId);

  return rows.map(({ card, boardName, columnName, done, inProgress }) => ({
    id: card.id,
    boardId: card.boardId,
    columnId: card.columnId,
    title: card.title,
    description: card.description,
    startDate: card.startDate,
    dueDate: card.dueDate,
    assigneeIds: byCardAssignees.get(card.id) ?? [],
    tagIds: byCardTags.get(card.id) ?? [],
    priority: card.priority,
    boardName,
    columnName,
    done,
    inProgress,
    movedAt: card.columnChangedAt.toISOString(),
  }));
}

export type BoardListItem = { id: string; name: string; boardId: string; /** The viewer has open cards here. */ mine: boolean };

/** Boards the viewer may see, oldest first; `mine` marks the ones holding their open cards. */
export async function loadBoards(viewer: Viewer): Promise<BoardListItem[]> {
  const [rows, visible, mineRows] = await Promise.all([
    db.select({ id: boards.id, name: boards.name }).from(boards).orderBy(asc(boards.createdAt)),
    visibleBoardIds(viewer),
    db
      .selectDistinct({ boardId: cards.boardId })
      .from(cardAssignees)
      .innerJoin(cards, eq(cards.id, cardAssignees.cardId))
      .innerJoin(columns, eq(columns.id, cards.columnId))
      .where(and(eq(cardAssignees.profileId, viewer.id), eq(columns.isDone, false))),
  ]);
  const mine = new Set(mineRows.map((r) => r.boardId));
  return onVisible(
    rows.map((b) => ({ ...b, boardId: b.id, mine: mine.has(b.id) })),
    visible,
  );
}

/** Columns in board order (oldest board first), then left to right: the timeline's groups. */
export async function loadColumns(viewer: Viewer, boardId?: string): Promise<TimelineColumn[]> {
  const base = db
    .select({ id: columns.id, boardId: columns.boardId, boardName: boards.name, name: columns.name, isDone: columns.isDone, isInProgress: columns.isInProgress })
    .from(columns)
    .innerJoin(boards, eq(boards.id, columns.boardId))
    .orderBy(asc(boards.createdAt), asc(columns.position));
  const [rows, visible] = await Promise.all([boardId ? base.where(eq(columns.boardId, boardId)) : base, visibleBoardIds(viewer)]);
  return onVisible(rows, visible);
}

/** Open (not done) cards per board, for the counts beside boards in the sidebar. */
export async function loadOpenCounts(viewer: Viewer): Promise<Record<string, number>> {
  const rows = await db
    .select({ boardId: cards.boardId, n: count() })
    .from(cards)
    .innerJoin(columns, eq(columns.id, cards.columnId))
    .where(eq(columns.isDone, false))
    .groupBy(cards.boardId);
  return Object.fromEntries(onVisible(rows, await visibleBoardIds(viewer)).map((r) => [r.boardId, r.n]));
}

/** Where quick-added cards land on each board: its first column that isn't "done". */
export async function loadInboxColumns(): Promise<Record<string, string>> {
  const rows = await db
    .select({ id: columns.id, boardId: columns.boardId, isDone: columns.isDone })
    .from(columns)
    .orderBy(asc(columns.position));
  const inbox: Record<string, string> = {};
  for (const r of rows) if (!r.isDone && !inbox[r.boardId]) inbox[r.boardId] = r.id;
  return inbox;
}
