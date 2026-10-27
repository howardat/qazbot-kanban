import Link from "next/link";
import { AlertCircle, CalendarClock, ChevronRight, CircleCheck, Columns3, UserRound, Users } from "lucide-react";
import { updateMyName } from "@/app/actions";
import { Avatar, PageHeader, Panel, StatTile } from "@/components/atoms";
import { DashboardLists } from "@/components/DashboardLists";
import { NewBoardButton } from "@/components/NewBoardButton";
import { TickMeter } from "@/components/TickMeter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadBoards, loadCards, loadMembers } from "@/lib/data";
import { addDays, diffDays, todayISO } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";
import { track } from "@/lib/activity";
import { requireUser } from "@/lib/session";
import { displayName } from "@/lib/types";
import { byUrgency } from "@/lib/urgency";
import { availabilityOf, LEVEL_BAR, LEVEL_TEXT } from "@/lib/availability";
import { avatarHue } from "@/lib/colors";
import { cn } from "@/lib/utils";

export default async function DashboardPage() {
  const user = await requireUser();
  await track(user.id, "dashboard.view");
  const t = await getT();
  const d = t.dashboard;
  const today = todayISO();
  const [boards, cards, members] = await Promise.all([loadBoards(), loadCards(), loadMembers()]);

  const open = cards.filter((c) => !c.done);
  const isLate = (c: (typeof cards)[number]) => !!c.dueDate && c.dueDate < today;
  // Every list puts the most pressing first: overdue, then highest priority, then closest deadline.
  const urgent = byUrgency(today);
  const late = open.filter(isLate).sort(urgent);
  const mine = open.filter((c) => c.assigneeIds.includes(user.id)).sort(urgent);
  const myLate = mine.filter(isLate).length;
  const upcoming = open
    .filter((c) => c.dueDate && c.dueDate >= today && diffDays(c.dueDate, today) < 7)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const focus = open.filter((c) => isLate(c) || c.priority === "urgent" || c.priority === "high").sort(urgent);
  const doneCount = cards.length - open.length;
  const donePct = cards.length ? (doneCount / cards.length) * 100 : 0;
  const lateBoards = new Set(late.map((c) => c.boardId)).size;
  const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : 0);

  // Next 14 days: how many open deadlines land on each day.
  const strip = Array.from({ length: 14 }, (_, i) => {
    const day = addDays(today, i);
    return { day, count: open.filter((c) => c.dueDate === day).length };
  });
  const stripMax = Math.max(1, ...strip.map((s) => s.count));

  const boardStats = boards.map((b) => {
    const bc = cards.filter((c) => c.boardId === b.id);
    const done = bc.filter((c) => c.done).length;
    return { ...b, total: bc.length, done, late: bc.filter((c) => !c.done && isLate(c)).length };
  });

  const availability = members
    .map((member) => availabilityOf(member, open, today))
    .sort((a, b) => b.free - a.free);

  return (
    <main>
      <PageHeader
        title={t.fmt.long(today)}
        description={mine.length === 0 ? d.nobodyAssigned : d.assigned(mine.length, myLate)}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/calendar">
                <CalendarClock /> {t.nav.calendar}
              </Link>
            </Button>
            <NewBoardButton />
          </>
        }
      />

      <div className="space-y-4 px-4 py-5 md:px-6">
        {!user.name && (
          <form action={updateMyName} className="flex flex-wrap items-center gap-3 rounded-lg border bg-brand-soft-gradient p-3 pl-4">
            <label htmlFor="display-name" className="mr-auto text-sm">
              {d.namePrompt}
            </label>
            <Input id="display-name" name="name" required maxLength={80} placeholder={d.namePlaceholder} className="w-56 bg-card" />
            <Button>{d.saveName}</Button>
          </form>
        )}

        {/* Headline numbers */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            icon={<UserRound />}
            title={d.assignedToYou}
            value={mine.length}
            meter={<TickMeter tone="sky" value={pct(mine.length - myLate, mine.length)} label={d.meterOnTime(pct(mine.length - myLate, mine.length))} />}
          >
            {myLate ? <span className="text-destructive">{d.nLate(myLate)}</span> : <span className="text-success">{d.onSchedule}</span>}
          </StatTile>
          <StatTile
            icon={<AlertCircle />}
            title={d.pastDeadline}
            value={late.length}
            meter={<TickMeter tone="rose" value={pct(late.length, open.length)} label={d.meterLate(pct(late.length, open.length))} />}
          >
            {late.length ? d.onBoards(lateBoards) : d.nothingLate}
          </StatTile>
          <StatTile
            icon={<CalendarClock />}
            title={d.dueIn7}
            value={upcoming.length}
            meter={<TickMeter tone="violet" value={pct(upcoming.length, open.length)} label={d.meterSoon(pct(upcoming.length, open.length))} />}
          >
            {upcoming[0] ? d.next(upcoming[0].title, upcoming[0].dueDate!) : d.noDeadlinesWeek}
          </StatTile>
          <StatTile
            icon={<CircleCheck />}
            title={d.completion}
            value={`${Math.round(donePct)}%`}
            meter={<TickMeter tone="green" value={donePct} label={d.meterLabel(Math.round(donePct))} />}
          >
            {d.doneOf(doneCount, cards.length)}
          </StatTile>
        </div>

        {/* Every board at a glance */}
        <section aria-label={d.allBoards}>
          <h2 className="mb-2 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Columns3 className="size-4" /> {d.allBoards}
            <span className="tabular-nums">{boards.length}</span>
          </h2>
          {boards.length === 0 ? (
            <p className="rounded-lg border bg-card px-4 py-8 text-center text-sm text-muted-foreground">{d.firstBoard}</p>
          ) : (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {boardStats.map((b) => {
                const pct = b.total ? Math.round((b.done / b.total) * 100) : 0;
                return (
                  <li key={b.id}>
                    <Link href={`/boards/${b.id}`} className="group block h-full rounded-lg border bg-card p-4 shadow-xs transition-colors hover:border-border-strong hover:bg-accent/40">
                      <div className="flex items-center gap-2">
                        <span
                          aria-hidden
                          className="avatar grid size-6 shrink-0 place-items-center rounded-md text-xs font-semibold"
                          style={{ "--hue": avatarHue(b.id) } as React.CSSProperties}
                        >
                          {b.name.trim()[0]?.toUpperCase() ?? "B"}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{b.name}</span>
                        <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-foreground" />
                      </div>
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={d.pctDone(pct)} title={d.pctDone(pct)}>
                        <div className="bg-brand-gradient h-full rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                        <span>{d.boardDone(b.done, b.total)}</span>
                        <span>· {d.boardCards(b.total - b.done)}</span>
                        {b.late > 0 && <span className="ml-auto font-medium text-destructive">{d.nLate(b.late)}</span>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <Panel
              icon={<CalendarClock />}
              title={d.strip}
              action={
                <Link href="/calendar" className="text-xs underline-offset-4 hover:text-foreground hover:underline">
                  {d.openCalendar}
                </Link>
              }
            >
              <ol className="grid grid-cols-7 sm:grid-cols-14">
                {strip.map(({ day, count }, i) => (
                  <li
                    key={day}
                    title={d.stripDay(day, count)}
                    className={cn(
                      "flex h-28 flex-col justify-between px-2 py-2.5",
                      i === 0 ? "bg-brand-soft-gradient" : "bg-card",
                      i !== 13 && "border-r",
                      i < 7 && "max-sm:border-b",
                    )}
                  >
                    <div className="text-[11px] leading-tight text-muted-foreground">
                      <div className={cn("capitalize", i === 0 && "font-semibold text-brand")}>{i === 0 ? t.common.todayShort : t.fmt.weekday(day)}</div>
                      <div>{+day.slice(8)}</div>
                    </div>
                    <div className="flex items-end gap-1.5">
                      <span
                        className="bg-brand-gradient w-1.5 rounded-full"
                        style={{ height: count ? 8 + (count / stripMax) * 34 : 0 }}
                        aria-hidden
                      />
                      <span className={cn("text-sm font-semibold tabular-nums", !count && "text-muted-foreground/40")}>
                        {count || "–"}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </Panel>

            <section className="overflow-hidden rounded-lg border bg-card shadow-xs">
              <DashboardLists
                members={members}
                today={today}
                lists={[
                  { key: "focus", label: d.tabs.focus, empty: d.empty.focus, cards: focus },
                  { key: "mine", label: d.tabs.mine, empty: d.empty.mine, cards: mine },
                  { key: "late", label: d.tabs.late, empty: d.empty.late, cards: late },
                  { key: "week", label: d.tabs.week, empty: d.empty.week, cards: upcoming },
                ]}
              />
            </section>
          </div>

          <Panel icon={<Users />} title={d.availability} className="self-start">
            <p className="border-b px-4 py-2 text-xs text-muted-foreground">{d.availabilityHint}</p>
            <ul className="divide-y">
              {availability.map(({ member, free, level, late: l, current, soon }) => (
                <li key={member.id}>
                  <Link href={`/workers/${member.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-accent">
                    <Avatar member={member} size={30} className="ring-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate font-medium">{displayName(member)}</span>
                        <span className={cn("shrink-0 text-xs font-medium", LEVEL_TEXT[level])}>{d.levels[level]}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={d.freePct(free)} title={d.freePct(free)}>
                        <div className={cn("h-full rounded-full", LEVEL_BAR[level])} style={{ width: `${Math.max(free, 3)}%` }} />
                      </div>
                      <div className="mt-1 truncate text-xs text-muted-foreground">
                        {current ? d.workingOn(current.title) : d.freeNow}
                        {l > 0 && <span className="text-destructive"> · {d.late(l)}</span>}
                        {soon > 0 && <> · {d.dueSoon(soon)}</>}
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
    </main>
  );
}
