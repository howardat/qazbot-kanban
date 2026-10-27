import Link from "next/link";
import { AlertCircle, CalendarClock, ChevronRight, CircleCheck, Columns3, UserRound, Users } from "lucide-react";
import { updateMyName } from "@/app/actions";
import { Avatar, PageHeader, Panel } from "@/components/atoms";
import { DashboardLists } from "@/components/DashboardLists";
import { NewBoardButton } from "@/components/NewBoardButton";
import { ProgressMeter } from "@/components/ProgressMeter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadBoards, loadCards, loadMembers } from "@/lib/data";
import { addDays, diffDays, todayISO } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";
import { track } from "@/lib/activity";
import { requireUser } from "@/lib/session";
import { displayName } from "@/lib/types";
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
  const late = open.filter(isLate).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const mine = open
    .filter((c) => c.assigneeIds.includes(user.id))
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
  const myLate = mine.filter(isLate).length;
  const upcoming = open
    .filter((c) => c.dueDate && c.dueDate >= today && diffDays(c.dueDate, today) < 7)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const doneCount = cards.length - open.length;
  const donePct = cards.length ? (doneCount / cards.length) * 100 : 0;
  const lateBoards = new Set(late.map((c) => c.boardId)).size;

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

  const workload = members
    .map((m) => {
      const theirs = open.filter((c) => c.assigneeIds.includes(m.id));
      return { member: m, open: theirs.length, late: theirs.filter(isLate).length };
    })
    .sort((a, b) => b.open - a.open);
  const workMax = Math.max(1, ...workload.map((w) => w.open));
  const unassigned = open.filter((c) => c.assigneeIds.length === 0).length;

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
          <form action={updateMyName} className="flex flex-wrap items-center gap-3 rounded-lg border bg-brand-soft p-3 pl-4">
            <label htmlFor="display-name" className="mr-auto text-sm">
              {d.namePrompt}
            </label>
            <Input id="display-name" name="name" required maxLength={80} placeholder={d.namePlaceholder} className="w-56 bg-card" />
            <Button>{d.saveName}</Button>
          </form>
        )}

        {/* Headline numbers */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat icon={<UserRound />} title={d.assignedToYou} value={mine.length}>
            {myLate ? (
              <span className="text-destructive">{d.nLate(myLate)}</span>
            ) : (
              <span className="text-success">{d.onSchedule}</span>
            )}
          </Stat>
          <Stat icon={<AlertCircle />} title={d.pastDeadline} value={late.length}>
            {late.length ? d.onBoards(lateBoards) : d.nothingLate}
          </Stat>
          <Stat icon={<CalendarClock />} title={d.dueIn7} value={upcoming.length}>
            {upcoming[0] ? (
              <span className="block truncate">{d.next(upcoming[0].title, upcoming[0].dueDate!)}</span>
            ) : (
              d.noDeadlinesWeek
            )}
          </Stat>
          <Panel icon={<CircleCheck />} title={d.completion}>
            <div className="space-y-3 p-4">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tracking-tight tabular-nums">{Math.round(donePct)}%</span>
                <span className="text-sm text-muted-foreground">{d.doneOf(doneCount, cards.length)}</span>
              </div>
              <ProgressMeter value={donePct} label={d.meterLabel(Math.round(donePct))} />
            </div>
          </Panel>
        </div>

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
                      i === 0 ? "bg-brand-soft" : "bg-card",
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
                  { key: "mine", label: d.tabs.mine, empty: d.empty.mine, cards: mine },
                  { key: "late", label: d.tabs.late, empty: d.empty.late, cards: late },
                  { key: "week", label: d.tabs.week, empty: d.empty.week, cards: upcoming },
                ]}
              />
            </section>
          </div>

          <div className="space-y-4">
            <Panel icon={<Columns3 />} title={t.nav.boards} action={<span className="text-xs tabular-nums">{boards.length}</span>}>
              <ul id="boards" className="divide-y">
                {boardStats.map((b) => {
                  const pct = b.total ? Math.round((b.done / b.total) * 100) : 0;
                  return (
                    <li key={b.id}>
                      <Link href={`/boards/${b.id}`} className="group block px-4 py-3 hover:bg-accent">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-medium">{b.name}</span>
                          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground tabular-nums">
                            {d.boardDone(b.done, b.total)}
                            <ChevronRight className="size-3.5 opacity-50 group-hover:opacity-100" />
                          </span>
                        </div>
                        <div
                          className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"
                          role="img"
                          aria-label={d.pctDone(pct)}
                          title={d.pctDone(pct)}
                        >
                          <div className="bg-brand-gradient h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        {b.late > 0 && <div className="mt-1.5 text-xs font-medium text-destructive">{d.nLate(b.late)}</div>}
                      </Link>
                    </li>
                  );
                })}
                {boards.length === 0 && (
                  <li className="px-4 py-8 text-center text-sm text-muted-foreground">{d.firstBoard}</li>
                )}
              </ul>
            </Panel>

            <Panel icon={<Users />} title={d.perPerson} action={<span className="text-xs">{d.unassigned(unassigned)}</span>}>
              <ul className="space-y-3 p-4">
                {workload.map(({ member, open: n, late: l }) => (
                  <li key={member.id} className="flex items-center gap-3" title={d.personTitle(displayName(member), n, l)}>
                    <Avatar member={member} size={28} className="ring-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="truncate">{displayName(member)}</span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">
                          {l > 0 && <span className="mr-1.5 text-xs font-medium text-destructive">{d.late(l)}</span>}
                          {n}
                        </span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                        <div className="bg-brand-gradient h-full rounded-full" style={{ width: `${(n / workMax) * 100}%` }} />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      </div>
    </main>
  );
}

function Stat({
  icon,
  title,
  value,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  value: number;
  children: React.ReactNode;
}) {
  return (
    <Panel icon={icon} title={title}>
      <div className="space-y-1 p-4">
        <div className="text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </Panel>
  );
}
