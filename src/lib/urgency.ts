import type { ISODate } from "@/lib/dates";
import { PRIORITIES } from "@/lib/priority";
import type { CardData } from "@/lib/types";

const rank = (p: CardData["priority"]) => (p ? PRIORITIES.indexOf(p) : PRIORITIES.length);

/**
 * Most pressing first: overdue cards (oldest deadline first), then by priority (urgent → none), then
 * by the closest deadline (no deadline last).
 */
export function byUrgency(today: ISODate) {
  return (a: Pick<CardData, "dueDate" | "priority" | "title">, b: Pick<CardData, "dueDate" | "priority" | "title">) => {
    const lateA = !!a.dueDate && a.dueDate < today;
    const lateB = !!b.dueDate && b.dueDate < today;
    if (lateA !== lateB) return lateA ? -1 : 1;
    if (lateA && lateB) return a.dueDate!.localeCompare(b.dueDate!);
    return rank(a.priority) - rank(b.priority) || (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999") || a.title.localeCompare(b.title);
  };
}
