import "server-only";
import { and, asc, eq, inArray, max, ne, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { activityEvents, boards, cardAssignees, cards, cardTags, columns, profiles, TAG_COLORS, tags } from "@/db/schema";
import { CARD_DONE } from "@/lib/activity";
import { addDays, diffDays, isValidDate, todayISO } from "@/lib/dates";
import { boardAudience } from "@/lib/board-access";
import { STORY_POINTS, type CardSource } from "@/lib/card-source";
import { PRIORITIES } from "@/lib/priority";

// Board and card writes, shared by the server actions (signed-in UI) and the MCP tools (assistant and
// external agents). Callers authenticate first; these validate input and keep positions consistent.

export const name = z.string().trim().min(1).max(200);
export const id = z.string().uuid();
export const isoDate = z.string().refine((d) => isValidDate(d), "Invalid date (use YYYY-MM-DD)");

const datesInOrder = (d: { startDate?: string | null; dueDate?: string | null }) =>
  !d.startDate || !d.dueDate || d.startDate <= d.dueDate;
const DATES_ORDER = { message: "Start date must be on or before the due date." };

export const cardDates = z
  .object({ startDate: isoDate.nullable(), dueDate: isoDate.nullable() })
  .refine(datesInOrder, DATES_ORDER);

export const cardUpdate = z
  .object({
    title: name,
    description: z.string().max(10_000),
    startDate: isoDate.nullable(),
    dueDate: isoDate.nullable(),
    assigneeIds: z.array(id).max(50),
    tagIds: z.array(id).max(30),
    priority: z.enum(PRIORITIES).nullable(),
    storyPoints: z
      .number()
      .int()
      .refine((n) => (STORY_POINTS as readonly number[]).includes(n), "Story points are 1, 2, 3, 5, 8 or 13.")
      .nullable(),
  })
  .refine(datesInOrder, DATES_ORDER);

export const tagInput = z.object({ name: z.string().trim().min(1).max(40), color: z.enum(TAG_COLORS) });

export type Actor = { id: string; role: "admin" | "member" };

// ---------- Boards ----------

export async function createBoardOp(actor: Actor, boardName: string, starterColumns: string[]) {
  const parsed = name.parse(boardName);
  return db.transaction(async (tx) => {
    const [board] = await tx.insert(boards).values({ name: parsed, createdBy: actor.id }).returning({ id: boards.id });
    // The last starter column is the "done" column; the second is "in progress" when there's room for one.
    await tx.insert(columns).values(
      starterColumns.map((n, i) => ({
        boardId: board.id,
        name: n,
        position: i,
        isDone: i === starterColumns.length - 1,
        isInProgress: starterColumns.length >= 3 && i === 1,
      })),
    );
    return board.id;
  });
}

/** Only a board's creator may delete it; admins only when the board has no creator left (deleted account). */
export const canDeleteBoard = (actor: Actor, createdBy: string | null) =>
  createdBy ? createdBy === actor.id : actor.role === "admin";

export async function deleteBoardOp(actor: Actor, boardId: string) {
  const [board] = await db.select().from(boards).where(eq(boards.id, id.parse(boardId)));
  if (!board) return false;
  if (!canDeleteBoard(actor, board.createdBy)) throw new Error("Only the board's creator can delete it.");
  await db.delete(boards).where(eq(boards.id, board.id));
  return true;
}

// ---------- Columns ----------

export async function addColumnOp(boardId: string, columnName: string) {
  const bId = id.parse(boardId);
  const [{ top }] = await db.select({ top: max(columns.position) }).from(columns).where(eq(columns.boardId, bId));
  const [col] = await db
    .insert(columns)
    .values({ boardId: bId, name: name.parse(columnName), position: (top ?? -1) + 1 })
    .returning({ id: columns.id });
  return col.id;
}

/** Flag a column as done or in progress. A column is never both, so setting one clears the other. */
export async function setColumnFlagOp(columnId: string, flag: "done" | "inProgress", on: boolean) {
  const value = z.boolean().parse(on);
  const set = flag === "done" ? { isDone: value, ...(value ? { isInProgress: false } : {}) } : { isInProgress: value, ...(value ? { isDone: false } : {}) };
  await db.update(columns).set(set).where(eq(columns.id, id.parse(columnId)));
}

// ---------- Cards ----------

/**
 * New cards are due tomorrow (or on their start date, if that's later) unless a due date is given,
 * and start out assigned to the person who created them (when they're in the board).
 */
export async function addCardOp(
  actor: Actor,
  columnId: string,
  title: string,
  dates?: { startDate?: string | null; dueDate?: string | null },
  /** Where the card is being made: the app, the assistant or MCP. */
  source: CardSource = "app",
) {
  const cId = id.parse(columnId);
  const start = dates?.startDate ?? null;
  const tomorrow = addDays(todayISO(), 1);
  const defaultDue = start && start > tomorrow ? start : tomorrow;
  const { startDate, dueDate } = cardDates.parse({ startDate: start, dueDate: dates?.dueDate ?? defaultDue });
  const [col] = await db.select().from(columns).where(eq(columns.id, cId));
  if (!col) throw new Error("Column not found.");
  const [{ top }] = await db.select({ top: max(cards.position) }).from(cards).where(eq(cards.columnId, cId));
  return db.transaction(async (tx) => {
    const [card] = await tx
      .insert(cards)
      .values({
        boardId: col.boardId,
        columnId: cId,
        title: name.parse(title),
        startDate,
        dueDate,
        position: (top ?? -1) + 1,
        createdBy: actor.id,
        createdVia: source,
      })
      .returning({ id: cards.id });
    // Starts assigned to its creator, unless they aren't in this private board (an admin looking in).
    const audience = await boardAudience(col.boardId);
    if (!audience || audience.has(actor.id)) await tx.insert(cardAssignees).values({ cardId: card.id, profileId: actor.id });
    return card.id;
  });
}

export async function setCardDatesOp(cardId: string, startDate: string | null, dueDate: string | null) {
  await db.update(cards).set(cardDates.parse({ startDate, dueDate })).where(eq(cards.id, id.parse(cardId)));
}

/** Replace every editable field of a card (the card editor saves the whole form). */
export async function updateCardOp(cardId: string, data: z.input<typeof cardUpdate>) {
  const cId = id.parse(cardId);
  const { assigneeIds, tagIds, ...values } = cardUpdate.parse(data);
  await db.transaction(async (tx) => {
    const [card] = await tx.update(cards).set(values).where(eq(cards.id, cId)).returning({ boardId: cards.boardId });
    if (!card) throw new Error("Card not found.");
    // Only keep tags that belong to this card's board, and people who have a profile.
    const validTags = tagIds.length
      ? await tx.select({ id: tags.id }).from(tags).where(and(eq(tags.boardId, card.boardId), inArray(tags.id, tagIds)))
      : [];
    const validPeople = assigneeIds.length
      ? await tx.select({ id: profiles.id }).from(profiles).where(inArray(profiles.id, assigneeIds))
      : [];
    // A private board only takes new assignees who are in it; people already on the card stay.
    const audience = await boardAudience(card.boardId);
    if (audience) {
      const current = await tx.select({ id: cardAssignees.profileId }).from(cardAssignees).where(eq(cardAssignees.cardId, cId));
      const outsider = validPeople.find((p) => !audience.has(p.id) && !current.some((c) => c.id === p.id));
      if (outsider) throw new Error("Only people in this board can be assigned to its cards.");
    }
    await tx.delete(cardTags).where(eq(cardTags.cardId, cId));
    if (validTags.length) await tx.insert(cardTags).values(validTags.map((t) => ({ cardId: cId, tagId: t.id })));
    // People already on the card keep their assigned_at (it places them on the workers view); only
    // the removed go and only the new get stamped now.
    const keep = validPeople.map((p) => p.id);
    await tx
      .delete(cardAssignees)
      .where(keep.length ? and(eq(cardAssignees.cardId, cId), notInArray(cardAssignees.profileId, keep)) : eq(cardAssignees.cardId, cId));
    if (keep.length) await tx.insert(cardAssignees).values(keep.map((profileId) => ({ cardId: cId, profileId }))).onConflictDoNothing();
  });
}

/** Change only the given fields of a card; everything left out stays as it is. */
export async function patchCardOp(cardId: string, patch: Partial<z.input<typeof cardUpdate>>) {
  const cId = id.parse(cardId);
  const [card] = await db.select().from(cards).where(eq(cards.id, cId));
  if (!card) throw new Error("Card not found.");
  const [assignees, cardTagRows] = await Promise.all([
    db.select({ id: cardAssignees.profileId }).from(cardAssignees).where(eq(cardAssignees.cardId, cId)),
    db.select({ id: cardTags.tagId }).from(cardTags).where(eq(cardTags.cardId, cId)),
  ]);
  await updateCardOp(cId, {
    title: card.title,
    description: card.description,
    startDate: card.startDate,
    dueDate: card.dueDate,
    assigneeIds: assignees.map((a) => a.id),
    tagIds: cardTagRows.map((t) => t.id),
    priority: card.priority,
    storyPoints: card.storyPoints,
    ...patch,
  });
}

/** Move the due date and keep the card's duration by shifting the start date with it. */
export async function rescheduleCardOp(cardId: string, newDue: string) {
  const cId = id.parse(cardId);
  const due = isoDate.parse(newDue);
  const [card] = await db.select().from(cards).where(eq(cards.id, cId));
  if (!card) return;
  let startDate = card.startDate;
  if (startDate && card.dueDate) startDate = addDays(startDate, diffDays(due, card.dueDate));
  else if (startDate && startDate > due) startDate = due;
  await db.update(cards).set({ dueDate: due, startDate }).where(eq(cards.id, cId));
}

export async function deleteCardOp(cardId: string) {
  const [card] = await db.delete(cards).where(eq(cards.id, id.parse(cardId))).returning({ id: cards.id });
  return !!card;
}

/** Put a card into a column at `toIndex` (past the end means last), renumbering that column. */
export async function moveCardOp(cardId: string, toColumnId: string, toIndex: number) {
  const cId = id.parse(cardId);
  const targetId = id.parse(toColumnId);
  const index = z.number().int().min(0).parse(toIndex);
  return db.transaction(async (tx) => {
    const [card] = await tx.select().from(cards).where(eq(cards.id, cId));
    const [target] = await tx.select().from(columns).where(eq(columns.id, targetId));
    if (!card || !target || target.boardId !== card.boardId) throw new Error("Card and column must be on the same board.");
    if (card.columnId !== targetId) {
      await tx.update(cards).set({ columnChangedAt: new Date() }).where(eq(cards.id, cId));
      const [source] = await tx.select({ isDone: columns.isDone }).from(columns).where(eq(columns.id, card.columnId));
      // Finishing a card credits everyone assigned to it at that moment.
      if (target.isDone && !source?.isDone) {
        const assignees = await tx.select({ id: cardAssignees.profileId }).from(cardAssignees).where(eq(cardAssignees.cardId, cId));
        if (assignees.length) {
          await tx
            .insert(activityEvents)
            .values(assignees.map((a) => ({ profileId: a.id, kind: CARD_DONE, cardId: cId, boardId: card.boardId })));
        }
      }
    }
    const others = await tx
      .select({ id: cards.id })
      .from(cards)
      .where(and(eq(cards.columnId, targetId), ne(cards.id, cId)))
      .orderBy(asc(cards.position));
    const ordered = others.map((c) => c.id);
    ordered.splice(Math.min(index, ordered.length), 0, cId);
    for (const [position, rowId] of ordered.entries()) {
      await tx.update(cards).set({ position, columnId: targetId }).where(eq(cards.id, rowId));
    }
    return card.boardId;
  });
}

/**
 * Make a card its assignees' current task: put it at the top of its board's in-progress column and
 * stamp it as just moved, so it outranks their other in-progress cards. False if the board has no
 * in-progress column.
 */
export async function workOnCardOp(cardId: string) {
  const cId = id.parse(cardId);
  const [card] = await db.select({ boardId: cards.boardId }).from(cards).where(eq(cards.id, cId));
  if (!card) throw new Error("Card not found.");
  const [col] = await db
    .select({ id: columns.id })
    .from(columns)
    .where(and(eq(columns.boardId, card.boardId), eq(columns.isInProgress, true)))
    .orderBy(asc(columns.position))
    .limit(1);
  if (!col) return false;
  await moveCardOp(cId, col.id, 0);
  await db.update(cards).set({ columnChangedAt: new Date() }).where(eq(cards.id, cId));
  return true;
}

// ---------- Tags ----------

export async function createTagOp(boardId: string, input: z.input<typeof tagInput>) {
  const { name: tagName, color } = tagInput.parse(input);
  const [tag] = await db
    .insert(tags)
    .values({ boardId: id.parse(boardId), name: tagName, color })
    .onConflictDoUpdate({ target: [tags.boardId, tags.name], set: { color } })
    .returning();
  return tag;
}
