// Expenses on the client: types matching what the server sends (src/lib/expenses.ts), and helpers for
// categories, colours, money and exports.
import { printReport as openReport, type ReportLabels } from "./report";

export type Invoice = { id: string; name: string; url: string };
export type Expense = {
  id: string;
  date: string; // YYYY-MM-DD
  vendor: string;
  description: string;
  category: string;
  amount: number; // KZT
  invoices: Invoice[];
};
export type NewExpense = Omit<Expense, "id" | "invoices">;

const uniqSorted = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
/** Every vendor used so far, A→Z. New vendors are "saved" simply by being on an expense. */
export const vendorsOf = (xs: Expense[]) => uniqSorted(xs.map((x) => x.vendor));
/**
 * Category tags: the starter set, then custom ones in the order they were first used. The order is fixed so
 * a category's colour (its slot) never changes when filters or new categories come and go.
 */
export const categoriesOf = (xs: Expense[], starter: string[]) => [...new Set([...starter, ...xs.map((x) => x.category.trim()).filter(Boolean)])];

/** Validated 8-slot categorical palette (dataviz default), stepped separately for dark mode. */
export const CAT_LIGHT = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"];
export const CAT_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
/** CSS colour for a category: its palette slot, or neutral grey past the 8th (those fold into "Other"). */
export const catColor = (name: string, categories: string[]) => {
  const i = categories.indexOf(name);
  return i >= 0 && i < 8 ? `var(--cat-${i + 1})` : "var(--cat-other)";
};
/** Inline CSS defining --cat-1..8 on :root for light and dark (so portalled popovers see them); render once on the page. */
export const CAT_VARS_CSS = `:root{${CAT_LIGHT.map((c, i) => `--cat-${i + 1}:${c}`).join(";")};--cat-other:#8a8a85}
@media (prefers-color-scheme: dark){:root{${CAT_DARK.map((c, i) => `--cat-${i + 1}:${c}`).join(";")};--cat-other:#77766f}}`;

export const sum = (rows: Expense[]) => rows.reduce((s, r) => s + r.amount, 0);
export const kzt = (v: number) => `${new Intl.NumberFormat("ru-RU").format(Math.round(v))} ₸`;
export const todayISO = () => new Date().toISOString().slice(0, 10);

/** Invoice links are app routes; reports and exports need them absolute so they work outside the page. */
const absolute = (url: string) => new URL(url, window.location.origin).href;

/** CSV with a UTF-8 BOM so Excel opens it with Cyrillic intact. Headers follow the viewer's language. */
export function exportCsv(rows: Expense[], title: string, cols: Record<"date" | "vendor" | "description" | "category" | "amount" | "invoice", string>, total: string) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    [cols.date, cols.vendor, cols.description, cols.category, `${cols.amount} (KZT)`, cols.invoice].map(esc).join(";"),
    ...rows.map((r) => [r.date, r.vendor, r.description, r.category, r.amount, r.invoices.map((i) => absolute(i.url)).join(" ")].map(esc).join(";")),
    ["", "", "", total, sum(rows), ""].map(esc).join(";"),
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `expenses-${title.replace(/\s+/g, "-").toLowerCase()}.csv`;
  a.click();
}

/** Printable A4 report (see report.ts). Category colours follow the page's slot order. */
export function printReport(rows: Expense[], title: string, categories: string[], labels: ReportLabels) {
  const withLinks = rows.map((r) => ({ ...r, invoices: r.invoices.map((i) => ({ ...i, url: absolute(i.url) })) }));
  openReport(withLinks, title, { categories, labels });
}
