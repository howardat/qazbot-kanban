import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { boardMembers, boards, cards, columns, tags } from "@/db/schema";

// Board visibility. A board with no members is open to everyone; once someone is added, only its
// members, its creator and admins see it. Every loader and every change goes through here.

export type Viewer = { id: string; role: "admin" | "member" };

/** Ids of the boards this person may see, or null when they see all (admins). */
export async function visibleBoardIds(viewer: Viewer): Promise<Set<string> | null> {
  if (viewer.role === "admin") return null;
  const [boardRows, memberRows] = await Promise.all([
    db.select({ id: boards.id, createdBy: boards.createdBy }).from(boards),
    db.select().from(boardMembers),
  ]);
  const membersOf = new Map<string, string[]>();
  for (const m of memberRows) membersOf.set(m.boardId, [...(membersOf.get(m.boardId) ?? []), m.profileId]);
  return new Set(
    boardRows
      .filter((b) => {
        const members = membersOf.get(b.id);
        return !members || b.createdBy === viewer.id || members.includes(viewer.id);
      })
      .map((b) => b.id),
  );
}

export const canSee = (visible: Set<string> | null, boardId: string) => !visible || visible.has(boardId);

export async function canSeeBoard(viewer: Viewer, boardId: string) {
  return canSee(await visibleBoardIds(viewer), boardId);
}

/** Throws unless the person may see (and so work on) this board. Hidden boards read as missing. */
export async function assertBoard(viewer: Viewer, boardId: string | undefined) {
  if (!boardId || !(await canSeeBoard(viewer, boardId))) throw new Error("Board not found.");
  return boardId;
}

export async function assertCard(viewer: Viewer, cardId: string) {
  const [row] = await db.select({ boardId: cards.boardId }).from(cards).where(eq(cards.id, cardId));
  if (!row) throw new Error("Card not found.");
  return assertBoard(viewer, row.boardId).catch(() => {
    throw new Error("Card not found.");
  });
}

export async function assertColumn(viewer: Viewer, columnId: string) {
  const [row] = await db.select({ boardId: columns.boardId }).from(columns).where(eq(columns.id, columnId));
  return assertBoard(viewer, row?.boardId);
}

export async function assertTag(viewer: Viewer, tagId: string) {
  const [row] = await db.select({ boardId: tags.boardId }).from(tags).where(eq(tags.id, tagId));
  return assertBoard(viewer, row?.boardId);
}

/** Only the board's creator and admins manage who sees it. */
export async function canManageBoard(viewer: Viewer, boardId: string) {
  if (viewer.role === "admin") return true;
  const [b] = await db.select({ createdBy: boards.createdBy }).from(boards).where(eq(boards.id, boardId));
  return !!b && b.createdBy === viewer.id;
}

export async function loadBoardMembers(boardId: string): Promise<string[]> {
  const rows = await db.select({ id: boardMembers.profileId }).from(boardMembers).where(eq(boardMembers.boardId, boardId));
  return rows.map((r) => r.id);
}

/** Replace a board's member list (empty opens it to everyone). */
export async function setBoardMembers(boardId: string, profileIds: string[]) {
  await db.transaction(async (tx) => {
    await tx.delete(boardMembers).where(eq(boardMembers.boardId, boardId));
    if (profileIds.length) await tx.insert(boardMembers).values([...new Set(profileIds)].map((profileId) => ({ boardId, profileId })));
  });
}

/** Keep only rows on boards the person may see. */
export function onVisible<T extends { boardId: string }>(rows: T[], visible: Set<string> | null) {
  return visible ? rows.filter((r) => visible.has(r.boardId)) : rows;
}
