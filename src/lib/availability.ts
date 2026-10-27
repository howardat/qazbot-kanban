import { diffDays, type ISODate } from "@/lib/dates";
import type { CardRow, Member } from "@/lib/types";

// How free someone is, from their open cards. Shared by the dashboard and the Workers team tab.

/** About a full plate in load points. */
const CAPACITY = 6;

export type Level = "free" | "room" | "busy" | "overloaded";

export const LEVEL_TEXT: Record<Level, string> = {
  free: "text-success",
  room: "text-sky-600 dark:text-sky-400",
  busy: "text-amber-600 dark:text-amber-400",
  overloaded: "text-destructive",
};
export const LEVEL_BAR: Record<Level, string> = { free: "bg-success", room: "bg-sky-500", busy: "bg-amber-500", overloaded: "bg-destructive" };

export type Availability = {
  member: Member;
  /** 0–100: how much room is left. */
  free: number;
  level: Level;
  open: number;
  late: number;
  /** Not late, due within the next 7 days. */
  soon: number;
  /** Most recently started in-progress card. */
  current: CardRow | null;
};

export function availabilityOf(member: Member, openCards: CardRow[], today: ISODate): Availability {
  const theirs = openCards.filter((c) => c.assigneeIds.includes(member.id));
  const isLate = (c: CardRow) => !!c.dueDate && c.dueDate < today;
  const late = theirs.filter(isLate).length;
  const doing = theirs.filter((c) => c.inProgress).sort((a, b) => b.movedAt.localeCompare(a.movedAt));
  const soon = theirs.filter((c) => !isLate(c) && c.dueDate && diffDays(c.dueDate, today) < 7).length;
  // Late work weighs most, then what's in progress, then this week's deadlines, then the backlog.
  const load = late * 2 + doing.length * 1.5 + soon + (theirs.length - late - doing.length) * 0.25;
  const free = Math.max(0, Math.min(100, Math.round(100 - (load / CAPACITY) * 100)));
  const level: Level = free >= 75 ? "free" : free >= 40 ? "room" : free >= 10 ? "busy" : "overloaded";
  return { member, free, level, open: theirs.length, late, soon, current: doing[0] ?? null };
}
