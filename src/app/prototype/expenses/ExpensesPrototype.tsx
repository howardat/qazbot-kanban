"use client";

// PROTOTYPE — throwaway. Holds the shared in-memory expense store and swaps variants by `?variant=`.
import { useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PrototypeSwitcher } from "@/components/PrototypeSwitcher";
import { filesToInvoices, kzt, MOCK_EXPENSES, newId, sum, type Expense, type VariantProps } from "./mock";
import { VariantA } from "./VariantA";
import { VariantB } from "./VariantB";
import { VariantC } from "./VariantC";

const VARIANTS = [
  { key: "A", name: "Spreadsheet" },
  { key: "B", name: "Period rail + side peek" },
  { key: "C", name: "Invoice-first dashboard" },
];

export function ExpensesPrototype() {
  const variant = useSearchParams().get("variant") ?? "A";
  const [expenses, setExpenses] = useState<Expense[]>(MOCK_EXPENSES);
  const [view, setView] = useState<{ label: string; count: number; total: number }>({ label: "—", count: 0, total: 0 });

  const add = useCallback((e: Omit<Expense, "id">) => {
    const id = newId();
    setExpenses((xs) => [...xs, { ...e, id }]);
    return id;
  }, []);
  const update = useCallback((id: string, patch: Partial<Expense>) => setExpenses((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x))), []);
  const remove = useCallback((id: string) => setExpenses((xs) => xs.filter((x) => x.id !== id)), []);
  const attach = useCallback(
    (id: string, files: FileList | File[]) => {
      const inv = filesToInvoices(files);
      setExpenses((xs) => xs.map((x) => (x.id === id ? { ...x, invoices: [...x.invoices, ...inv] } : x)));
    },
    [],
  );
  const onView = useCallback((label: string, rows: Expense[]) => setView({ label, count: rows.length, total: sum(rows) }), []);

  const props: VariantProps = { expenses, add, update, remove, attach, onView };
  const missing = expenses.filter((e) => e.invoices.length === 0).length;

  return (
    <div className="pb-24">
      {variant === "B" ? <VariantB {...props} /> : variant === "C" ? <VariantC {...props} /> : <VariantA {...props} />}
      {/* Prototype state readout: what the store holds and what the current variant is showing. */}
      <div className="fixed right-4 bottom-5 z-[100] rounded-md bg-zinc-900/90 px-3 py-2 font-mono text-[11px] leading-relaxed text-white/80 shadow-lg print:hidden">
        <div>store: {expenses.length} rows · {kzt(sum(expenses))} · {missing} w/o invoice</div>
        <div>view: {view.label} · {view.count} rows · {kzt(view.total)}</div>
      </div>
      <PrototypeSwitcher variants={VARIANTS} />
    </div>
  );
}
