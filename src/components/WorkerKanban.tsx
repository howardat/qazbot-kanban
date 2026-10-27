"use client";

import { useState } from "react";
import Link from "next/link";
import { CircleCheck, CircleDashed, CircleDot, Flag, Users } from "lucide-react";
import { AvatarStack, DueBadge, Panel } from "@/components/atoms";
import { useT } from "@/components/I18nProvider";
import { PersonIcon } from "@/components/PersonIcon";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { addDays, type ISODate } from "@/lib/dates";
import { PRIORITY_STYLE } from "@/lib/priority";
import { displayName, type CardRow, type Member } from "@/lib/types";
import { byUrgency } from "@/lib/urgency";
import { cn } from "@/lib/utils";

const EVERYONE = "all";

/**
 * Cross-board kanban for one person (or everyone): to do, in progress, and done in the last two
 * weeks. The person filter starts on the worker whose page this is.
 */
export function WorkerKanban({ cards, members, personId, today }: { cards: CardRow[]; members: Member[]; personId: string; today: ISODate }) {
  const t = useT();
  const w = t.workers;
  const [person, setPerson] = useState(personId);
  const memberById = new Map(members.map((m) => [m.id, m]));
  const theirs = person === EVERYONE ? cards : cards.filter((c) => c.assigneeIds.includes(person));
  const since = addDays(today, -14);
  const urgent = byUrgency(today);
  const lanes = [
    { key: "todo", Icon: CircleDashed, tone: "text-muted-foreground", cards: theirs.filter((c) => !c.done && !c.inProgress).sort(urgent) },
    { key: "doing", Icon: CircleDot, tone: "text-primary", cards: theirs.filter((c) => !c.done && c.inProgress).sort(urgent) },
    {
      key: "done",
      Icon: CircleCheck,
      tone: "text-success",
      cards: theirs.filter((c) => c.done && c.movedAt.slice(0, 10) >= since).sort((a, b) => b.movedAt.localeCompare(a.movedAt)),
    },
  ] as const;

  return (
    <Panel
      icon={<Users />}
      title={w.kanban}
      action={
        <Select value={person} onValueChange={setPerson}>
          <SelectTrigger size="sm" className="h-7 w-48 bg-card" aria-label={w.person}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={EVERYONE}>{t.common.everyone}</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                <PersonIcon member={m} size={16} /> {displayName(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <div className="grid grid-cols-1 gap-3 bg-muted/30 p-3 md:grid-cols-3">
        {lanes.map(({ key, Icon, tone, cards: laneCards }) => (
          <section key={key} className="min-w-0">
            <h3 className="flex h-8 items-center gap-1.5 px-1 text-sm font-medium">
              <Icon className={cn("size-4", tone)} /> {w.lanes[key]}
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">{laneCards.length}</span>
            </h3>
            <ul className="space-y-2">
              {laneCards.length === 0 && <li className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">{w.emptyLane}</li>}
              {laneCards.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/boards/${c.boardId}`}
                    className="block rounded-lg border bg-card p-3 text-sm shadow-xs transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-sm"
                  >
                    <div className={cn("leading-snug font-medium break-words", c.done && "text-muted-foreground line-through decoration-muted-foreground/40")}>{c.title}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {c.boardName} · {c.columnName}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {c.priority && (
                        <span className="inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-xs font-medium">
                          <Flag className={cn("size-3.5", PRIORITY_STYLE[c.priority])} fill="currentColor" /> {t.priority[c.priority]}
                        </span>
                      )}
                      <DueBadge start={c.startDate} due={c.dueDate} today={today} done={c.done} />
                      {person === EVERYONE && (
                        <span className="ml-auto">
                          <AvatarStack members={c.assigneeIds.map((id) => memberById.get(id)).filter((m): m is Member => !!m)} size={20} />
                        </span>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Panel>
  );
}
