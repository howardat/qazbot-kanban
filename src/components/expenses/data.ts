// Expenses on the client: types matching what the server sends (src/lib/expenses.ts), and helpers for
// categories, colours, money and exports.
import { printReport as openReport, reportPeriod, ruDate, type ReportScope } from "./report";

export type Invoice = { id: string; name: string; url: string };
export type Expense = {
  id: string;
  date: string; // YYYY-MM-DD
  vendor: string;
  description: string;
  category: string;
  amount: number; // KZT
  createdBy: string | null; // profile id of whoever added it
  invoices: Invoice[];
};
export type NewExpense = Omit<Expense, "id" | "invoices" | "createdBy">;

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

/** CSV with a UTF-8 BOM so Excel opens it with Cyrillic intact. Always in Russian, like the PDF report: the
 * exact dates on top, then date, vendor, description, amount and invoice links, and the total. */
export function exportCsv(rows: Expense[], scope: ReportScope) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const lines = [
    [`Расходы ${reportPeriod(scope)}`],
    ...(scope.categories?.length ? [[`Категории: ${scope.categories.join(", ")}`]] : []),
    [],
    ["Дата", "Поставщик", "Описание", "Сумма, ₸", "Счёт"],
    ...sorted.map((r) => [ruDate(r.date), r.vendor, r.description, r.amount, r.invoices.map((i) => absolute(i.url)).join(" ")]),
    ["", "", "Итого", sum(sorted), ""],
  ].map((cells) => cells.map(esc).join(";"));
  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `rashody_${scope.from}_${scope.to}.csv`;
  a.click();
}

/** Printable A4 report in Russian (see report.ts), with invoice links made absolute. */
export function printReport(rows: Expense[], scope: ReportScope) {
  const withLinks = rows.map((r) => ({ ...r, invoices: r.invoices.map((i) => ({ ...i, url: absolute(i.url) })) }));
  openReport(withLinks, scope);
}
