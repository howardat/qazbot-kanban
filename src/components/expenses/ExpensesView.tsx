"use client";

// The expenses page: a 12-month bar strip (with Q1–Q4 chips and the year) picks the period; the table below has
// date and category filters, sortable columns, Add record and Export; donuts split the spend by category and
// vendor.
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ChevronDown, FileDown, FileSpreadsheet, Paperclip, Plus, Receipt, X } from "lucide-react";
import { Panel } from "@/components/atoms";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { AddRecordDialog } from "./AddRecordDialog";
import { CategoryPill, ExpenseSheet } from "./ExpenseSheet";
import { CAT_VARS_CSS, catColor, categoriesOf, exportCsv, kzt, printReport, sum, todayISO, vendorsOf, type Expense } from "./data";
import { useExpenses } from "./useExpenses";

type SortKey = "date" | "vendor" | "description" | "category" | "invoice" | "amount";
const COLUMNS: { key: SortKey; className?: string }[] = [
  { key: "date", className: "w-24" },
  { key: "vendor" },
  { key: "description", className: "hidden md:table-cell" },
  { key: "category" },
  { key: "invoice", className: "w-20" },
  { key: "amount", className: "w-36 text-right" },
];

export function ExpensesView({ initial }: { initial: Expense[] }) {
  const t = useT();
  const tx = t.expenses;
  const store = useExpenses(initial, { saveFailed: tx.saveFailed, uploadFailed: tx.uploadFailed });
  const { expenses } = store;

  const [year, setYear] = useState(Number(todayISO().slice(0, 4)));
  const thisMonth = Number(todayISO().slice(5, 7)) - 1;
  const [range, setRange] = useState<[number, number]>([Math.floor(thisMonth / 3) * 3, Math.floor(thisMonth / 3) * 3 + 2]);
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // Table filters + sort. `custom` is a day-level date range that overrides the month range when set.
  const [cat, setCat] = useState("");
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: -1 });
  const vendors = useMemo(() => vendorsOf(expenses), [expenses]);
  const categories = useMemo(() => categoriesOf(expenses, tx.starterCategories), [expenses, tx.starterCategories]);
  // Vendor colour slots: ranked by all-time spend, not by the current filter, so colours hold while filtering.
  const vendorOrder = useMemo(() => {
    const spend = (v: string) => sum(expenses.filter((e) => e.vendor === v));
    return [...vendors].sort((a, b) => spend(b) - spend(a));
  }, [vendors, expenses]);

  const inYear = useMemo(() => expenses.filter((e) => Number(e.date.slice(0, 4)) === year), [expenses, year]);
  // Month i (0–11) of the chosen year as YYYY-MM; names come from the viewer's language.
  const ym = (i: number) => `${year}-${String(i + 1).padStart(2, "0")}`;
  const monthShort = (i: number) => t.fmt.monthShort(`${ym(i)}-01`);
  const monthly = Array.from({ length: 12 }, (_, i) => sum(inYear.filter((e) => Number(e.date.slice(5, 7)) - 1 === i)));
  const max = Math.max(1, ...monthly);
  // Everything in the chosen period: the category donut shows this, the table narrows it further.
  const inPeriod = useMemo(
    () =>
      custom
        ? expenses.filter((e) => e.date >= custom.from && e.date <= custom.to)
        : inYear.filter((e) => { const m = Number(e.date.slice(5, 7)) - 1; return m >= range[0] && m <= range[1]; }),
    [expenses, inYear, range, custom],
  );
  const rows = useMemo(() => {
    const value = (e: Expense, k: SortKey): string | number =>
      k === "amount" ? e.amount : k === "invoice" ? e.invoices.length : k === "date" ? e.date : e[k].toLowerCase();
    return inPeriod
      .filter((e) => !cat || e.category === cat)
      .sort((a, b) => {
        const x = value(a, sort.key), y = value(b, sort.key);
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir || b.date.localeCompare(a.date);
      });
  }, [inPeriod, cat, sort]);

  const qOf = !custom && range[1] - range[0] === 2 && range[0] % 3 === 0 ? range[0] / 3 + 1 : null;
  const rangeLabel = (a: number, b: number) =>
    a === 0 && b === 11 ? tx.yearOf(year) : a === b ? t.fmt.month(ym(a)) : a % 3 === 0 && b - a === 2 ? tx.quarter(a / 3 + 1, year) : `${monthShort(a)}–${monthShort(b)} ${year}`;
  const label = custom ? `${custom.from.split("-").reverse().join(".")} – ${custom.to.split("-").reverse().join(".")}` : rangeLabel(range[0], range[1]);
  const reportTitle = [label, cat].filter(Boolean).join(" · ");

  const pickRange = (r: [number, number]) => (setRange(r), setCustom(null));
  const clickMonth = (i: number, shift: boolean) => (setRange(([a]) => (shift ? [Math.min(a, i), Math.max(a, i)] : [i, i])), setCustom(null));
  // Date filter options: whole year, quarters, months, plus the current strip selection if it's an odd range.
  const presets: [string, [number, number]][] = [
    [tx.yearOf(year), [0, 11]],
    ...[0, 1, 2, 3].map((qi): [string, [number, number]] => [tx.quarter(qi + 1, year), [qi * 3, qi * 3 + 2]]),
    ...Array.from({ length: 12 }, (_, i): [string, [number, number]] => [t.fmt.month(ym(i)), [i, i]]),
  ];
  const rangeKey = `${range[0]}-${range[1]}`;
  const onDateFilter = (v: string) => {
    if (v !== "custom") return pickRange(v.split("-").map(Number) as [number, number]);
    const lastDay = new Date(Date.UTC(year, range[1] + 1, 0)).toISOString().slice(0, 10);
    setCustom({ from: `${year}-${String(range[0] + 1).padStart(2, "0")}-01`, to: lastDay });
  };
  const monthOn = (i: number) => {
    if (!custom) return i >= range[0] && i <= range[1];
    return ym(i) >= custom.from.slice(0, 7) && ym(i) <= custom.to.slice(0, 7);
  };
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "amount" || key === "date" ? -1 : 1 }));
  const select = "h-8 rounded-md border bg-card px-2 text-sm";
  const exportExcel = () => exportCsv(rows, reportTitle, tx.cols, tx.total);
  const exportPdf = () => printReport(rows, reportTitle, categories, { lang: t.locale, ...tx.report, cols: tx.cols });

  return (
    <div className="space-y-4 p-4 md:p-6">
      <style>{CAT_VARS_CSS}</style>
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-auto text-xl font-semibold">
          {tx.title} · {label}
        </h1>
      </div>

      <section className="rounded-lg border bg-card p-3 shadow-xs">
        <div className="mb-2 flex items-center gap-1 text-sm">
          {[1, 2, 3, 4].map((qn) => (
            <button
              key={qn}
              type="button"
              onClick={() => pickRange([(qn - 1) * 3, (qn - 1) * 3 + 2])}
              className={cn("h-7 rounded-full border px-3 text-muted-foreground hover:bg-muted", qOf === qn && "border-foreground bg-foreground text-background hover:bg-foreground")}
            >
              {tx.quarterShort(qn)}
            </button>
          ))}
          <button type="button" onClick={() => pickRange([0, 11])} className={cn("h-7 rounded-full border px-3 text-muted-foreground hover:bg-muted", !custom && range[0] === 0 && range[1] === 11 && "border-foreground bg-foreground text-background hover:bg-foreground")}>
            {tx.year}
          </button>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="ml-1 h-7 rounded-full border bg-card px-2.5 text-sm" aria-label={tx.year}>
            {[2025, 2026, 2027].map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
          <span className="ml-auto text-xs text-muted-foreground">{tx.monthHint}</span>
        </div>
        <div className="grid grid-cols-12 items-end gap-1.5">
          {monthly.map((v, i) => {
            const on = monthOn(i);
            return (
              <button key={i} type="button" onClick={(e) => clickMonth(i, e.shiftKey)} className="group flex flex-col items-center gap-1" title={kzt(v)}>
                <span className="text-[10px] text-muted-foreground tabular-nums opacity-0 group-hover:opacity-100">{v ? `${Math.round(v / 1000)}k` : ""}</span>
                <div className="flex h-24 w-full items-end rounded-sm bg-muted/50">
                  <div className={cn("w-full rounded-t-[4px] transition-colors", on ? "bg-sky-500" : "bg-zinc-300 group-hover:bg-zinc-400 dark:bg-zinc-700")} style={{ height: `${(v / max) * 100}%`, minHeight: v ? 3 : 0 }} />
                </div>
                <span className={cn("text-xs", on ? "font-medium text-foreground" : "text-muted-foreground")}>{monthShort(i)}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-3">
          {/* Toolbar above the table: filters on the left, actions on the right */}
          <div className="flex flex-wrap items-center gap-2">
            <select value={custom ? "custom" : rangeKey} onChange={(e) => onDateFilter(e.target.value)} className={select} aria-label={tx.dateFilter}>
              {!presets.some(([, r]) => `${r[0]}-${r[1]}` === rangeKey) && <option value={rangeKey}>{rangeLabel(range[0], range[1])}</option>}
              {presets.map(([l, r]) => (
                <option key={l} value={`${r[0]}-${r[1]}`}>
                  {l}
                </option>
              ))}
              <option value="custom">{tx.customRange}</option>
            </select>
            {custom && (
              <span className="flex items-center gap-1 text-sm">
                <input type="date" value={custom.from} max={custom.to} onChange={(e) => e.target.value && setCustom({ ...custom, from: e.target.value })} className={select} />
                <span className="text-muted-foreground">–</span>
                <input type="date" value={custom.to} min={custom.from} onChange={(e) => e.target.value && setCustom({ ...custom, to: e.target.value })} className={select} />
              </span>
            )}
            <select value={cat} aria-label={tx.category} onChange={(e) => setCat(e.target.value)} className={select}>
              <option value="">{tx.allCategories}</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            {cat && (
              <Button variant="ghost" size="sm" onClick={() => setCat("")}>
                <X /> {tx.clear}
              </Button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" onClick={() => setAdding(true)}>
                <Plus /> {tx.addRecord}
              </Button>
              <div className="flex">
                <Button className="rounded-r-none" onClick={exportExcel}>
                  <FileSpreadsheet /> {tx.exportReport}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button className="rounded-l-none border-l border-white/20 px-2" aria-label={tx.moreFormats}>
                      <ChevronDown />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={exportExcel}>
                      <FileSpreadsheet /> {tx.excel}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={exportPdf}>
                      <FileDown /> {tx.pdf}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
          <Panel
            icon={<Receipt />}
            title={cat ? tx.countOf(rows.length, inPeriod.length) : tx.count(rows.length)}
            action={<span className="font-semibold text-foreground tabular-nums">{kzt(sum(rows))}</span>}
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    {COLUMNS.map((c) => (
                      <th key={c.key} className={cn("h-8 px-4 font-medium", c.className)}>
                        <button type="button" onClick={() => toggleSort(c.key)} className={cn("inline-flex items-center gap-1 hover:text-foreground", sort.key === c.key && "text-foreground")}>
                          {tx.cols[c.key]}
                          {sort.key === c.key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.id} onClick={() => setOpenId(r.id)} className="cursor-pointer hover:bg-muted/40 [&>td]:px-4 [&>td]:py-2">
                      <td className="text-muted-foreground tabular-nums">{r.date.slice(5)}</td>
                      <td className="font-medium">{r.vendor}</td>
                      <td className="hidden max-w-72 truncate text-muted-foreground md:table-cell">{r.description}</td>
                      <td>
                        <CategoryPill name={r.category} categories={categories} />
                      </td>
                      <td>
                        {r.invoices[0] ? (
                          <a href={r.invoices[0].url} target="_blank" rel="noreferrer" title={r.invoices[0].name} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                            <Paperclip className="size-3.5" /> {r.invoices.length}
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600">
                            <AlertTriangle className="size-3.5" /> {tx.none}
                          </span>
                        )}
                      </td>
                      <td className="text-right font-medium tabular-nums">{kzt(r.amount)}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={COLUMNS.length} className="py-10 text-center text-muted-foreground">
                        {cat ? tx.emptyCategory(cat, label) : tx.empty(label)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <aside className="space-y-4">
          <Donut title={tx.byCategory} rows={inPeriod} keyOf={(e) => e.category} order={categories} active={cat} onPick={(c) => setCat((x) => (x === c ? "" : c))} />
          <Donut title={cat ? tx.byVendorIn(cat) : tx.byVendor} rows={rows} keyOf={(e) => e.vendor} order={vendorOrder} />
        </aside>
      </div>

      <AddRecordDialog open={adding} onOpenChange={setAdding} onAdd={store.add} vendors={vendors} categories={categories} defaultCategory={cat || categories[0]} />

      <ExpenseSheet
        expense={expenses.find((e) => e.id === openId)}
        onClose={() => setOpenId(null)}
        vendors={vendors}
        categories={categories}
        uploading={openId ? (store.uploading[openId] ?? 0) > 0 : false}
        update={store.update}
        attach={store.attach}
        detach={store.detach}
        remove={store.remove}
      />
    </div>
  );
}

/**
 * Spend split by some key (category, vendor) as a donut. Hover a slice for its share; with `onPick`,
 * clicking a slice or legend row filters the table. Colour comes from the key's slot in `order`; past 8 slots
 * the extras fold into one "Other" slice.
 */
function Donut({
  title,
  rows,
  keyOf,
  order,
  active = "",
  onPick,
}: { title: string; rows: Expense[]; keyOf: (e: Expense) => string; order: string[]; active?: string; onPick?: (k: string) => void }) {
  const tx = useT().expenses;
  const [hover, setHover] = useState<string | null>(null);
  const total = sum(rows);
  const byKey = order.map((c) => ({ c, v: sum(rows.filter((r) => keyOf(r) === c)) })).filter((x) => x.v);
  const main = byKey.filter((x) => order.indexOf(x.c) < 8);
  const otherV = sum(rows.filter((r) => order.indexOf(keyOf(r)) >= 8 || order.indexOf(keyOf(r)) < 0));
  const OTHER = "\u0000other"; // can't clash with a real name
  const slices = [...main.sort((a, b) => b.v - a.v), ...(otherV ? [{ c: OTHER, v: otherV }] : [])];
  const color = (c: string) => (c === OTHER ? "var(--cat-other)" : catColor(c, order));
  const pick = (c: string) => onPick && c !== OTHER && onPick(c);
  const name = (c: string) => (c === OTHER ? tx.other : c);

  const R = 84, r = 56, C = 96;
  const pt = (a: number, rad: number) => [C + rad * Math.sin(a), C - rad * Math.cos(a)];
  let acc = 0;
  const arcs = slices.map((s) => {
    const a0 = (acc / total) * 2 * Math.PI;
    acc += s.v;
    const a1 = (acc / total) * 2 * Math.PI;
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const [x0, y0] = pt(a0, R), [x1, y1] = pt(a1, R), [x2, y2] = pt(a1, r), [x3, y3] = pt(a0, r);
    return { ...s, d: `M${x0} ${y0}A${R} ${R} 0 ${large} 1 ${x1} ${y1}L${x2} ${y2}A${r} ${r} 0 ${large} 0 ${x3} ${y3}Z` };
  });
  const focus = slices.find((s) => s.c === (hover ?? active));
  const pct = (v: number) => `${Math.round((v / total) * 100)}%`;

  return (
    <Panel title={title} bodyClassName="p-4">
      {total === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">{tx.nothingInPeriod}</div>
      ) : (
        <>
          <svg viewBox="0 0 192 192" className="mx-auto block w-48" role="img" aria-label={`${title}, total ${kzt(total)}`}>
            {slices.length === 1 ? (
              <circle cx={C} cy={C} r={(R + r) / 2} fill="none" stroke={color(slices[0].c)} strokeWidth={R - r} />
            ) : (
              arcs.map((a) => (
                <path
                  key={a.c}
                  d={a.d}
                  fill={color(a.c)}
                  stroke="var(--card)"
                  strokeWidth={2}
                  opacity={focus && focus.c !== a.c ? 0.35 : 1}
                  onMouseEnter={() => setHover(a.c)}
                  onMouseLeave={() => setHover(null)}
                  onClick={() => pick(a.c)}
                  className={cn("transition-opacity", onPick && "cursor-pointer")}
                >
                  <title>{`${name(a.c)}: ${kzt(a.v)} (${pct(a.v)})`}</title>
                </path>
              ))
            )}
            <text x={C} y={C - 6} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {focus ? name(focus.c) : tx.total}
            </text>
            <text x={C} y={C + 10} textAnchor="middle" className="fill-foreground text-[13px] font-semibold tabular-nums">
              {kzt(focus ? focus.v : total)}
            </text>
            {focus && (
              <text x={C} y={C + 24} textAnchor="middle" className="fill-muted-foreground text-[10px] tabular-nums">
                {pct(focus.v)}
              </text>
            )}
          </svg>
          {/* Legend doubles as the table view: every slice named with its value and share. */}
          <ul className="mt-4 space-y-0.5 text-sm">
            {slices.map((s) => (
              <li key={s.c}>
                <button
                  type="button"
                  onClick={() => pick(s.c)}
                  onMouseEnter={() => setHover(s.c)}
                  onMouseLeave={() => setHover(null)}
                  className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-muted", active === s.c && "bg-muted font-medium")}
                >
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: color(s.c) }} />
                  <span className="flex-1 truncate">{name(s.c)}</span>
                  <span className="text-muted-foreground tabular-nums">{kzt(s.v)}</span>
                  <span className="w-9 text-right text-xs text-muted-foreground tabular-nums">{pct(s.v)}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
