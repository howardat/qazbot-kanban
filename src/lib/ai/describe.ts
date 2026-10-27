import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { boards, cards, columns, profiles } from "@/db/schema";
import type { Dict } from "@/lib/i18n";

type Args = Record<string, unknown>;

/** One-line, human summary of a tool call for the chat (what was looked up, or what a change will do). */
export async function describeCall(name: string, args: Args, t: Dict): Promise<string> {
  const a = t.assistant.actions;
  const ids = (keys: string[]) => keys.map((k) => args[k]).filter((v): v is string => typeof v === "string");
  const people = Array.isArray(args.assigneeIds) ? (args.assigneeIds as string[]) : [];

  const [cardRows, colRows, boardRows, personRows] = await Promise.all([
    ids(["cardId"]).length ? db.select({ id: cards.id, title: cards.title }).from(cards).where(inArray(cards.id, ids(["cardId"]))) : [],
    ids(["columnId"]).length
      ? db.select({ id: columns.id, name: columns.name, boardId: columns.boardId }).from(columns).where(inArray(columns.id, ids(["columnId"])))
      : [],
    db.select({ id: boards.id, name: boards.name }).from(boards),
    people.length ? db.select({ id: profiles.id, name: profiles.name, email: profiles.email }).from(profiles).where(inArray(profiles.id, people)) : [],
  ]);
  const card = cardRows[0]?.title ?? "?";
  const col = colRows[0];
  const boardName = (bid: unknown) => boardRows.find((b) => b.id === bid)?.name ?? "?";
  const personNames = personRows.map((p) => p.name?.trim() || p.email.split("@")[0]).join(", ");
  const day = (v: unknown) => (typeof v === "string" ? t.fmt.day(v) : a.cleared);

  switch (name) {
    case "list_boards":
      return a.listBoards;
    case "get_board":
      return a.getBoard(boardName(args.boardId));
    case "list_members":
      return a.listMembers;
    case "search_cards":
      return a.searchCards(typeof args.query === "string" ? args.query : null);
    case "create_card": {
      const extras = [
        args.startDate || args.dueDate
          ? `${args.startDate ? day(args.startDate) : ""}${args.startDate && args.dueDate ? " – " : ""}${args.dueDate ? day(args.dueDate) : ""}`
          : null,
        personNames || null,
        Array.isArray(args.tags) && args.tags.length ? (args.tags as string[]).join(", ") : null,
      ].filter(Boolean);
      return a.createCard(String(args.title ?? ""), col?.name ?? "?", boardName(col?.boardId), extras.join(" · "));
    }
    case "update_card": {
      const changes = [
        "title" in args ? `${t.editor.title.toLowerCase()} → “${args.title}”` : null,
        "description" in args ? t.editor.description.toLowerCase() : null,
        "startDate" in args ? `${t.editor.start.toLowerCase()} → ${day(args.startDate)}` : null,
        "dueDate" in args ? `${t.editor.deadline.toLowerCase()} → ${day(args.dueDate)}` : null,
        "assigneeIds" in args ? `${t.editor.assignees.toLowerCase()} → ${personNames || a.nobody}` : null,
        "tags" in args ? `${t.editor.tags.toLowerCase()} → ${(args.tags as string[]).join(", ") || a.nobody}` : null,
      ].filter(Boolean);
      return a.updateCard(card, changes.join("; "));
    }
    case "move_card":
      return a.moveCard(card, col?.name ?? "?");
    case "delete_card":
      return a.deleteCard(card);
    case "create_board":
      return a.createBoard(String(args.name ?? ""), Array.isArray(args.columns) ? (args.columns as string[]).join(", ") : "");
    case "add_column":
      return a.addColumn(String(args.name ?? ""), boardName(args.boardId));
    case "create_tag":
      return a.createTag(String(args.name ?? ""), boardName(args.boardId));
    default:
      return name;
  }
}
