import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { boards, columns } from "@/db/schema";
import { Board, type ColumnData } from "@/components/Board";
import { canDeleteBoard } from "@/lib/board-ops";
import { loadCards, loadMembers, loadTags } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { track } from "@/lib/activity";
import { loadRoomBoards } from "@/lib/workers";
import { boardAudience, canManageBoard, canSeeBoard, loadBoardMembers } from "@/lib/board-access";
import { requireUser } from "@/lib/session";

/**
 * Loads one board and renders it in the given layout; shared by the Board and List routes, and by All
 * tasks with this board picked (`boards` is then its board picker's list).
 */
export async function BoardView({ id, layout, boards: picker }: { id: string; layout: "board" | "list"; boards?: { id: string; name: string }[] }) {
  const user = await requireUser();
  if (!z.string().uuid().safeParse(id).success) notFound();

  const [board] = await db.select().from(boards).where(eq(boards.id, id));
  if (!board || !(await canSeeBoard(user, id))) notFound();
  await track(user.id, picker ? "tasks.view" : layout === "list" ? "board.list" : "board.view");

  const [cols, cardRows, members, tags, boardMemberIds, canManage, audience, roomBoards] = await Promise.all([
    db.select().from(columns).where(eq(columns.boardId, id)).orderBy(asc(columns.position)),
    loadCards(user, id),
    loadMembers(),
    loadTags(user, id),
    loadBoardMembers(id),
    canManageBoard(user, id),
    boardAudience(id),
    loadRoomBoards(user),
  ]);

  const data: ColumnData[] = cols.map((c) => ({
    id: c.id,
    name: c.name,
    isDone: c.isDone,
    isInProgress: c.isInProgress,
    cards: cardRows.filter((card) => card.columnId === c.id),
  }));

  return (
    <Board
      board={{ id: board.id, name: board.name, room: board.room, roomBoards, createdBy: board.createdBy, memberIds: boardMemberIds, canManage }}
      columns={data}
      members={members}
      tags={tags}
      today={todayISO()}
      currentUserId={user.id}
      canDelete={canDeleteBoard(user, board.createdBy)}
      assignableIds={audience ? [...audience] : null}
      layout={layout}
      allTasks={picker && { boards: picker, picked: id }}
    />
  );
}
