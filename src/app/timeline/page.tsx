import Link from "next/link";
import { BoardFilter } from "@/components/BoardFilter";
import { TimelineView } from "@/components/TimelineView";
import { ViewBar } from "@/components/ViewTabs";
import { loadBoards, loadCards, loadColumns, loadMembers, loadTags } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { track } from "@/lib/activity";
import { requireUser } from "@/lib/session";

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string; zoom?: string }>;
}) {
  const user = await requireUser();
  await track(user.id, "timeline.view");
  const sp = await searchParams;
  const today = todayISO();
  const zoom = sp.zoom === "week" || sp.zoom === "quarter" ? sp.zoom : "month";
  const boards = await loadBoards(user);
  const board = boards.find((b) => b.id === sp.board) ?? null;
  const [cards, columns, members, tags] = await Promise.all([loadCards(user, board?.id), loadColumns(user, board?.id), loadMembers(), loadTags(user, board?.id)]);

  return (
    // The chart gets the page's height below the header at most, so it scrolls in both directions on its own.
    <main className="flex h-full flex-col">
      {board && (
        <ViewBar boardId={board.id} active="timeline">
          <Link href={`/boards/${board.id}`} className="truncate text-base font-semibold hover:underline">
            {board.name}
          </Link>
        </ViewBar>
      )}
      <TimelineView
        today={today}
        cards={cards}
        columns={columns}
        members={members}
        tags={tags}
        groupByBoard={!board}
        boardName={board?.name ?? null}
        // Keyed: the chart lists it beside its own controls, and React asks for a key on server elements there.
        filter={<BoardFilter key="board" boards={boards} value={board?.id ?? null} />}
        initialView={zoom}
      />
    </main>
  );
}
