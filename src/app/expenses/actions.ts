"use server";

import { revalidatePath } from "next/cache";
import { track } from "@/lib/activity";
import { id } from "@/lib/board-ops";
import {
  createExpenseOp,
  deleteExpenseOp,
  finishInvoiceUploadOp,
  loadExpenses,
  removeInvoiceOp,
  startInvoiceUploadOp,
  updateExpenseOp,
  type ExpenseInput,
} from "@/lib/expenses";
import { requireUser } from "@/lib/session";

type FileMeta = { name: string; size: number; contentType: string };

export async function createExpense(input: ExpenseInput) {
  const user = await requireUser();
  await track(user.id, "expense.create");
  const expenseId = await createExpenseOp(user, input);
  revalidatePath("/expenses");
  return (await loadExpenses()).find((e) => e.id === expenseId)!;
}

export async function updateExpense(expenseId: string, patch: Partial<ExpenseInput>) {
  await requireUser();
  await updateExpenseOp(id.parse(expenseId), patch);
  revalidatePath("/expenses");
}

export async function deleteExpense(expenseId: string) {
  const user = await requireUser();
  await track(user.id, "expense.delete");
  await deleteExpenseOp(id.parse(expenseId));
  revalidatePath("/expenses");
}

export async function startInvoiceUpload(expenseId: string, file: FileMeta) {
  await requireUser();
  return startInvoiceUploadOp(id.parse(expenseId), file);
}

export async function finishInvoiceUpload(expenseId: string, path: string, file: FileMeta) {
  await requireUser();
  const invoice = await finishInvoiceUploadOp(id.parse(expenseId), path, file);
  revalidatePath("/expenses");
  return invoice;
}

export async function removeInvoice(invoiceId: string) {
  await requireUser();
  await removeInvoiceOp(id.parse(invoiceId));
  revalidatePath("/expenses");
}
