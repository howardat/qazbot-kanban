"use client";

import Link from "next/link";
import { ChevronRight, Flag } from "lucide-react";
import { AvatarStack, DueBadge } from "@/components/atoms";
import { useT } from "@/components/I18nProvider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PRIORITY_STYLE } from "@/lib/priority";
import type { CardRow, Member } from "@/lib/types";
import { cn } from "@/lib/utils";

type List = { key: string; label: string; empty: string; cards: CardRow[] };

/** Tabbed card lists on the dashboard (focus / mine / late / this week), most pressing first. */
export function DashboardLists({ lists, members, today }: { lists: List[]; members: Member[]; today: string }) {
  const t = useT();
  const memberById = new Map(members.map((m) => [m.id, m]));
  return (
    <Tabs defaultValue={lists[0].key} className="gap-0">
      <div className="flex h-10 items-center justify-between gap-3 border-b pr-1.5 pl-4">
        <h2 className="text-sm font-medium">{t.dashboard.cards}</h2>
        <TabsList size="sm">
          {lists.map((l) => (
            <TabsTrigger key={l.key} value={l.key}>
              {l.label}
              <span className="text-muted-foreground tabular-nums">{l.cards.length}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {lists.map((l) => (
        <TabsContent key={l.key} value={l.key}>
          {l.cards.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">{l.empty}</p>
          ) : (
            <ul className="divide-y">
              {l.cards.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <Link href={`/boards/${c.boardId}`} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-accent">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{c.title}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.boardName}, {c.columnName}
                      </div>
                    </div>
                    {c.priority && (
                      <Flag className={cn("size-3.5 shrink-0", PRIORITY_STYLE[c.priority])} fill="currentColor" aria-label={t.priority[c.priority]} />
                    )}
                    <DueBadge start={null} due={c.dueDate} today={today} done={c.done} />
                    <AvatarStack members={c.assigneeIds.map((id) => memberById.get(id)).filter((m): m is Member => !!m)} />
                    <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-foreground" />
                  </Link>
                </li>
              ))}
              {l.cards.length > 8 && <li className="px-4 py-2.5 text-xs text-muted-foreground">{t.dashboard.andMore(l.cards.length - 8)}</li>}
            </ul>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
