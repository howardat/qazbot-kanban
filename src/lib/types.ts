import type { CardSource } from "@/lib/card-source";
import type { Priority } from "@/lib/priority";
import type { TagColor } from "@/lib/tag-colors";

export type Member = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  /** Chosen preset avatar for the office figure and icon; null or missing means automatic. */
  avatar?: number | null;
};
export type Tag = { id: string; boardId: string; name: string; color: TagColor };

export type CardData = {
  id: string;
  boardId: string;
  columnId: string;
  title: string;
  description: string;
  startDate: string | null;
  dueDate: string | null;
  assigneeIds: string[];
  tagIds: string[];
  priority: Priority | null;
  /** Estimate (1, 2, 3, 5, 8, 13), or null when unestimated. */
  storyPoints: number | null;
  /** Who made the card; null for cards from before this was recorded or whose maker left. */
  createdBy: string | null;
  /** In the app, or through Claude (the assistant or MCP). */
  createdVia: CardSource;
  /** ISO timestamp. */
  createdAt: string;
};

/** A kanban column as the timeline groups cards by it. */
export type TimelineColumn = { id: string; boardId: string; boardName: string; name: string; isDone: boolean; isInProgress: boolean };

/** Card plus where it lives, for cross-board views (dashboard, calendar, timeline). */
export type CardRow = CardData & {
  boardName: string;
  columnName: string;
  done: boolean;
  /** In a column marked "in progress". */
  inProgress: boolean;
  /** When the card entered its current column (ISO). */
  movedAt: string;
};

export const displayName = (m: Pick<Member, "name" | "email">) => m.name?.trim() || m.email.split("@")[0];
