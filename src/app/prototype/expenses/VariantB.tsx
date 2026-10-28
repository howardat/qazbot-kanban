"use client";

// PROTOTYPE — Variant B: period rail + side peek. A Year → Quarter → Month tree on the left filters a
// list of expenses; adding or opening one slides in a sheet with a big invoice drop zone.
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, FileDown, FileSpreadsheet, FileText, Paperclip, Plus, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  CATEGORIES, exportCsv, filesToInvoices, kzt, MONTHS, periodLabel, periodOf, printReport, quarterOf, sum, todayISO,
  type Expense, type Invoice, type VariantProps,
} from "./mock";

/** Does a date fall in a rail key: "2026", "2026-Q4" or "2026-10"? */
const match = (date: string, key: string) => (key.includes("Q") ? periodOf(date, "quarter") === key : date.startsWith(key));

export function VariantB({ expenses, add, update, remove, onView }: VariantProps) {
  const years = useMemo(() => [...new Set([...expenses.map((e) => e.date.slice(0, 4)), todayISO().slice(0, 4)])].sort().reverse(), [expenses]);
  const [sel, setSel] = useState(periodOf(todayISO(), "quarter")); // "2026" | "2026-Q4" | "2026-10"
  const [open, setOpen] = useState<string | "new" | null>(null);

  const rows = useMemo(() => expenses.filter((e) => match(e.date, sel)).sort((a, b) => b.date.localeCompare(a.date)), [expenses, sel]);
  useEffect(() => onView(`B · ${periodLabel(sel)}`, rows), [rows, sel, onView]);

  const total = (key: string) => sum(expenses.filter((e) => match(e.date, key)));
  const editing = open && open !== "new" ? expenses.find((e) => e.id === open) : undefined;

  return (
    <div className="flex min-h-[calc(100dvh-3rem)]">
      {/* Period rail */}
      <aside className="w-64 shrink-0 border-r bg-muted/30 p-2 text-sm">
        <div className="px-2 pt-2 pb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">Periods</div>
        {years.map((y) => (
          <div key={y} className="mb-2">
            <RailItem label={y} total={total(y)} active={sel === y} onClick={() => setSel(y)} bold />
            {[1, 2, 3, 4].map((qn) => {
              const qk = `${y}-Q${qn}`;
              const showMonths = sel === qk || sel.startsWith(y + "-") && !sel.includes("Q") && quarterOf(`${sel}-01`) === qn;
              return (
                <div key={qk} className="ml-3">
                  <RailItem label={`Q${qn}`} total={total(qk)} active={sel === qk} onClick={() => setSel(qk)} chevron={showMonths} />
                  {showMonths &&
                    [0, 1, 2].map((i) => {
                      const mk = `${y}-${String((qn - 1) * 3 + i + 1).padStart(2, "0")}`;
                      return (
                        <div key={mk} className="ml-3">
                          <RailItem label={MONTHS[(qn - 1) * 3 + i]} total={total(mk)} active={sel === mk} onClick={() => setSel(mk)} />
                        </div>
                      );
                    })}
                </div>
              );
            })}
          </div>
        ))}
      </aside>

      {/* List */}
      <main className="min-w-0 flex-1">
        <div className="flex items-center gap-3 border-b px-6 py-4">
          <div className="mr-auto">
            <div className="text-xs text-muted-foreground">Expenses</div>
            <h1 className="text-xl font-semibold">
              {periodLabel(sel)} <span className="ml-2 text-base font-normal text-muted-foreground tabular-nums">{kzt(sum(rows))}</span>
            </h1>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <FileText /> Report <ChevronDown />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
              <div className="border-b p-3">
                <div className="text-sm font-medium">Report · {periodLabel(sel)}</div>
                <div className="text-xs text-muted-foreground">{rows.length} expenses · {rows.filter((r) => !r.invoices.length).length} missing invoices</div>
              </div>
              <div className="space-y-1 p-3 text-sm">
                {CATEGORIES.map((c) => ({ c, v: sum(rows.filter((r) => r.category === c)) }))
                  .filter((x) => x.v)
                  .map(({ c, v }) => (
                    <div key={c} className="flex justify-between">
                      <span className="text-muted-foreground">{c}</span>
                      <span className="tabular-nums">{kzt(v)}</span>
                    </div>
                  ))}
              </div>
              <div className="flex gap-2 border-t p-3">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => exportCsv(rows, periodLabel(sel))}>
                  <FileSpreadsheet /> Excel
                </Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => printReport(rows, periodLabel(sel))}>
                  <FileDown /> PDF
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          <Button onClick={() => setOpen("new")}>
            <Plus /> New expense
          </Button>
        </div>
        <ul>
          {rows.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setOpen(r.id)} className="flex w-full items-center gap-4 border-b px-6 py-3 text-left hover:bg-muted/50">
                <div className="w-12 shrink-0 text-center">
                  <div className="text-lg leading-none font-semibold tabular-nums">{r.date.slice(8)}</div>
                  <div className="text-[11px] text-muted-foreground uppercase">{MONTHS[Number(r.date.slice(5, 7)) - 1]}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.vendor}</div>
                  <div className="truncate text-sm text-muted-foreground">{r.description}</div>
                </div>
                <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">{r.category}</span>
                <span className={cn("flex w-14 items-center gap-1 text-xs", r.invoices.length ? "text-muted-foreground" : "text-amber-600")}>
                  <Paperclip className="size-3.5" /> {r.invoices.length || "none"}
                </span>
                <span className="w-32 text-right font-semibold tabular-nums">{kzt(r.amount)}</span>
              </button>
            </li>
          ))}
          {rows.length === 0 && <li className="py-16 text-center text-muted-foreground">Nothing spent in {periodLabel(sel)}.</li>}
        </ul>
      </main>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full gap-0 sm:max-w-lg">
          {open && (
            <ExpenseForm
              key={open}
              initial={editing}
              defaultDate={sel.length === 7 && !sel.includes("Q") ? `${sel}-01` : todayISO()}
              onSave={(e) => {
                if (editing) update(editing.id, e);
                else add(e);
                setOpen(null);
              }}
              onDelete={editing ? () => (remove(editing.id), setOpen(null)) : undefined}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function RailItem({ label, total, active, onClick, bold, chevron }: { label: string; total: number; active: boolean; onClick: () => void; bold?: boolean; chevron?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex h-8 w-full items-center gap-1 rounded-md px-2 text-left hover:bg-muted", active && "bg-card font-medium shadow-xs ring-1 ring-border", bold && "font-semibold")}
    >
      {chevron !== undefined && <ChevronDown className={cn("size-3 text-muted-foreground transition", !chevron && "-rotate-90")} />}
      <span className="flex-1">{label}</span>
      <span className={cn("text-xs tabular-nums", total ? "text-muted-foreground" : "text-muted-foreground/40")}>{total ? kzt(total) : "—"}</span>
    </button>
  );
}

function ExpenseForm({ initial, defaultDate, onSave, onDelete }: { initial?: Expense; defaultDate: string; onSave: (e: Omit<Expense, "id">) => void; onDelete?: () => void }) {
  const [f, setF] = useState<Omit<Expense, "id">>(
    initial ?? { date: defaultDate, vendor: "", description: "", category: CATEGORIES[0], amount: 0, invoices: [] },
  );
  const [over, setOver] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const addFiles = (files: FileList | File[]) => setF((x) => ({ ...x, invoices: [...x.invoices, ...filesToInvoices(files)] }));
  const field = "h-9 w-full rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40";

  return (
    <>
      <SheetHeader className="border-b">
        <SheetTitle>{initial ? "Edit expense" : "New expense"}</SheetTitle>
        <SheetDescription>Attach the invoice now so the report is complete.</SheetDescription>
      </SheetHeader>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div
          onDragOver={(e) => (e.preventDefault(), setOver(true))}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => (e.preventDefault(), setOver(false), addFiles(e.dataTransfer.files))}
          onClick={() => input.current?.click()}
          className={cn("grid cursor-pointer place-items-center rounded-lg border-2 border-dashed p-6 text-center text-sm text-muted-foreground", over && "border-sky-500 bg-sky-50 dark:bg-sky-950/30")}
        >
          <Upload className="mb-2 size-6" />
          Drop invoice PDF / photo here, or click to choose
          <input ref={input} type="file" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />
        </div>
        {f.invoices.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {f.invoices.map((inv: Invoice, i) => (
              <div key={i} className="group relative overflow-hidden rounded-md border bg-muted/40">
                <a href={inv.url} target="_blank" rel="noreferrer" className="block">
                  {/\.(png|jpe?g|webp|gif)$/i.test(inv.name) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={inv.url} alt={inv.name} className="h-20 w-full object-cover" />
                  ) : (
                    <div className="grid h-20 place-items-center">
                      <FileText className="size-6 text-muted-foreground" />
                    </div>
                  )}
                  <div className="truncate px-2 py-1 text-[11px]">{inv.name}</div>
                </a>
                <button
                  type="button"
                  onClick={() => setF((x) => ({ ...x, invoices: x.invoices.filter((_, j) => j !== i) }))}
                  className="absolute top-1 right-1 hidden rounded bg-card/90 p-0.5 group-hover:block"
                  aria-label="Remove invoice"
                >
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Amount, ₸</span>
          <input
            autoFocus
            inputMode="numeric"
            value={f.amount || ""}
            onChange={(e) => setF({ ...f, amount: Number(e.target.value.replace(/\D/g, "")) || 0 })}
            className={cn(field, "h-12 text-2xl font-semibold tabular-nums")}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Date</span>
            <input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} className={field} />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-muted-foreground">Category</span>
            <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={field}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Vendor</span>
          <input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} className={field} />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-muted-foreground">Description</span>
          <textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} rows={3} className={cn(field, "h-auto py-2")} />
        </label>
      </div>
      <div className="flex gap-2 border-t p-4">
        {onDelete && (
          <Button variant="ghost" onClick={onDelete} className="text-destructive">
            Delete
          </Button>
        )}
        <Button className="ml-auto" disabled={!f.vendor || !f.amount} onClick={() => onSave(f)}>
          {initial ? "Save" : "Add expense"}
        </Button>
      </div>
    </>
  );
}
