// PROTOTYPE — throwaway. Mock data and helpers for the expenses page variants. No persistence.
import { printReport as openReport } from "./report";

export type Invoice = { name: string; url: string };
export type Expense = {
  id: string;
  date: string; // YYYY-MM-DD
  vendor: string;
  description: string;
  category: string;
  amount: number; // KZT
  invoices: Invoice[];
};

export const CATEGORIES = ["Hardware", "Software", "Travel", "Office", "Marketing", "Services"] as const;
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type Granularity = "month" | "quarter" | "year";

const seed: [string, string, string, string, number, boolean][] = [
  ["2026-01-09", "Kaspi Magazin", "Jetson Orin dev kit", "Hardware", 1_250_000, true],
  ["2026-01-15", "OpenRouter", "LLM credits", "Software", 98_000, true],
  ["2026-01-28", "Air Astana", "Flight to Shanghai (AgiBot)", "Travel", 410_000, true],
  ["2026-02-03", "Technodom", "Monitors x2", "Office", 360_000, false],
  ["2026-02-11", "Vercel", "Pro plan", "Software", 24_000, true],
  ["2026-02-20", "Instagram Ads", "Expo campaign", "Marketing", 150_000, false],
  ["2026-03-05", "Sulpak", "Router + switches", "Hardware", 185_000, true],
  ["2026-03-18", "Hilton Astana", "Hotel, client demo", "Travel", 210_000, true],
  ["2026-03-29", "Supabase", "Team plan", "Software", 12_500, true],
  ["2026-04-07", "AgiBot", "X2 Ultra spare actuators", "Hardware", 2_900_000, true],
  ["2026-04-19", "Coworking Hub", "Desk rent April", "Office", 120_000, true],
  ["2026-05-02", "Soniox", "STT usage", "Software", 45_000, false],
  ["2026-05-14", "PrintPro", "Expo banners", "Marketing", 88_000, true],
  ["2026-05-27", "Yandex Go", "Taxi, robot transport", "Travel", 32_000, false],
  ["2026-06-10", "Coworking Hub", "Desk rent June", "Office", 120_000, true],
  ["2026-06-22", "Legal Partners", "Contract review", "Services", 300_000, true],
  ["2026-07-08", "Kaspi Magazin", "Batteries", "Hardware", 76_000, true],
  ["2026-07-30", "OpenRouter", "LLM credits", "Software", 110_000, true],
  ["2026-08-12", "Air Astana", "Almaty ↔ Astana", "Travel", 95_000, false],
  ["2026-08-25", "Figma", "Seats", "Software", 36_000, true],
  ["2026-09-04", "Technodom", "Laptop", "Hardware", 890_000, true],
  ["2026-09-21", "Accountant LLP", "Q3 bookkeeping", "Services", 180_000, false],
  ["2026-10-03", "Coworking Hub", "Desk rent October", "Office", 120_000, true],
  ["2026-10-16", "Meta Ads", "Hotel reception launch", "Marketing", 220_000, false],
  ["2026-10-24", "OpenRouter", "LLM credits", "Software", 105_000, true],
];

// A tiny placeholder "invoice" so mock rows have something to open.
const fakeInvoice = (vendor: string, date: string): Invoice => ({
  name: `invoice-${vendor.toLowerCase().replace(/\W+/g, "-")}-${date}.pdf`,
  url: `data:text/plain;charset=utf-8,${encodeURIComponent(`PROTOTYPE invoice\n${vendor}\n${date}`)}`,
});

export const MOCK_EXPENSES: Expense[] = seed.map(([date, vendor, description, category, amount, hasInvoice], i) => ({
  id: `e${i + 1}`,
  date,
  vendor,
  description,
  category,
  amount,
  invoices: hasInvoice ? [fakeInvoice(vendor, date)] : [],
}));

const uniqSorted = (xs: string[]) => [...new Set(xs.map((x) => x.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
/** Every vendor used so far, A→Z. New vendors are "saved" simply by being on an expense. */
export const vendorsOf = (xs: Expense[]) => uniqSorted(xs.map((x) => x.vendor));
/**
 * Category tags: the starter set, then custom ones in the order they were first used. The order is fixed so
 * a category's colour (its slot) never changes when filters or new categories come and go.
 */
export const categoriesOf = (xs: Expense[]) => [...new Set([...CATEGORIES, ...xs.map((x) => x.category.trim()).filter(Boolean)])];

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

let n = 1000;
export const newId = () => `e${++n}`;

export const quarterOf = (date: string) => Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1;

/** Period key for a date: "2026-03", "2026-Q1" or "2026". */
export function periodOf(date: string, g: Granularity) {
  if (g === "month") return date.slice(0, 7);
  if (g === "quarter") return `${date.slice(0, 4)}-Q${quarterOf(date)}`;
  return date.slice(0, 4);
}

export function periodLabel(key: string) {
  if (/^\d{4}-Q\d$/.test(key)) return `${key.slice(5)} ${key.slice(0, 4)}`;
  if (/^\d{4}-\d{2}$/.test(key)) return `${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`;
  return key;
}

/** Step a period key by n periods of its own granularity. */
export function shiftPeriod(key: string, g: Granularity, step: number) {
  const y = Number(key.slice(0, 4));
  if (g === "year") return String(y + step);
  if (g === "quarter") {
    const idx = y * 4 + Number(key.slice(6)) - 1 + step;
    return `${Math.floor(idx / 4)}-Q${(idx % 4) + 1}`;
  }
  const idx = y * 12 + Number(key.slice(5)) - 1 + step;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, "0")}`;
}

export const sum = (rows: Expense[]) => rows.reduce((s, r) => s + r.amount, 0);
export const kzt = (v: number) => `${new Intl.NumberFormat("ru-RU").format(Math.round(v))} ₸`;
export const todayISO = () => new Date().toISOString().slice(0, 10);

export const filesToInvoices = (files: FileList | File[]) =>
  Array.from(files).map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));

/** CSV with a UTF-8 BOM so Excel opens it with Cyrillic intact. Prototype stand-in for a real .xlsx. */
export function exportCsv(rows: Expense[], title: string) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    ["Date", "Vendor", "Description", "Category", "Amount (KZT)", "Invoices"].map(esc).join(";"),
    ...rows.map((r) => [r.date, r.vendor, r.description, r.category, r.amount, r.invoices.map((i) => i.name).join(", ")].map(esc).join(";")),
    ["", "", "", "Total", sum(rows), ""].map(esc).join(";"),
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `expenses-${title.replace(/\s+/g, "-").toLowerCase()}.csv`;
  a.click();
}

/** Printable A4 report (see report.ts). Category colours follow the page's slot order. */
export function printReport(rows: Expense[], title: string, categories?: string[]) {
  openReport(rows, title, { categories: categories ?? categoriesOf(rows) });
}

/** Props every variant gets from the shared in-memory store. */
export type VariantProps = {
  expenses: Expense[];
  add: (e: Omit<Expense, "id">) => string;
  update: (id: string, patch: Partial<Expense>) => void;
  remove: (id: string) => void;
  attach: (id: string, files: FileList | File[]) => void;
  /** Variants report what they're showing so the state readout can display it. */
  onView: (label: string, rows: Expense[]) => void;
};
