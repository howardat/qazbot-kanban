import { PRIORITIES } from "@/lib/priority";
import type { CardData } from "@/lib/types";

// The board's "Order by": manual is the dragged order; the rest sort each column on the fly.
export const SORT_KEYS = ["manual", "created", "due", "priority", "points", "title", "creator"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type Sort = { key: SortKey; desc: boolean };
export const MANUAL: Sort = { key: "manual", desc: false };

/** Newest and biggest first by default; everything else A→Z, soonest, most urgent first. */
export const defaultDesc = (key: SortKey) => key === "created" || key === "points";

/**
 * Cards in the given order. Cards missing the value (no deadline, no estimate, no priority) go last
 * whichever way the sort runs, and ties keep the manual order.
 */
export function sortCards(cards: CardData[], sort: Sort, nameOf: (profileId: string) => string): CardData[] {
  if (sort.key === "manual") return cards;
  const value = (c: CardData): string | number | null => {
    switch (sort.key) {
      case "created":
        return c.createdAt;
      case "due":
        return c.dueDate;
      case "priority":
        // Lower index is more urgent; flip so "descending" puts high first.
        return c.priority ? PRIORITIES.length - PRIORITIES.indexOf(c.priority) : null;
      case "points":
        return c.storyPoints;
      case "title":
        return c.title.toLocaleLowerCase();
      case "creator":
        return c.createdBy ? nameOf(c.createdBy).toLocaleLowerCase() : null;
      default:
        return null;
    }
  };
  const dir = sort.desc ? -1 : 1;
  return cards
    .map((card, i) => ({ card, i, v: value(card) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1;
      return (a.v < b.v ? -1 : a.v > b.v ? 1 : 0) * dir || a.i - b.i;
    })
    .map((x) => x.card);
}
