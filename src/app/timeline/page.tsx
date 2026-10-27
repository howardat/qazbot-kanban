import Link from "next/link";
import { PageHeader } from "@/components/atoms";
import { BoardFilter } from "@/components/BoardFilter";
import { Pager } from "@/components/Pager";
import { TimelineView } from "@/components/TimelineView";
import { TabLink, TabsNav } from "@/components/ui/tabs";
import { ViewBar } from "@/components/ViewTabs";
import { loadBoards, loadCards, loadMembers, loadTags } from "@/lib/data";
import { addDays, isValidDate, startOfWeek, todayISO } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";
import { track } from "@/lib/activity";
import { requireUser } from "@/lib/session";

// Plane's gantt zoom levels: how many days are shown, how wide a day is, and how far the pager jumps.
const ZOOMS = {
  week: { span: 14, dayWidth: 64, step: 7 },
  month: { span: 42, dayWidth: 32, step: 14 },
  quarter: { span: 91, dayWidth: 14, step: 28 },
} as const;
type Zoom = keyof typeof ZOOMS;

export default async function TimelinePage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string; from?: string; zoom?: string }>;
}) {
  const user = await requireUser();
  await track(user.id, "timeline.view");
  const t = await getT();
  const sp = await searchParams;
  const today = todayISO();
  const zoom: Zoom = sp.zoom && sp.zoom in ZOOMS ? (sp.zoom as Zoom) : "month";
  const { span, dayWidth, step } = ZOOMS[zoom];
  const from = startOfWeek(isValidDate(sp.from) ? sp.from : addDays(today, -7));
  const to = addDays(from, span - 1);
  const boards = await loadBoards();
  const board = boards.find((b) => b.id === sp.board) ?? null;
  const [cards, members, tags] = await Promise.all([loadCards(board?.id), loadMembers(), loadTags(board?.id)]);

  const link = (patch: { from?: string; zoom?: Zoom }) =>
    `/timeline?${new URLSearchParams({
      ...(board ? { board: board.id } : {}),
      from,
      ...(zoom !== "month" ? { zoom } : {}),
      ...patch,
    })}`;

  return (
    <main>
      {board && (
        <ViewBar boardId={board.id} active="timeline">
          <Link href={`/boards/${board.id}`} className="truncate text-base font-semibold tracking-tight hover:underline">
            {board.name}
          </Link>
        </ViewBar>
      )}
      <PageHeader
        title={t.timeline.title}
        description={t.timeline.description(from, to, board?.name ?? null)}
        actions={
          <>
            <BoardFilter boards={boards} value={board?.id ?? null} />
            <TabsNav aria-label={t.timeline.zoom}>
              {(Object.keys(ZOOMS) as Zoom[]).map((z) => (
                <TabLink key={z} href={link({ zoom: z })} active={z === zoom}>
                  {t.timeline.zooms[z]}
                </TabLink>
              ))}
            </TabsNav>
            <Pager
              prev={link({ from: addDays(from, -step) })}
              today={link({ from: addDays(today, -7) })}
              next={link({ from: addDays(from, step) })}
              prevLabel={t.timeline.earlier}
              nextLabel={t.timeline.later}
              todayLabel={t.common.today}
            />
          </>
        }
      />
      <div className="px-4 py-5 md:px-6">
        <TimelineView
          from={from}
          span={span}
          dayWidth={dayWidth}
          today={today}
          cards={cards}
          members={members}
          tags={tags}
          groupByBoard={!board}
        />
      </div>
    </main>
  );
}
