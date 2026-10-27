import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { boards, columns } from "@/db/schema";
import { Board, type ColumnData } from "@/components/Board";
import { loadCards, loadMembers, loadTags } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { track } from "@/lib/activity";
import { requireUser } from "@/lib/session";

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  await track(user.id, "board.view");
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();

  const [board] = await db.select().from(boards).where(eq(boards.id, id));
  if (!board) notFound();

  const [cols, cardRows, members, tags] = await Promise.all([
    db.select().from(columns).where(eq(columns.boardId, id)).orderBy(asc(columns.position)),
    loadCards(id),
    loadMembers(),
    loadTags(id),
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
      board={{ id: board.id, name: board.name }}
      columns={data}
      members={members}
      tags={tags}
      today={todayISO()}
      currentUserId={user.id}
      canDelete={user.role === "admin" || board.createdBy === user.id}
    />
  );
}
