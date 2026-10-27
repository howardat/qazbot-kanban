import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { boards, cardAssignees, cards, cardTags, columns, profiles, tags } from "@/db/schema";
import type { CardRow, Member, Tag } from "@/lib/types";

export async function loadMembers(): Promise<Member[]> {
  return db
    .select({ id: profiles.id, name: profiles.name, email: profiles.email, image: profiles.image })
    .from(profiles)
    .orderBy(asc(profiles.name), asc(profiles.email));
}

export async function loadTags(boardId?: string): Promise<Tag[]> {
  const q = db.select().from(tags).orderBy(asc(tags.name));
  return boardId ? q.where(eq(tags.boardId, boardId)) : q;
}

/** All cards (optionally for one board) with board/column context, assignees and tags attached. */
export async function loadCards(boardId?: string): Promise<CardRow[]> {
  const base = db
    .select({
      card: cards,
      boardName: boards.name,
      columnName: columns.name,
      done: columns.isDone,
    })
    .from(cards)
    .innerJoin(columns, eq(columns.id, cards.columnId))
    .innerJoin(boards, eq(boards.id, cards.boardId))
    .orderBy(asc(columns.position), asc(cards.position));
  const rows = await (boardId ? base.where(eq(cards.boardId, boardId)) : base);
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

  return rows.map(({ card, boardName, columnName, done }) => ({
    id: card.id,
    boardId: card.boardId,
    columnId: card.columnId,
    title: card.title,
    description: card.description,
    startDate: card.startDate,
    dueDate: card.dueDate,
    assigneeIds: byCardAssignees.get(card.id) ?? [],
    tagIds: byCardTags.get(card.id) ?? [],
    project: card.project,
    boardName,
    columnName,
    done,
  }));
}

export async function loadBoards() {
  return db.select({ id: boards.id, name: boards.name }).from(boards).orderBy(asc(boards.createdAt));
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

export type LatestUpdate = {
  cardId: string;
  title: string;
  boardId: string;
  column: string;
  done: boolean;
  at: string;
  assignees: Member[];
};

/** The most recent card moves on any board, newest first, for the sidebar's "Latest updates". */
export async function loadLatestUpdates(limit = 8): Promise<LatestUpdate[]> {
  const rows = await db
    .select({ cardId: cards.id, title: cards.title, boardId: cards.boardId, column: columns.name, done: columns.isDone, at: cards.columnChangedAt })
    .from(cards)
    .innerJoin(columns, eq(columns.id, cards.columnId))
    .orderBy(desc(cards.columnChangedAt))
    .limit(limit);
  if (rows.length === 0) return [];
  const people = await db
    .select({ cardId: cardAssignees.cardId, id: profiles.id, name: profiles.name, email: profiles.email, image: profiles.image })
    .from(cardAssignees)
    .innerJoin(profiles, eq(profiles.id, cardAssignees.profileId))
    .where(inArray(cardAssignees.cardId, rows.map((r) => r.cardId)));
  return rows.map((r) => ({
    ...r,
    at: r.at.toISOString(),
    assignees: people.filter((p) => p.cardId === r.cardId).map((p) => ({ id: p.id, name: p.name, email: p.email, image: p.image })),
  }));
}
