"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CircleDot } from "lucide-react";
import { AvatarStack, DueBadge, BoardIcon } from "@/components/atoms";
import { PriorityIcon } from "@/components/BoardToolbar";
import { useT } from "@/components/I18nProvider";
import { PersonIcon } from "@/components/PersonIcon";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LEVEL_BAR, LEVEL_TEXT, type Level } from "@/lib/availability";
import type { ISODate } from "@/lib/dates";
import { displayName, type CardRow, type Member } from "@/lib/types";
import { cn } from "@/lib/utils";

/** One card as a home-page row: priority, title and board on the left; deadline and people on the right. */
function TaskRow({ card, members, today, showPeople }: { card: CardRow; members: Map<string, Member>; today: ISODate; showPeople?: boolean }) {
  const people = card.assigneeIds.map((id) => members.get(id)).filter((m): m is Member => !!m);
  return (
    <li>
      <Link
        href={`/boards/${card.boardId}?card=${card.id}`}
        className="group flex items-center gap-3 rounded-lg px-3 py-2.5 outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {card.priority ? <PriorityIcon priority={card.priority} /> : <span className="size-3.5 shrink-0" aria-hidden />}
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{card.title}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {card.boardName} · {card.columnName}
          </span>
        </span>
        <DueBadge start={null} due={card.dueDate} today={today} done={false} />
        {showPeople && people.length > 0 && <AvatarStack members={people} size={20} />}
      </Link>
    </li>
  );
}

/** A titled list of task rows, or a quiet line when it's empty. */
export function TaskSection({
  title,
  hint,
  empty,
  cards,
  members,
  today,
  showPeople,
  tone,
}: {
  title: string;
  hint?: string;
  empty: string;
  cards: CardRow[];
  members: Member[];
  today: ISODate;
  showPeople?: boolean;
  tone?: "danger";
}) {
  const byId = new Map(members.map((m) => [m.id, m]));
  return (
    <section>
      <h2 className="flex items-baseline gap-2 px-3 pb-1">
        <span className={cn("text-[15px] font-semibold", tone === "danger" && "text-destructive")}>{title}</span>
        <span className="text-[13px] text-muted-foreground tabular-nums">{cards.length}</span>
        {hint && <span className="ml-auto text-xs text-muted-foreground">{hint}</span>}
      </h2>
      {cards.length ? (
        <ul className="divide-y divide-border/60">
          {cards.map((c) => (
            <TaskRow key={c.id} card={c} members={byId} today={today} showPeople={showPeople} />
          ))}
        </ul>
      ) : (
        <p className="px-3 py-3 text-sm text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

export type Mate = { member: Member; level: Level; free: number; cards: CardRow[] };

/**
 * The team in one row: each person's avatar ringed in their busyness colour, with name and level.
 * Clicking someone opens their open tasks in a side panel.
 */
export function TeamRow({ mates, members, today }: { mates: Mate[]; members: Member[]; today: ISODate }) {
  const t = useT();
  const d = t.dashboard;
  const [open, setOpen] = useState<string | null>(null);
  const mate = mates.find((m) => m.member.id === open) ?? null;
  const doing = mate?.cards.filter((c) => c.inProgress) ?? [];
  const next = mate?.cards.filter((c) => !c.inProgress) ?? [];

  return (
    <>
      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {mates.map(({ member, level, free }) => (
          <li key={member.id} className="shrink-0">
            <button
              type="button"
              onClick={() => setOpen(member.id)}
              className="flex w-36 cursor-pointer flex-col items-center gap-2 rounded-xl border bg-card px-3 pt-4 pb-3 text-center shadow-xs outline-none transition hover:border-border-strong hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className={cn("rounded-full p-0.5 ring-2", LEVEL_RING[level])}>
                <PersonIcon member={member} size={44} />
              </span>
              <span className="w-full truncate text-[13px] font-medium">{displayName(member).split(/\s+/)[0]}</span>
              <span className="flex w-full flex-col gap-1">
                <span className={cn("text-xs font-medium", LEVEL_TEXT[level])}>{d.levels[level]}</span>
                {/* Busyness, filled by how much of their plate is taken */}
                <span className="h-1 w-full overflow-hidden rounded-full bg-muted" title={d.freePct(free)}>
                  <span className={cn("block h-full rounded-full", LEVEL_BAR[level])} style={{ width: `${Math.max(6, 100 - free)}%` }} />
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <Sheet open={!!mate} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" className="w-full gap-0 p-0 sm:max-w-md">
          {mate && (
            <>
              <SheetHeader className="border-b p-5">
                <div className="flex items-center gap-3">
                  <PersonIcon member={mate.member} size={44} />
                  <div className="min-w-0">
                    <SheetTitle className="truncate text-base">{displayName(mate.member)}</SheetTitle>
                    <SheetDescription className={cn("text-xs font-medium", LEVEL_TEXT[mate.level])}>
                      {d.levels[mate.level]} · {d.openCount(mate.cards.length)}
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
                {mate.cards.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">{d.nothingOpen}</p>}
                {doing.length > 0 && <TaskSection title={d.inProgress} empty="" cards={doing} members={members} today={today} />}
                {next.length > 0 && <TaskSection title={d.upNext} empty="" cards={next} members={members} today={today} />}
              </div>
              <div className="border-t p-3">
                <Link href={`/workers/${mate.member.id}`} className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium hover:bg-accent">
                  <CircleDot className="size-3.5" /> {d.openProfile} <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}

const LEVEL_RING: Record<Level, string> = {
  free: "ring-success/70",
  room: "ring-sky-500/70",
  busy: "ring-amber-500/80",
  overloaded: "ring-destructive/80",
};

export type RecentBoard = { id: string; name: string; total: number; done: number; late: number; lastAt: string | null };

/** The four most recently active boards as a row of cards: name, last change, progress. */
function BoardsRow({ boards }: { boards: RecentBoard[] }) {
  const t = useT();
  const d = t.dashboard;
  if (boards.length === 0) return null;
  return (
    <section className="space-y-3">
      <h2 className="flex items-baseline gap-2 px-1">
        <span className="text-[15px] font-semibold">{d.recentBoards}</span>
      </h2>
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {boards.map((b) => {
          const pct = b.total ? Math.round((b.done / b.total) * 100) : 0;
          return (
            <li key={b.id}>
              <Link
                href={`/boards/${b.id}`}
                className="group flex h-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-xs outline-none transition hover:border-border-strong hover:shadow-sm focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="flex items-center gap-2">
                  <BoardIcon board={b} size={28} />
                  <span className="min-w-0 flex-1 truncate font-medium">{b.name}</span>
                </span>
                <span className="text-xs text-muted-foreground">{b.lastAt ? t.workers.updated(t.fmt.ago(b.lastAt)) : d.noActivity}</span>
                <span className="mt-auto space-y-1.5">
                  <span className="block h-1.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={d.pctDone(pct)} title={d.pctDone(pct)}>
                    <span className="bg-brand-gradient block h-full rounded-full" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                    {d.boardDone(b.done, b.total)}
                    {b.late > 0 && <span className="ml-auto font-medium text-destructive">{d.nLate(b.late)}</span>}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The home page body: recent boards, the task lists as tabs, then the team row. */
export function HomeLists({
  sections,
  boards,
  mates,
  members,
  today,
}: {
  sections: { key: string; title: string; hint?: string; empty: string; cards: CardRow[]; showPeople?: boolean; tone?: "danger" }[];
  boards: RecentBoard[];
  mates: Mate[];
  members: Member[];
  today: ISODate;
}) {
  const d = useT().dashboard;
  const byId = new Map(members.map((m) => [m.id, m]));
  return (
    <>
      <BoardsRow boards={boards} />

      {/* One tab per view of your tasks; each shows its count */}
      <Tabs defaultValue={sections[0]?.key} className="gap-3">
        <TabsList>
          {sections.map((s) => (
            <TabsTrigger key={s.key} value={s.key} className={cn(s.tone === "danger" && s.cards.length > 0 && "text-destructive data-[state=active]:text-destructive")}>
              {s.title}
              <span className="text-muted-foreground tabular-nums">{s.cards.length}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {sections.map((s) => (
          <TabsContent key={s.key} value={s.key}>
            {s.hint && <p className="px-3 pb-1 text-xs text-muted-foreground">{s.hint}</p>}
            {s.cards.length ? (
              <ul className="divide-y divide-border/60">
                {s.cards.map((c) => (
                  <TaskRow key={c.id} card={c} members={byId} today={today} showPeople={s.showPeople} />
                ))}
              </ul>
            ) : (
              <p className="px-3 py-6 text-sm text-muted-foreground">{s.empty}</p>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <section className="space-y-3">
        <h2 className="flex items-baseline gap-2 px-1">
          <span className="text-[15px] font-semibold">{d.teamTitle}</span>
          <span className="text-xs text-muted-foreground">{d.teamHint}</span>
        </h2>
        <TeamRow mates={mates} members={members} today={today} />
      </section>
    </>
  );
}
