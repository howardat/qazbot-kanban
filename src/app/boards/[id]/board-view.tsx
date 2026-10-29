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
import { boardAudience, canManageBoard, canSeeBoard, loadBoardMembers } from "@/lib/board-access";
import { requireUser } from "@/lib/session";

/** Loads one board and renders it in the given layout; shared by the Board and List routes. */
export async function BoardView({ id, layout }: { id: string; layout: "board" | "list" }) {
  const user = await requireUser();
  await track(user.id, layout === "list" ? "board.list" : "board.view");
  if (!z.string().uuid().safeParse(id).success) notFound();

  const [board] = await db.select().from(boards).where(eq(boards.id, id));
  if (!board || !(await canSeeBoard(user, id))) notFound();

  const [cols, cardRows, members, tags, boardMemberIds, canManage, audience] = await Promise.all([
    db.select().from(columns).where(eq(columns.boardId, id)).orderBy(asc(columns.position)),
    loadCards(user, id),
    loadMembers(),
    loadTags(user, id),
    loadBoardMembers(id),
    canManageBoard(user, id),
    boardAudience(id),
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
      board={{ id: board.id, name: board.name, room: board.room, createdBy: board.createdBy, memberIds: boardMemberIds, canManage }}
      columns={data}
      members={members}
      tags={tags}
      today={todayISO()}
      currentUserId={user.id}
      canDelete={canDeleteBoard(user, board.createdBy)}
      assignableIds={audience ? [...audience] : null}
      layout={layout}
    />
  );
}
