import type { Project } from "@/lib/projects";
import type { TagColor } from "@/lib/tag-colors";

export type Member = { id: string; name: string | null; email: string; image: string | null };
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
  project: Project | null;
};

/** Card plus where it lives, for cross-board views (dashboard, calendar, timeline). */
export type CardRow = CardData & { boardName: string; columnName: string; done: boolean };

export const displayName = (m: Pick<Member, "name" | "email">) => m.name?.trim() || m.email.split("@")[0];
