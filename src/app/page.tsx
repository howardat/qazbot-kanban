import Link from "next/link";
import { AlertCircle, CalendarClock, Plus, SquareUser } from "lucide-react";
import { updateMyName } from "@/app/actions";
import { AvatarStack, BoardIcon, StatTile } from "@/components/atoms";
import { NewBoardButton } from "@/components/NewBoardButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadBoards, loadCards, loadMembers } from "@/lib/data";
import { diffDays, todayISO } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";
import { track } from "@/lib/activity";
import { requireUser } from "@/lib/session";
import { displayName, type Member } from "@/lib/types";

const statLink =
  "block rounded-xl outline-none transition hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50 [&>section]:h-full [&>section]:transition-colors hover:[&>section]:border-border-strong";

/** Home: a greeting, three numbers about your cards, then every board as a box, plus a new one. */
export default async function HomePage() {
  const user = await requireUser();
  await track(user.id, "dashboard.view");
  const t = await getT();
  const d = t.dashboard;
  const today = todayISO();
  const [boards, cards, members] = await Promise.all([
    loadBoards(user),
    loadCards(user),
    loadMembers(),
  ]);
  const memberById = new Map(members.map((m) => [m.id, m]));

  const mine = cards.filter((c) => !c.done && c.assigneeIds.includes(user.id));
  const late = mine.filter((c) => !!c.dueDate && c.dueDate < today);
  const week = mine
    .filter(
      (c) =>
        !!c.dueDate && c.dueDate >= today && diffDays(c.dueDate, today) < 7,
    )
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const boardsOf = (list: typeof cards) =>
    new Set(list.map((c) => c.boardId)).size;

  // Every board you can see, the most recently active first.
  const boardBoxes = boards
    .map((b) => {
      const bc = cards.filter((c) => c.boardId === b.id);
      return {
        ...b,
        total: bc.length,
        done: bc.filter((c) => c.done).length,
        late: bc.filter((c) => !c.done && !!c.dueDate && c.dueDate < today)
          .length,
        lastAt: bc.reduce<string | null>(
          (max, c) => (!max || c.movedAt > max ? c.movedAt : max),
          null,
        ),
        // Who has open cards here.
        people: [
          ...new Set(bc.filter((c) => !c.done).flatMap((c) => c.assigneeIds)),
        ]
          .map((id) => memberById.get(id))
          .filter((m): m is Member => !!m),
      };
    })
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""));

  const first = displayName(user).split(/\s+/)[0];

  return (
    <main className="w-full space-y-8 px-4 py-8 md:px-8">
      <header className="flex flex-wrap items-end gap-3">
        <div className="mr-auto space-y-1">
          <p className="text-sm text-muted-foreground">{t.fmt.long(today)}</p>
          <h1 className="text-[28px] leading-[1.2] font-semibold">
            {d.welcome(first)}
          </h1>
        </div>
        <NewBoardButton />
      </header>

      {!user.name && (
        <form
          action={updateMyName}
          className="bg-brand-soft-gradient flex flex-wrap items-center gap-3 rounded-lg border p-3 pl-4"
        >
          <label htmlFor="display-name" className="mr-auto text-sm">
            {d.namePrompt}
          </label>
          <Input
            id="display-name"
            name="name"
            required
            maxLength={80}
            placeholder={d.namePlaceholder}
            className="w-56 bg-card"
          />
          <Button>{d.saveName}</Button>
        </form>
      )}

      {/* Each number opens the view that lists those cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Link href="/tasks" className={statLink}>
          <StatTile
            icon={<SquareUser />}
            title={d.assignedToYou}
            value={mine.length}
          >
            {mine.length ? d.onBoards(boardsOf(mine)) : d.nobodyAssigned}
          </StatTile>
        </Link>
        <Link href="/tasks" className={statLink}>
          <StatTile
            icon={<AlertCircle />}
            title={d.pastDeadline}
            value={
              <span className={late.length ? "text-destructive" : undefined}>
                {late.length}
              </span>
            }
          >
            {late.length ? d.onBoards(boardsOf(late)) : d.nothingLate}
          </StatTile>
        </Link>
        <Link href="/calendar?view=week" className={statLink}>
          <StatTile
            icon={<CalendarClock />}
            title={d.dueIn7}
            value={week.length}
          >
            {week.length
              ? d.next(week[0].title, week[0].dueDate!)
              : d.noDeadlinesWeek}
          </StatTile>
        </Link>
      </div>

      <section className="space-y-3">
        <h2 className="flex items-baseline gap-2 px-1">
          <span className="text-[15px] font-semibold">{t.nav.boards}</span>
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {boardBoxes.length}
          </span>
        </h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {boardBoxes.map((b) => (
            <li key={b.id}>
              <Link
                href={`/boards/${b.id}`}
                className="flex h-full flex-col gap-4 rounded-xl border bg-card p-4 shadow-xs outline-none transition hover:border-border-strong hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex items-start gap-3">
                  <BoardIcon board={b} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{b.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {b.lastAt
                        ? t.workers.updated(t.fmt.ago(b.lastAt))
                        : d.noActivity}
                    </span>
                  </span>
                </span>
                <span className="mt-auto flex h-6 items-center gap-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                  {d.boardDone(b.done, b.total)}
                  {b.late > 0 && (
                    <span
                      title={d.nLate(b.late)}
                      aria-label={d.nLate(b.late)}
                      className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[11px] font-medium text-destructive"
                    >
                      <AlertCircle className="size-3" /> {b.late}
                    </span>
                  )}
                  {b.people.length > 0 && (
                    <span className="ml-auto">
                      <AvatarStack members={b.people} size={24} />
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
          <li>
            <NewBoardButton
              trigger={
                <button
                  type="button"
                  className="flex h-full min-h-32 w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-sm font-medium text-muted-foreground outline-none transition hover:border-border-strong hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Plus className="size-5" />
                  {boardBoxes.length ? t.nav.newBoard : d.firstBoard}
                </button>
              }
            />
          </li>
        </ul>
      </section>
    </main>
  );
}
