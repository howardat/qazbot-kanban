import Link from "next/link";
import { PageHeader } from "@/components/atoms";
import { BoardFilter } from "@/components/BoardFilter";
import { CalendarOptions } from "@/components/CalendarOptions";
import { CalendarView } from "@/components/CalendarView";
import { Pager } from "@/components/Pager";
import { ViewBar } from "@/components/ViewTabs";
import { loadBoards, loadCards, loadInboxColumns, loadMembers, loadTags } from "@/lib/data";
import {
  addDays,
  isValidDate,
  isValidMonth,
  monthGrid,
  monthOf,
  shiftMonth,
  startOfWeek,
  todayISO,
} from "@/lib/dates";
import { getT } from "@/lib/i18n/server";
import { track } from "@/lib/activity";
import { requireUser } from "@/lib/session";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ board?: string; month?: string; view?: string; date?: string; weekends?: string }>;
}) {
  const user = await requireUser();
  await track(user.id, "calendar.view");
  const t = await getT();
  const sp = await searchParams;
  const today = todayISO();
  const view = sp.view === "week" ? "week" : "month";
  const weekends = sp.weekends !== "0";
  const month = isValidMonth(sp.month) ? sp.month : monthOf(today);
  const weekStart = startOfWeek(isValidDate(sp.date) ? sp.date : today);

  const boards = await loadBoards(user);
  const board = boards.find((b) => b.id === sp.board) ?? null;
  const [cards, members, tags, inbox] = await Promise.all([
    loadCards(user, board?.id),
    loadMembers(),
    loadTags(user, board?.id),
    loadInboxColumns(),
  ]);

  const link = (patch: Record<string, string>) =>
    `/calendar?${new URLSearchParams({
      ...(board ? { board: board.id } : {}),
      ...(view === "week" ? { view } : {}),
      ...(weekends ? {} : { weekends: "0" }),
      ...patch,
    })}`;

  const days = view === "week" ? Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)) : monthGrid(month);
  const inRange = (d: string | null) => !!d && (view === "week" ? d >= days[0] && d <= days[6] : d.startsWith(month));
  const scheduled = cards.filter((c) => inRange(c.dueDate)).length;
  const title = view === "week" ? `${t.fmt.day(days[0])} – ${t.fmt.day(days[6])}` : t.fmt.month(month);

  // Boards a quick-added card can land on: the current one, or all that have an open column.
  const targets = (board ? [board] : boards)
    .filter((b) => inbox[b.id])
    .map((b) => ({ boardId: b.id, name: b.name, columnId: inbox[b.id] }));

  return (
    <main>
      {board && (
        <ViewBar boardId={board.id} active="calendar">
          <Link href={`/boards/${board.id}`} className="truncate text-base font-semibold hover:underline">
            {board.name}
          </Link>
        </ViewBar>
      )}
      <PageHeader
        title={title}
        description={t.calendar.description(scheduled, view, board?.name ?? null)}
        actions={
          <>
            <BoardFilter boards={boards} value={board?.id ?? null} />
            <CalendarOptions view={view} weekends={weekends} />
            {view === "week" ? (
              <Pager
                prev={link({ date: addDays(weekStart, -7) })}
                today={link({ date: startOfWeek(today) })}
                next={link({ date: addDays(weekStart, 7) })}
                prevLabel={t.calendar.prevWeek}
                nextLabel={t.calendar.nextWeek}
                todayLabel={t.common.today}
              />
            ) : (
              <Pager
                prev={link({ month: shiftMonth(month, -1) })}
                today={link({ month: monthOf(today) })}
                next={link({ month: shiftMonth(month, 1) })}
                prevLabel={t.calendar.prevMonth}
                nextLabel={t.calendar.nextMonth}
                todayLabel={t.common.today}
              />
            )}
          </>
        }
      />
      <div className="px-4 py-5 md:px-6">
        <CalendarView
          view={view}
          days={days}
          month={view === "month" ? month : null}
          weekends={weekends}
          today={today}
          cards={cards}
          members={members}
          tags={tags}
          showBoard={!board}
          targets={targets}
        />
      </div>
    </main>
  );
}
