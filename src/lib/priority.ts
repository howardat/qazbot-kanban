// Card priority, most urgent first. A card without one simply has no priority.
export const PRIORITIES = ["urgent", "high", "medium", "low"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Flag colour per priority, as text classes. */
export const PRIORITY_STYLE: Record<Priority, string> = {
  urgent: "text-red-600 dark:text-red-400",
  high: "text-orange-500 dark:text-orange-400",
  medium: "text-yellow-500 dark:text-yellow-300",
  low: "text-sky-500 dark:text-sky-400",
};
