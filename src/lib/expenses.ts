import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, eq, gte, ilike, inArray, lte } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { expenseInvoices, expenses } from "@/db/schema";
import { isoDate, type Actor } from "@/lib/board-ops";
import { MAX_INVOICE_MB } from "@/lib/invoice-files";
import { INVOICE_TYPES, invoiceExists, invoiceUploadToken, MAX_INVOICE_BYTES, removeInvoiceFiles } from "@/lib/storage";

// Expense reads and writes, shared by the server actions (signed-in UI) and the MCP tools (assistant and
// external agents). Callers authenticate first; these validate input. Amounts are whole tenge.

export const expenseInput = z.object({
  date: isoDate,
  vendor: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).default(""),
  category: z.string().trim().min(1).max(60),
  amount: z.number().int().positive().max(1e13),
});
export const expensePatch = expenseInput.partial();
export type ExpenseInput = z.input<typeof expenseInput>;

export type InvoiceOut = { id: string; name: string; url: string };
export type ExpenseOut = {
  id: string;
  date: string;
  vendor: string;
  description: string;
  category: string;
  amount: number;
  /** Profile id of whoever added it; null for expenses whose author has since left. */
  createdBy: string | null;
  invoices: InvoiceOut[];
};

/** Where the app serves an invoice: checks the viewer, then redirects to a short-lived Storage link. */
export const invoiceUrl = (id: string) => `/api/expenses/invoices/${id}`;

export type ExpenseFilter = { from?: string; to?: string; category?: string; vendor?: string };

/** Expenses oldest first, each with its invoices. */
export async function loadExpenses(filter: ExpenseFilter = {}): Promise<ExpenseOut[]> {
  const where = and(
    filter.from ? gte(expenses.date, filter.from) : undefined,
    filter.to ? lte(expenses.date, filter.to) : undefined,
    filter.category ? ilike(expenses.category, filter.category) : undefined,
    filter.vendor ? ilike(expenses.vendor, filter.vendor) : undefined,
  );
  const rows = await db.select().from(expenses).where(where).orderBy(asc(expenses.date), asc(expenses.createdAt));
  const files = rows.length
    ? await db.select().from(expenseInvoices).where(inArray(expenseInvoices.expenseId, rows.map((r) => r.id))).orderBy(asc(expenseInvoices.createdAt))
    : [];
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    vendor: r.vendor,
    description: r.description,
    category: r.category,
    amount: r.amount,
    createdBy: r.createdBy,
    invoices: files.filter((f) => f.expenseId === r.id).map((f) => ({ id: f.id, name: f.name, url: invoiceUrl(f.id) })),
  }));
}

export async function createExpenseOp(actor: Actor, input: ExpenseInput) {
  const values = expenseInput.parse(input);
  const [row] = await db.insert(expenses).values({ ...values, createdBy: actor.id }).returning({ id: expenses.id });
  return row.id;
}

export async function updateExpenseOp(id: string, patch: Partial<ExpenseInput>) {
  const values = expensePatch.parse(patch);
  const rows = await db.update(expenses).set({ ...values, updatedAt: new Date() }).where(eq(expenses.id, id)).returning({ id: expenses.id });
  return rows.length > 0;
}

/** Deletes the expense, its invoice rows (cascade) and their files. */
export async function deleteExpenseOp(id: string) {
  const files = await db.select({ path: expenseInvoices.path }).from(expenseInvoices).where(eq(expenseInvoices.expenseId, id));
  const rows = await db.delete(expenses).where(eq(expenses.id, id)).returning({ id: expenses.id });
  if (rows.length) await removeInvoiceFiles(files.map((f) => f.path));
  return rows.length > 0;
}

const fileMeta = z.object({
  name: z.string().trim().min(1).max(200),
  size: z.number().int().positive().max(MAX_INVOICE_BYTES, `Invoices can be up to ${MAX_INVOICE_MB} MB.`),
  contentType: z.enum(INVOICE_TYPES as [string, ...string[]], { message: "Invoices must be PDF or images." }),
});

/** Step 1 of an upload: a Storage path under the expense and a one-time token for the browser to upload to. */
export async function startInvoiceUploadOp(expenseId: string, file: z.input<typeof fileMeta>) {
  const meta = fileMeta.parse(file);
  const [exists] = await db.select({ id: expenses.id }).from(expenses).where(eq(expenses.id, expenseId));
  if (!exists) throw new Error("Expense not found.");
  const safe = meta.name.replace(/[^\w.\-]+/g, "_").slice(-80);
  return invoiceUploadToken(`${expenseId}/${randomUUID()}-${safe}`);
}

/** Step 2: once the browser has uploaded the file, record it on the expense. */
export async function finishInvoiceUploadOp(expenseId: string, path: string, file: z.input<typeof fileMeta>): Promise<InvoiceOut> {
  const meta = fileMeta.parse(file);
  if (!path.startsWith(`${expenseId}/`) || path.includes("..")) throw new Error("That file doesn't belong to this expense.");
  if (!(await invoiceExists(path))) throw new Error("The upload didn't finish. Try again.");
  const [row] = await db.insert(expenseInvoices).values({ expenseId, path, ...meta }).returning({ id: expenseInvoices.id });
  return { id: row.id, name: meta.name, url: invoiceUrl(row.id) };
}

export async function removeInvoiceOp(invoiceId: string) {
  const [row] = await db.delete(expenseInvoices).where(eq(expenseInvoices.id, invoiceId)).returning({ path: expenseInvoices.path });
  if (row) await removeInvoiceFiles([row.path]);
  return !!row;
}

export async function invoicePath(invoiceId: string) {
  const [row] = await db.select({ path: expenseInvoices.path }).from(expenseInvoices).where(eq(expenseInvoices.id, invoiceId));
  return row?.path ?? null;
}
