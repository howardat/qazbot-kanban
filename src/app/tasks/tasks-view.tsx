import { BoardView } from "@/app/boards/[id]/board-view";
import { Board, type ColumnData } from "@/components/Board";
import { boardAudience } from "@/lib/board-access";
import { loadBoards, loadCards, loadColumns, loadMembers, loadTags } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";
import { track } from "@/lib/activity";
import { requireUser } from "@/lib/session";
import type { CardRow, TimelineColumn } from "@/lib/types";

/**
 * Every board's columns as one board: columns with the same name (ignoring case and spaces) become one,
 * ordered by where they usually sit on their boards, with done columns last. `columnFor` maps each
 * merged column back to the real column on each board that has it.
 */
function mergeColumns(cols: TimelineColumn[], cards: CardRow[]) {
  const merged = new Map<string, Omit<ColumnData, "cards"> & { byBoard: Record<string, string>; spots: number[] }>();
  const seen = new Map<string, number>(); // columns met so far per board: a column's position on it
  for (const c of cols) {
    const spot = seen.get(c.boardId) ?? 0;
    seen.set(c.boardId, spot + 1);
    const key = c.name.trim().toLowerCase();
    const m = merged.get(key) ?? { id: `name:${key}`, name: c.name.trim(), isDone: false, isInProgress: false, byBoard: {}, spots: [] };
    // A board with two same-named columns keeps its first one as the target.
    m.byBoard[c.boardId] ??= c.id;
    m.spots.push(spot);
    // A name that's done (or in progress) on any board reads that way here.
    m.isDone ||= c.isDone;
    m.isInProgress = (m.isInProgress || c.isInProgress) && !m.isDone;
    merged.set(key, m);
  }
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const list = [...merged.values()].sort((a, b) => Number(a.isDone) - Number(b.isDone) || avg(a.spots) - avg(b.spots));
  const toMerged = new Map(cols.map((c) => [c.id, merged.get(c.name.trim().toLowerCase())!.id]));
  const columns: ColumnData[] = list.map(({ id, name, isDone, isInProgress }) => ({
    id,
    name,
    isDone,
    isInProgress,
    cards: cards.filter((card) => toMerged.get(card.columnId) === id).map((card) => ({ ...card, columnId: id })),
  }));
  return { columns, columnFor: Object.fromEntries(list.map((m) => [m.id, m.byBoard])) };
}

/** All tasks in a layout: one board's own view when ?board= picks one, else every board merged. */
export async function TasksView({ board: picked, layout }: { board?: string; layout: "board" | "list" }) {
  const user = await requireUser();
  const boards = await loadBoards(user);
  const board = boards.find((b) => b.id === picked);
  if (board) return <BoardView id={board.id} layout={layout} boards={boards} />;

  await track(user.id, "tasks.view");
  const t = await getT();
  const [cards, cols, members, tags, audiences] = await Promise.all([
    loadCards(user),
    loadColumns(user),
    loadMembers(),
    loadTags(user),
    // Private boards only take assignees who can see them.
    Promise.all(boards.map(async (b) => [b.id, await boardAudience(b.id)] as const)),
  ]);
  const { columns, columnFor } = mergeColumns(cols, cards);

  return (
    <Board
      // Not a real board: only its id (for remembered sort and collapsed columns) and name are read on All tasks.
      board={{ id: "all-tasks", name: t.allTasks.title, room: "back_office", roomBoards: {}, createdBy: null, memberIds: [], canManage: false }}
      columns={columns}
      members={members}
      tags={tags}
      today={todayISO()}
      currentUserId={user.id}
      canDelete={false}
      assignableIds={null}
      layout={layout}
      allTasks={{
        boards,
        picked: null,
        cross: { columnFor, audiences: Object.fromEntries(audiences.flatMap(([id, a]) => (a ? [[id, [...a]]] : []))) },
      }}
    />
  );
}
