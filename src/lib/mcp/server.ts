import "server-only";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";
import { z, ZodError } from "zod";
import { db } from "@/db";
import { boards, cards, columns, TAG_COLORS, tags } from "@/db/schema";
import {
  addCardOp,
  addColumnOp,
  createBoardOp,
  createTagOp,
  deleteCardOp,
  moveCardOp,
  patchCardOp,
  type Actor,
} from "@/lib/board-ops";
import { loadCards, loadMembers } from "@/lib/data";
import { createExpenseOp, deleteExpenseOp, loadExpenses, updateExpenseOp } from "@/lib/expenses";
import { PRIORITIES } from "@/lib/priority";
import { assertBoard, assertCard, assertColumn, onVisible, visibleBoardIds } from "@/lib/board-access";
import type { CardRow } from "@/lib/types";

// Kanban and expense tools over MCP. The same server backs the in-app assistant (in-memory transport) and the
// external /api/mcp endpoint (personal access tokens). Tools run with the caller's permissions.
// Read tools carry readOnlyHint; the assistant runs those freely and asks the user before any other.

export type McpContext = {
  actor: Actor;
  /** Starter columns for create_board, in the caller's language. */
  starterColumns: string[];
  /** Called after every successful write, so pages show fresh data. */
  onChange: () => void;
};

const READ = { readOnlyHint: true, openWorldHint: false } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false, openWorldHint: false } as const;
const DESTRUCTIVE = { readOnlyHint: false, destructiveHint: true, openWorldHint: false } as const;

const uuid = z.string().uuid();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD");

// Compact JSON: tool results go straight into the model's context, where whitespace costs tokens.
const ok = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value) }] });
const fail = (message: string) => ({ content: [{ type: "text" as const, text: message }], isError: true });

/** Wrap a handler so thrown errors (validation, not found, permissions) become tool errors, not crashes. */
function safe<A>(run: (args: A) => Promise<ReturnType<typeof ok>>) {
  return async (args: A) => {
    try {
      return await run(args);
    } catch (e) {
      if (e instanceof ZodError) return fail(e.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; "));
      return fail(e instanceof Error ? e.message : "Something went wrong.");
    }
  };
}

/**
 * A card as tools return it, kept small because every field lands in the model's context: empty
 * fields are left out, and people and tags come as names (ids are in list_members and get_board).
 */
const cardOut = (c: CardRow, names: Map<string, string>, tagNames: Map<string, string>) => ({
  id: c.id,
  title: c.title,
  ...(c.description ? { description: c.description.slice(0, 500) } : {}),
  board: c.boardName,
  column: c.columnName,
  ...(c.done ? { done: true } : {}),
  ...(c.startDate ? { startDate: c.startDate } : {}),
  ...(c.dueDate ? { dueDate: c.dueDate } : {}),
  ...(c.assigneeIds.length ? { assignees: c.assigneeIds.map((id) => names.get(id) ?? id) } : {}),
  ...(c.tagIds.length ? { tags: c.tagIds.map((id) => tagNames.get(id) ?? id) } : {}),
  ...(c.priority ? { priority: c.priority } : {}),
});

async function lookups() {
  const [members, tagRows] = await Promise.all([loadMembers(), db.select().from(tags)]);
  return {
    names: new Map(members.map((m) => [m.id, m.name?.trim() || m.email.split("@")[0]])),
    tagNames: new Map(tagRows.map((t) => [t.id, t.name])),
  };
}

export function createMcpServer(ctx: McpContext) {
  const server = new McpServer({ name: "qazbot-kanban", version: "1.0.0" });

  // ---------- Read ----------

  server.registerTool(
    "list_boards",
    {
      title: "List boards",
      description: "All boards with their columns (id, name, whether it is the done or in-progress column, card count).",
      annotations: READ,
    },
    safe(async () => {
      const [allBoards, colRows, cardRows, visible] = await Promise.all([
        db.select().from(boards).orderBy(asc(boards.createdAt)),
        db.select().from(columns).orderBy(asc(columns.position)),
        db.select({ columnId: cards.columnId }).from(cards),
        visibleBoardIds(ctx.actor),
      ]);
      const boardRows = onVisible(allBoards.map((b) => ({ ...b, boardId: b.id })), visible);
      const counts = new Map<string, number>();
      for (const c of cardRows) counts.set(c.columnId, (counts.get(c.columnId) ?? 0) + 1);
      return ok(
        boardRows.map((b) => ({
          id: b.id,
          name: b.name,
          columns: colRows
            .filter((c) => c.boardId === b.id)
            .map((c) => ({ id: c.id, name: c.name, isDone: c.isDone, isInProgress: c.isInProgress, cards: counts.get(c.id) ?? 0 })),
        })),
      );
    }),
  );

  server.registerTool(
    "get_board",
    {
      title: "Get board",
      description: "One board in full: columns in order, every card with dates, assignees and tags, and the board's tags.",
      inputSchema: { boardId: uuid },
      annotations: READ,
    },
    safe(async ({ boardId }) => {
      await assertBoard(ctx.actor, boardId);
      const [board] = await db.select().from(boards).where(eq(boards.id, boardId));
      if (!board) return fail("Board not found.");
      const [colRows, cardRows, tagRows, { names, tagNames }] = await Promise.all([
        db.select().from(columns).where(eq(columns.boardId, boardId)).orderBy(asc(columns.position)),
        loadCards(ctx.actor, boardId),
        db.select().from(tags).where(eq(tags.boardId, boardId)),
        lookups(),
      ]);
      return ok({
        id: board.id,
        name: board.name,
        tags: tagRows.map((t) => ({ id: t.id, name: t.name, color: t.color })),
        columns: colRows.map((c) => ({
          id: c.id,
          name: c.name,
          isDone: c.isDone,
          isInProgress: c.isInProgress,
          cards: cardRows.filter((k) => k.columnId === c.id).map((k) => cardOut(k, names, tagNames)),
        })),
      });
    }),
  );

  server.registerTool(
    "list_members",
    {
      title: "List people",
      description: "Everyone who can be assigned to cards (id, name, email).",
      annotations: READ,
    },
    safe(async () => ok((await loadMembers()).map((m) => ({ id: m.id, name: m.name, email: m.email })))),
  );

  server.registerTool(
    "search_cards",
    {
      title: "Search cards",
      description:
        "Find cards across boards. All filters are optional and combine. Done cards are left out unless includeDone is true. Returns at most 60. Assignees come as names; list_members has their ids, and get_board or list_boards the column ids.",
      inputSchema: {
        query: z.string().max(200).optional().describe("Text to match in title or description"),
        boardId: uuid.optional(),
        assigneeId: uuid.optional(),
        unassigned: z.boolean().optional(),
        dueFrom: date.optional().describe("Deadline on or after this day"),
        dueTo: date.optional().describe("Deadline on or before this day"),
        overdueAsOf: date.optional().describe("Only open cards whose deadline is before this day (pass today)"),
        noDates: z.boolean().optional().describe("Only cards without start date or deadline"),
        includeDone: z.boolean().optional(),
      },
      annotations: READ,
    },
    safe(async (f) => {
      if (f.boardId) await assertBoard(ctx.actor, f.boardId);
      let rows = await loadCards(ctx.actor, f.boardId);
      if (f.query) {
        const matches = await db
          .select({ id: cards.id })
          .from(cards)
          .where(or(ilike(cards.title, `%${f.query}%`), ilike(cards.description, `%${f.query}%`)));
        const ids = new Set(matches.map((m) => m.id));
        rows = rows.filter((c) => ids.has(c.id));
      }
      rows = rows.filter(
        (c) =>
          (f.includeDone || !c.done) &&
          (!f.assigneeId || c.assigneeIds.includes(f.assigneeId)) &&
          (!f.unassigned || c.assigneeIds.length === 0) &&
          (!f.dueFrom || (!!c.dueDate && c.dueDate >= f.dueFrom)) &&
          (!f.dueTo || (!!c.dueDate && c.dueDate <= f.dueTo)) &&
          (!f.overdueAsOf || (!c.done && !!c.dueDate && c.dueDate < f.overdueAsOf)) &&
          (!f.noDates || (!c.startDate && !c.dueDate)),
      );
      const { names, tagNames } = await lookups();
      return ok({ total: rows.length, cards: rows.slice(0, 60).map((c) => cardOut(c, names, tagNames)) });
    }),
  );

  // ---------- Write ----------

  const tagIdsFor = async (boardId: string, names: string[] | undefined) => {
    if (!names?.length) return undefined;
    const rows = await db.select().from(tags).where(and(eq(tags.boardId, boardId), inArray(tags.name, names)));
    const missing = names.filter((n) => !rows.some((r) => r.name === n));
    for (const n of missing) rows.push(await createTagOp(boardId, { name: n, color: "sky" }));
    return rows.map((r) => r.id);
  };

  server.registerTool(
    "create_card",
    {
      title: "Create card",
      description:
        "Add a card at the bottom of a column. Tags are given by name; missing tags are created on that board. Without a dueDate the card is due tomorrow; without assigneeIds it is assigned to you.",
      inputSchema: {
        columnId: uuid,
        title: z.string().min(1).max(200),
        description: z.string().max(10_000).optional(),
        startDate: date.optional(),
        dueDate: date.optional(),
        assigneeIds: z.array(uuid).max(50).optional(),
        tags: z.array(z.string().min(1).max(40)).max(30).optional(),
        priority: z.enum(PRIORITIES).nullable().optional().describe("high, medium or low; null clears it."),
      },
      annotations: WRITE,
    },
    safe(async (a) => {
      await assertColumn(ctx.actor, a.columnId);
      const cardId = await addCardOp(ctx.actor, a.columnId, a.title, { startDate: a.startDate, dueDate: a.dueDate });
      const [col] = await db.select({ boardId: columns.boardId }).from(columns).where(eq(columns.id, a.columnId));
      const tagIds = await tagIdsFor(col.boardId, a.tags);
      if (a.description || a.assigneeIds || tagIds || a.priority) {
        await patchCardOp(cardId, {
          ...(a.description ? { description: a.description } : {}),
          ...(a.priority ? { priority: a.priority } : {}),
          ...(a.assigneeIds ? { assigneeIds: a.assigneeIds } : {}),
          ...(tagIds ? { tagIds } : {}),
        });
      }
      ctx.onChange();
      return ok({ created: cardId });
    }),
  );

  server.registerTool(
    "update_card",
    {
      title: "Update card",
      description:
        "Change some fields of a card; anything left out stays the same. Pass null for a date to clear it. assigneeIds and tags replace the current lists.",
      inputSchema: {
        cardId: uuid,
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(10_000).optional(),
        startDate: date.nullable().optional(),
        dueDate: date.nullable().optional(),
        assigneeIds: z.array(uuid).max(50).optional(),
        tags: z.array(z.string().min(1).max(40)).max(30).optional(),
        priority: z.enum(PRIORITIES).nullable().optional().describe("high, medium or low; null clears it."),
      },
      annotations: WRITE,
    },
    safe(async ({ cardId, tags: tagNames, ...patch }) => {
      await assertCard(ctx.actor, cardId);
      const [card] = await db.select({ boardId: cards.boardId }).from(cards).where(eq(cards.id, cardId));
      if (!card) return fail("Card not found.");
      const tagIds = tagNames ? ((await tagIdsFor(card.boardId, tagNames)) ?? []) : undefined;
      await patchCardOp(cardId, { ...patch, ...(tagIds ? { tagIds } : {}) });
      ctx.onChange();
      return ok({ updated: cardId });
    }),
  );

  server.registerTool(
    "move_card",
    {
      title: "Move card",
      description: "Move a card to another column on the same board. Position 0 is the top; leave it out to put it last.",
      inputSchema: { cardId: uuid, columnId: uuid, position: z.number().int().min(0).optional() },
      annotations: WRITE,
    },
    safe(async ({ cardId, columnId, position }) => {
      await assertCard(ctx.actor, cardId);
      await assertColumn(ctx.actor, columnId);
      await moveCardOp(cardId, columnId, position ?? 1_000_000);
      ctx.onChange();
      return ok({ moved: cardId, to: columnId });
    }),
  );

  server.registerTool(
    "delete_card",
    {
      title: "Delete card",
      description: "Delete a card for everyone. This can't be undone.",
      inputSchema: { cardId: uuid },
      annotations: DESTRUCTIVE,
    },
    safe(async ({ cardId }) => {
      await assertCard(ctx.actor, cardId);
      if (!(await deleteCardOp(cardId))) return fail("Card not found.");
      ctx.onChange();
      return ok({ deleted: cardId });
    }),
  );

  server.registerTool(
    "create_board",
    {
      title: "Create board",
      description: "Create a board. Without columns it gets the standard three; the last column is treated as done.",
      inputSchema: { name: z.string().min(1).max(200), columns: z.array(z.string().min(1).max(200)).min(1).max(12).optional() },
      annotations: WRITE,
    },
    safe(async ({ name, columns: cols }) => {
      const boardId = await createBoardOp(ctx.actor, name, cols ?? ctx.starterColumns);
      ctx.onChange();
      return ok({ created: boardId });
    }),
  );

  server.registerTool(
    "add_column",
    {
      title: "Add column",
      description: "Add a column at the right end of a board.",
      inputSchema: { boardId: uuid, name: z.string().min(1).max(200) },
      annotations: WRITE,
    },
    safe(async ({ boardId, name }) => {
      await assertBoard(ctx.actor, boardId);
      const columnId = await addColumnOp(boardId, name);
      ctx.onChange();
      return ok({ created: columnId });
    }),
  );

  server.registerTool(
    "create_tag",
    {
      title: "Create tag",
      description: `Create a tag on a board (or recolor it if the name exists). Colors: ${TAG_COLORS.join(", ")}.`,
      inputSchema: { boardId: uuid, name: z.string().min(1).max(40), color: z.enum(TAG_COLORS) },
      annotations: WRITE,
    },
    safe(async (a) => {
      await assertBoard(ctx.actor, a.boardId);
      const tag = await createTagOp(a.boardId, { name: a.name, color: a.color });
      ctx.onChange();
      return ok({ tag: tag.id });
    }),
  );

  // ---------- Expenses ----------

  const expenseFilter = {
    from: date.optional().describe("First day to include, YYYY-MM-DD."),
    to: date.optional().describe("Last day to include, YYYY-MM-DD."),
    category: z.string().max(60).optional().describe("Only this category (case-insensitive)."),
    vendor: z.string().max(200).optional().describe("Only this vendor (case-insensitive)."),
  };

  server.registerTool(
    "list_expenses",
    {
      title: "List expenses",
      description:
        "Company expenses, oldest first, optionally filtered by date range, category or vendor. Amounts are whole KZT. `invoices` is how many invoice files are attached (0 means the invoice is missing).",
      inputSchema: expenseFilter,
      annotations: READ,
    },
    safe(async (f) => {
      const rows = await loadExpenses(f);
      return ok({
        count: rows.length,
        totalKzt: rows.reduce((s, r) => s + r.amount, 0),
        expenses: rows.map((r) => ({
          id: r.id,
          date: r.date,
          vendor: r.vendor,
          ...(r.description ? { description: r.description.slice(0, 300) } : {}),
          category: r.category,
          amountKzt: r.amount,
          invoices: r.invoices.length,
        })),
      });
    }),
  );

  server.registerTool(
    "expense_summary",
    {
      title: "Expense summary",
      description: "Totals for a period in KZT: overall, by category, by month, the top vendors, and how many expenses lack an invoice.",
      inputSchema: { from: expenseFilter.from, to: expenseFilter.to },
      annotations: READ,
    },
    safe(async (f) => {
      const rows = await loadExpenses(f);
      const group = (key: (r: (typeof rows)[number]) => string) => {
        const m = new Map<string, { amountKzt: number; count: number }>();
        for (const r of rows) {
          const g = m.get(key(r)) ?? { amountKzt: 0, count: 0 };
          g.amountKzt += r.amount;
          g.count += 1;
          m.set(key(r), g);
        }
        return [...m].map(([k, v]) => ({ key: k, ...v }));
      };
      const missing = rows.filter((r) => !r.invoices.length);
      return ok({
        count: rows.length,
        totalKzt: rows.reduce((s, r) => s + r.amount, 0),
        byCategory: group((r) => r.category).sort((a, b) => b.amountKzt - a.amountKzt).map(({ key, ...v }) => ({ category: key, ...v })),
        byMonth: group((r) => r.date.slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key)).map(({ key, ...v }) => ({ month: key, ...v })),
        topVendors: group((r) => r.vendor).sort((a, b) => b.amountKzt - a.amountKzt).slice(0, 10).map(({ key, ...v }) => ({ vendor: key, ...v })),
        missingInvoices: { count: missing.length, amountKzt: missing.reduce((s, r) => s + r.amount, 0) },
      });
    }),
  );

  server.registerTool(
    "add_expense",
    {
      title: "Add expense",
      description:
        "Record a company expense in whole KZT. Use an existing category when one fits (see list_expenses or expense_summary); a new name creates a new category. Invoice files can only be attached in the app.",
      inputSchema: {
        date,
        vendor: z.string().min(1).max(200),
        amountKzt: z.number().int().positive(),
        category: z.string().min(1).max(60),
        description: z.string().max(5000).optional(),
      },
      annotations: WRITE,
    },
    safe(async (a) => {
      const expenseId = await createExpenseOp(ctx.actor, { date: a.date, vendor: a.vendor, amount: a.amountKzt, category: a.category, description: a.description ?? "" });
      ctx.onChange();
      return ok({ created: expenseId });
    }),
  );

  server.registerTool(
    "update_expense",
    {
      title: "Update expense",
      description: "Change some fields of an expense; anything left out stays the same.",
      inputSchema: {
        expenseId: uuid,
        date: date.optional(),
        vendor: z.string().min(1).max(200).optional(),
        amountKzt: z.number().int().positive().optional(),
        category: z.string().min(1).max(60).optional(),
        description: z.string().max(5000).optional(),
      },
      annotations: WRITE,
    },
    safe(async ({ expenseId, amountKzt, ...rest }) => {
      if (!(await updateExpenseOp(expenseId, { ...rest, ...(amountKzt !== undefined ? { amount: amountKzt } : {}) }))) return fail("Expense not found.");
      ctx.onChange();
      return ok({ updated: expenseId });
    }),
  );

  server.registerTool(
    "delete_expense",
    {
      title: "Delete expense",
      description: "Delete an expense and its invoice files for everyone. This can't be undone.",
      inputSchema: { expenseId: uuid },
      annotations: DESTRUCTIVE,
    },
    safe(async ({ expenseId }) => {
      if (!(await deleteExpenseOp(expenseId))) return fail("Expense not found.");
      ctx.onChange();
      return ok({ deleted: expenseId });
    }),
  );

  return server;
}
