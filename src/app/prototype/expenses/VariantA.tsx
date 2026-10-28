"use client";

// PROTOTYPE — Variant A: spreadsheet. Dense inline-editable table, new row pinned at the bottom,
// month/quarter/year stepper on top, rows banded by month with subtotals.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, FileDown, FileSpreadsheet, Paperclip, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/atoms";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CATEGORIES, exportCsv, kzt, periodLabel, periodOf, printReport, shiftPeriod, sum, todayISO,
  type Expense, type Granularity, type VariantProps,
} from "./mock";

type Mode = Granularity | "custom";

const cell = "h-8 w-full rounded-sm bg-transparent px-2 outline-none hover:bg-muted/60 focus:bg-card focus:ring-2 focus:ring-ring/40";

export function VariantA({ expenses, add, update, remove, attach, onView }: VariantProps) {
  const [mode, setMode] = useState<Mode>("quarter");
  const [period, setPeriod] = useState(periodOf(todayISO(), "quarter"));
  const [from, setFrom] = useState("2026-01-01");
  const [to, setTo] = useState(todayISO());
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");

  const setGranularity = (m: Mode) => {
    setMode(m);
    if (m !== "custom") setPeriod(periodOf(todayISO(), m));
  };

  const label = mode === "custom" ? `${from} → ${to}` : periodLabel(period);
  const rows = useMemo(
    () =>
      expenses
        .filter((e) => (mode === "custom" ? e.date >= from && e.date <= to : periodOf(e.date, mode) === period))
        .filter((e) => !category || e.category === category)
        .filter((e) => !q || `${e.vendor} ${e.description}`.toLowerCase().includes(q.toLowerCase()))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [expenses, mode, period, from, to, category, q],
  );
  useEffect(() => onView(`A · ${label}`, rows), [rows, label, onView]);

  const byMonth = useMemo(() => {
    const m = new Map<string, Expense[]>();
    for (const r of rows) m.set(r.date.slice(0, 7), [...(m.get(r.date.slice(0, 7)) ?? []), r]);
    return [...m];
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Spreadsheet view — edit any cell in place, add rows at the bottom."
        actions={
          <>
            <Button variant="outline" onClick={() => exportCsv(rows, label)}>
              <FileSpreadsheet /> Excel
            </Button>
            <Button variant="outline" onClick={() => printReport(rows, label)}>
              <FileDown /> PDF
            </Button>
          </>
        }
      >
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 px-4 pb-3 md:px-6">
          <div className="flex rounded-md border bg-muted/50 p-0.5 text-sm">
            {(["month", "quarter", "year", "custom"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setGranularity(m)}
                className={cn("h-7 rounded px-3 capitalize text-muted-foreground", mode === m && "bg-card font-medium text-foreground shadow-xs")}
              >
                {m}
              </button>
            ))}
          </div>
          {mode === "custom" ? (
            <div className="flex items-center gap-1 text-sm">
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-8 rounded-md border bg-card px-2" />
              <span className="text-muted-foreground">→</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-8 rounded-md border bg-card px-2" />
            </div>
          ) : (
            <div className="flex items-center rounded-md border bg-card">
              <Button variant="ghost" size="icon-sm" onClick={() => setPeriod((p) => shiftPeriod(p, mode, -1))} aria-label="Previous period">
                <ChevronLeft />
              </Button>
              <span className="min-w-24 text-center text-sm font-medium tabular-nums">{periodLabel(period)}</span>
              <Button variant="ghost" size="icon-sm" onClick={() => setPeriod((p) => shiftPeriod(p, mode, 1))} aria-label="Next period">
                <ChevronRight />
              </Button>
            </div>
          )}
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-8 rounded-md border bg-card px-2 text-sm">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <label className="flex h-8 items-center gap-1.5 rounded-md border bg-card px-2 text-sm text-muted-foreground">
            <Search className="size-3.5" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search vendor or note" className="w-44 bg-transparent text-foreground outline-none" />
          </label>
          <span className="ml-auto text-sm text-muted-foreground">
            {rows.length} rows · <span className="font-semibold text-foreground tabular-nums">{kzt(sum(rows))}</span>
          </span>
        </div>
      </PageHeader>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-muted text-left text-xs text-muted-foreground">
            <tr className="[&>th]:h-8 [&>th]:border-b [&>th]:px-2 [&>th]:font-medium">
              <th className="w-36 pl-4 md:pl-6">Date</th>
              <th className="w-48">Vendor</th>
              <th>Description</th>
              <th className="w-36">Category</th>
              <th className="w-40 text-right">Amount, ₸</th>
              <th className="w-24">Invoice</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {byMonth.map(([month, list]) => (
              <Fragment key={month}>
                <tr className="bg-muted/40 text-xs">
                  <td colSpan={4} className="h-7 border-b pl-4 font-medium md:pl-6">{periodLabel(month)}</td>
                  <td className="border-b px-2 text-right font-semibold tabular-nums">{kzt(sum(list))}</td>
                  <td colSpan={2} className="border-b" />
                </tr>
                {list.map((r) => (
                  <Row key={r.id} r={r} update={update} remove={remove} attach={attach} />
                ))}
              </Fragment>
            ))}
            <NewRow add={add} defaultDate={rows.at(-1)?.date ?? todayISO()} />
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 text-center text-muted-foreground">No expenses in {label}.</td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="bg-muted text-sm font-semibold">
              <td colSpan={4} className="h-9 border-t pl-4 md:pl-6">Total · {label}</td>
              <td className="border-t px-2 text-right tabular-nums">{kzt(sum(rows))}</td>
              <td colSpan={2} className="border-t" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function Row({ r, update, remove, attach }: { r: Expense } & Pick<VariantProps, "update" | "remove" | "attach">) {
  const file = useRef<HTMLInputElement>(null);
  return (
    <tr className="group border-b [&>td]:px-1">
      <td className="pl-3 md:pl-5">
        <input type="date" value={r.date} onChange={(e) => update(r.id, { date: e.target.value })} className={cell} />
      </td>
      <td>
        <input value={r.vendor} onChange={(e) => update(r.id, { vendor: e.target.value })} className={cell} />
      </td>
      <td>
        <input value={r.description} onChange={(e) => update(r.id, { description: e.target.value })} className={cell} />
      </td>
      <td>
        <select value={r.category} onChange={(e) => update(r.id, { category: e.target.value })} className={cell}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </td>
      <td>
        <input
          inputMode="numeric"
          value={r.amount}
          onChange={(e) => update(r.id, { amount: Number(e.target.value.replace(/\D/g, "")) || 0 })}
          className={cn(cell, "text-right tabular-nums")}
        />
      </td>
      <td>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => file.current?.click()}
            title="Attach invoice"
            className={cn(
              "flex h-7 items-center gap-1 rounded-md px-1.5 text-xs",
              r.invoices.length ? "text-foreground hover:bg-muted" : "text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950",
            )}
          >
            <Paperclip className="size-3.5" />
            {r.invoices.length || "add"}
          </button>
          {r.invoices[0] && (
            <a href={r.invoices[0].url} target="_blank" rel="noreferrer" className="truncate text-xs text-sky-600 hover:underline" title={r.invoices.map((i) => i.name).join("\n")}>
              open
            </a>
          )}
          <input ref={file} type="file" multiple hidden onChange={(e) => e.target.files && attach(r.id, e.target.files)} />
        </div>
      </td>
      <td>
        <Button variant="ghost" size="icon-xs" onClick={() => remove(r.id)} className="opacity-0 group-hover:opacity-100" aria-label="Delete row">
          <Trash2 />
        </Button>
      </td>
    </tr>
  );
}

function NewRow({ add, defaultDate }: { add: VariantProps["add"]; defaultDate: string }) {
  const blank = { vendor: "", description: "", category: CATEGORIES[0] as string, amount: "" };
  const [d, setD] = useState(blank);
  const [date, setDate] = useState(defaultDate);
  const first = useRef<HTMLInputElement>(null);
  const commit = () => {
    if (!d.vendor || !d.amount) return;
    add({ date, vendor: d.vendor, description: d.description, category: d.category, amount: Number(d.amount), invoices: [] });
    setD(blank);
    first.current?.focus();
  };
  const onKey = (e: React.KeyboardEvent) => e.key === "Enter" && commit();
  return (
    <tr className="border-b bg-sky-50/40 dark:bg-sky-950/20 [&>td]:px-1" onKeyDown={onKey}>
      <td className="pl-3 md:pl-5">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={cell} />
      </td>
      <td>
        <input ref={first} value={d.vendor} onChange={(e) => setD({ ...d, vendor: e.target.value })} placeholder="+ New expense: vendor" className={cell} />
      </td>
      <td>
        <input value={d.description} onChange={(e) => setD({ ...d, description: e.target.value })} placeholder="What for" className={cell} />
      </td>
      <td>
        <select value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} className={cell}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </td>
      <td>
        <input inputMode="numeric" value={d.amount} onChange={(e) => setD({ ...d, amount: e.target.value.replace(/\D/g, "") })} placeholder="0" className={cn(cell, "text-right tabular-nums")} />
      </td>
      <td colSpan={2} className="text-xs text-muted-foreground">
        <button type="button" onClick={commit} className="rounded px-1.5 py-1 hover:bg-muted">↵ Enter to add</button>
      </td>
    </tr>
  );
}
