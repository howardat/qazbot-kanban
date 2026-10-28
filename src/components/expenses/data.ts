// Expenses: types, seed data and helpers. Data lives in memory on the page for now (no table yet).
import { printReport as openReport } from "./report";

export type Invoice = { name: string; url: string };
export type Currency = "KZT" | "USD";
export type Expense = {
  id: string;
  date: string; // YYYY-MM-DD
  vendor: string;
  description: string;
  category: string;
  amount: number; // in `currency`; USD may have cents
  currency: Currency;
  invoices: Invoice[];
};

/** Default USD→KZT rate for totals; the page lets you change it. */
export const DEFAULT_USD_KZT = 480;

export const CATEGORIES = ["Hardware", "Software", "Travel", "Office", "Marketing", "Services"] as const;
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const seed: [string, string, string, string, number, Currency, boolean][] = [
  ["2026-01-09", "Kaspi Magazin", "Jetson Orin dev kit", "Hardware", 1_250_000, "KZT", true],
  ["2026-01-15", "OpenRouter", "LLM credits", "Software", 200, "USD", true],
  ["2026-01-28", "Air Astana", "Flight to Shanghai (AgiBot)", "Travel", 410_000, "KZT", true],
  ["2026-02-03", "Technodom", "Monitors x2", "Office", 360_000, "KZT", false],
  ["2026-02-11", "Vercel", "Pro plan", "Software", 20, "USD", true],
  ["2026-02-20", "Instagram Ads", "Expo campaign", "Marketing", 150_000, "KZT", false],
  ["2026-03-05", "Sulpak", "Router + switches", "Hardware", 185_000, "KZT", true],
  ["2026-03-18", "Hilton Astana", "Hotel, client demo", "Travel", 210_000, "KZT", true],
  ["2026-03-29", "Supabase", "Team plan", "Software", 25, "USD", true],
  ["2026-04-07", "AgiBot", "X2 Ultra spare actuators", "Hardware", 6_040, "USD", true],
  ["2026-04-19", "Coworking Hub", "Desk rent April", "Office", 120_000, "KZT", true],
  ["2026-05-02", "Soniox", "STT usage", "Software", 93.4, "USD", false],
  ["2026-05-14", "PrintPro", "Expo banners", "Marketing", 88_000, "KZT", true],
  ["2026-05-27", "Yandex Go", "Taxi, robot transport", "Travel", 32_000, "KZT", false],
  ["2026-06-10", "Coworking Hub", "Desk rent June", "Office", 120_000, "KZT", true],
  ["2026-06-22", "Legal Partners", "Contract review", "Services", 300_000, "KZT", true],
  ["2026-07-08", "Kaspi Magazin", "Batteries", "Hardware", 76_000, "KZT", true],
  ["2026-07-30", "OpenRouter", "LLM credits", "Software", 230, "USD", true],
  ["2026-08-12", "Air Astana", "Almaty ↔ Astana", "Travel", 95_000, "KZT", false],
  ["2026-08-25", "Figma", "Seats", "Software", 75, "USD", true],
  ["2026-09-04", "Technodom", "Laptop", "Hardware", 890_000, "KZT", true],
  ["2026-09-21", "Accountant LLP", "Q3 bookkeeping", "Services", 180_000, "KZT", false],
  ["2026-10-03", "Coworking Hub", "Desk rent October", "Office", 120_000, "KZT", true],
  ["2026-10-16", "Meta Ads", "Hotel reception launch", "Marketing", 460, "USD", false],
  ["2026-10-24", "OpenRouter", "LLM credits", "Software", 220, "USD", true],
];

// A placeholder invoice so seeded rows have something to open.
const sampleInvoice = (vendor: string, date: string): Invoice => ({
  name: `invoice-${vendor.toLowerCase().replace(/\W+/g, "-")}-${date}.pdf`,
  url: `data:text/plain;charset=utf-8,${encodeURIComponent(`Sample invoice\n${vendor}\n${date}`)}`,
});

export const SEED_EXPENSES: Expense[] = seed.map(([date, vendor, description, category, amount, currency, hasInvoice], i) => ({
  id: `e${i + 1}`,
  date,
  vendor,
  description,
  category,
  amount,
  currency,
  invoices: hasInvoice ? [sampleInvoice(vendor, date)] : [],
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

/** An expense's value in tenge; totals, charts and reports all add up in KZT. */
export const toKzt = (e: Pick<Expense, "amount" | "currency">, rate: number) => (e.currency === "USD" ? e.amount * rate : e.amount);
export const sumKzt = (rows: Expense[], rate: number) => rows.reduce((s, r) => s + toKzt(r, rate), 0);

export const kzt = (v: number) => `${new Intl.NumberFormat("ru-RU").format(Math.round(v))} ₸`;
export const usd = (v: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
/** An amount in its own currency: "1 250 000 ₸" or "$1,250.00". */
export const money = (v: number, c: Currency) => (c === "USD" ? usd(v) : kzt(v));
export const CURRENCY_SIGN: Record<Currency, string> = { KZT: "₸", USD: "$" };
/** Parses typed amount text: digits for ₸, digits plus up to two decimals for $ (commas are thousands separators). */
export function parseAmount(text: string, c: Currency) {
  if (c === "KZT") return text.replace(/\D/g, "");
  const [int = "", ...rest] = text.replace(/[^\d.]/g, "").split(".");
  return rest.length ? `${int}.${rest.join("").slice(0, 2)}` : int;
}
export const todayISO = () => new Date().toISOString().slice(0, 10);

export const filesToInvoices = (files: FileList | File[]) =>
  Array.from(files).map((f) => ({ name: f.name, url: URL.createObjectURL(f) }));

/** CSV with a UTF-8 BOM so Excel opens it with Cyrillic intact; each row keeps its own currency plus a KZT column. */
export function exportCsv(rows: Expense[], title: string, rate: number) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [
    ["Date", "Vendor", "Description", "Category", "Amount", "Currency", `Amount (KZT, 1 USD = ${rate} KZT)`, "Invoices"].map(esc).join(";"),
    ...rows.map((r) =>
      [r.date, r.vendor, r.description, r.category, r.amount, r.currency, Math.round(toKzt(r, rate)), r.invoices.map((i) => i.name).join(", ")].map(esc).join(";"),
    ),
    ["", "", "", "Total", "", "", Math.round(sumKzt(rows, rate)), ""].map(esc).join(";"),
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `expenses-${title.replace(/\s+/g, "-").toLowerCase()}.csv`;
  a.click();
}

/** Printable A4 report (see report.ts), totals in KZT. Category colours follow the page's slot order. */
export function printReport(rows: Expense[], title: string, rate: number, categories?: string[]) {
  const reportRows = rows.map((r) => ({ ...r, amount: toKzt(r, rate), original: r.currency === "USD" ? usd(r.amount) : undefined }));
  openReport(reportRows, title, { categories: categories ?? categoriesOf(rows), rateNote: rows.some((r) => r.currency === "USD") ? `1 $ = ${rate} ₸` : undefined });
}

/** What the views get from the page's in-memory store. */
export type ExpenseStore = {
  expenses: Expense[];
  add: (e: Omit<Expense, "id">) => string;
  update: (id: string, patch: Partial<Expense>) => void;
  remove: (id: string) => void;
  attach: (id: string, files: FileList | File[]) => void;
};
