"use client";

// The page's expense list, kept in sync with the server. Edits show at once and are saved shortly after
// (side-peek typing is batched per expense); invoice files go straight from the browser to Storage with a
// one-time upload token, then get recorded on the expense.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";
import { createExpense, deleteExpense, finishInvoiceUpload, removeInvoice, startInvoiceUpload, updateExpense } from "@/app/expenses/actions";
import { MAX_INVOICE_BYTES } from "@/lib/invoice-files";
import type { Expense, NewExpense } from "./data";

const SAVE_DELAY_MS = 500;

/** Drops fields that can't be saved yet (an emptied vendor while typing); they're sent once valid. */
const savable = (p: Partial<NewExpense>) =>
  Object.fromEntries(
    Object.entries(p).filter(([k, v]) => (k === "amount" ? Number(v) > 0 : k === "description" ? true : typeof v === "string" && v.trim() !== "")),
  ) as Partial<NewExpense>;

export function useExpenses(initial: Expense[], messages: { saveFailed: string; uploadFailed: (name: string) => string; fileTooBig: (name: string) => string }) {
  const [expenses, setExpenses] = useState(initial);
  const [uploading, setUploading] = useState<Record<string, number>>({});
  const queued = useRef(new Map<string, { patch: Partial<NewExpense>; timer: ReturnType<typeof setTimeout> }>());
  const bucket = useMemo(
    () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!).storage.from("invoices"),
    [],
  );
  const failed = useCallback(() => toast.error(messages.saveFailed), [messages.saveFailed]);

  const flush = useCallback(
    (id: string) => {
      const q = queued.current.get(id);
      if (!q) return;
      clearTimeout(q.timer);
      queued.current.delete(id);
      const patch = savable(q.patch);
      if (Object.keys(patch).length) updateExpense(id, patch).catch(failed);
    },
    [failed],
  );

  // Save anything still waiting when the page goes away.
  useEffect(() => {
    const pending = queued.current;
    return () => [...pending.keys()].forEach(flush);
  }, [flush]);

  const attach = useCallback(
    async (id: string, files: FileList | File[]) => {
      for (const file of Array.from(files)) {
        if (file.size > MAX_INVOICE_BYTES) {
          toast.error(messages.fileTooBig(file.name));
          continue;
        }
        setUploading((u) => ({ ...u, [id]: (u[id] ?? 0) + 1 }));
        try {
          const meta = { name: file.name, size: file.size, contentType: file.type || "application/octet-stream" };
          const { path, token } = await startInvoiceUpload(id, meta);
          const { error } = await bucket.uploadToSignedUrl(path, token, file, { contentType: meta.contentType });
          if (error) throw error;
          const invoice = await finishInvoiceUpload(id, path, meta);
          setExpenses((xs) => xs.map((x) => (x.id === id ? { ...x, invoices: [...x.invoices, invoice] } : x)));
        } catch {
          toast.error(messages.uploadFailed(file.name));
        } finally {
          setUploading((u) => ({ ...u, [id]: (u[id] ?? 1) - 1 }));
        }
      }
    },
    [bucket, messages],
  );

  const add = useCallback(
    async (input: NewExpense, files: File[] = []) => {
      try {
        const created = await createExpense(input);
        setExpenses((xs) => [...xs, created]);
        if (files.length) await attach(created.id, files);
        return created.id;
      } catch {
        failed();
        return null;
      }
    },
    [attach, failed],
  );

  const update = useCallback(
    (id: string, patch: Partial<NewExpense>) => {
      setExpenses((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
      const q = queued.current.get(id);
      if (q) clearTimeout(q.timer);
      queued.current.set(id, { patch: { ...q?.patch, ...patch }, timer: setTimeout(() => flush(id), SAVE_DELAY_MS) });
    },
    [flush],
  );

  const remove = useCallback(
    (id: string) => {
      const q = queued.current.get(id);
      if (q) clearTimeout(q.timer);
      queued.current.delete(id);
      setExpenses((xs) => xs.filter((x) => x.id !== id));
      deleteExpense(id).catch(failed);
    },
    [failed],
  );

  const detach = useCallback(
    (id: string, invoiceId: string) => {
      setExpenses((xs) => xs.map((x) => (x.id === id ? { ...x, invoices: x.invoices.filter((i) => i.id !== invoiceId) } : x)));
      removeInvoice(invoiceId).catch(failed);
    },
    [failed],
  );

  return { expenses, uploading, add, update, remove, attach, detach };
}

export type ExpenseStore = ReturnType<typeof useExpenses>;
