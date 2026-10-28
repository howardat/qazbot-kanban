"use client";

// PROTOTYPE — the expense "card" opened from Variant C: a side peek that edits in place (every change saves
// straight to the store), plus the combobox it shares with the draft rows for vendors and category tags.
import { useRef, useState } from "react";
import { FileText, Paperclip, Plus, X } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { CategorySelect } from "./CategorySelect";
import { catColor, kzt, type Expense, type VariantProps } from "./mock";

/** A category tag: Plane-style grey pill with the category's palette colour as its dot. */
export function CategoryPill({ name, categories, size = "sm" }: { name: string; categories: string[]; size?: "sm" | "md" }) {
  return (
    <span className={cn("inline-flex max-w-40 items-center gap-1.5 rounded-md bg-muted leading-none font-medium text-muted-foreground", size === "sm" ? "h-5 px-2 text-[11px]" : "h-6 px-2 text-xs")}>
      <span className="size-2 shrink-0 rounded-full" style={{ background: catColor(name, categories) }} aria-hidden />
      <span className="truncate">{name}</span>
    </span>
  );
}

const field = "h-9 w-full rounded-md border bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40";

/**
 * Free-text field with a dropdown of every value already used; a new one is offered as `Add <noun> "X"`.
 * `categories` renders the value and options as category pills in their palette colours.
 */
export function ComboInput({
  value,
  onChange,
  options: known,
  noun,
  categories,
  className,
  inputClassName,
  autoFocus,
}: { value: string; onChange: (v: string) => void; options: string[]; noun: string; categories?: string[]; className?: string; inputClassName?: string; autoFocus?: boolean }) {
  const tags = !!categories;
  const [open, setOpen] = useState(false);
  const [text, setText] = useState<string | null>(null); // what's typed while the list is open; null = show value
  const [hi, setHi] = useState(0);
  const shown = text ?? value;
  const q = (text ?? "").trim().toLowerCase();
  const matches = known.filter((v) => !q || v.toLowerCase().includes(q));
  const isNew = !!q && !known.some((v) => v.toLowerCase() === q);
  const options = [...matches, ...(isNew ? [text!.trim()] : [])];
  const pick = (v: string) => (onChange(v), setText(null), setOpen(false));
  // Vendors commit as you type (a brand-new vendor is just text); tags only commit on pick.
  const type = (v: string) => (setText(v), setOpen(true), setHi(0), !tags && onChange(v));

  return (
    <div className={cn("relative", className)}>
      {tags && value && text === null && <span className={cn("pointer-events-none absolute top-1/2 left-2.5 size-2 -translate-y-1/2 rounded-full", "")} style={{ background: catColor(value, categories!) }} />}
      <input
        autoFocus={autoFocus}
        value={shown}
        placeholder={noun[0].toUpperCase() + noun.slice(1)}
        onChange={(e) => type(e.target.value)}
        onFocus={(e) => (setOpen(true), tags && e.target.select())}
        onBlur={() => setTimeout(() => (setOpen(false), setText(null)), 120)}
        onKeyDown={(e) => {
          if (e.key === "Escape") return (setOpen(false), setText(null));
          if (!open || !options.length || !["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) return;
          e.preventDefault();
          if (e.key === "Enter") pick(options[hi]);
          else setHi((h) => (h + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
        }}
        className={cn(field, "h-8 px-2", tags && value && text === null && "pl-6", inputClassName)}
      />
      {open && options.length > 0 && (
        <ul className="absolute top-full left-0 z-50 mt-1 max-h-60 w-full min-w-48 overflow-y-auto rounded-md border bg-popover p-1 text-sm shadow-lg">
          {options.map((v, i) => {
            const create = isNew && i === options.length - 1;
            return (
              <li key={create ? "__new" : v}>
                <button
                  type="button"
                  onMouseDown={(e) => (e.preventDefault(), pick(v))}
                  onMouseEnter={() => setHi(i)}
                  className={cn("flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left", i === hi && "bg-accent")}
                >
                  {create ? (
                    <>
                      <Plus className="size-3.5 text-muted-foreground" /> Add {noun} “{v}”
                    </>
                  ) : tags ? (
                    <CategoryPill name={v} categories={categories!} size="md" />
                  ) : (
                    v
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function ExpenseSheet({
  expense,
  onClose,
  vendors,
  categories,
  update,
  attach,
  remove,
}: { expense: Expense | undefined; onClose: () => void; vendors: string[]; categories: string[] } & Pick<VariantProps, "update" | "attach" | "remove">) {
  const file = useRef<HTMLInputElement>(null);
  const e = expense;
  return (
    <Sheet open={!!e} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-lg">
        {e && (
          <>
            <SheetHeader className="border-b">
              <SheetTitle>{e.vendor || "New expense"}</SheetTitle>
              <SheetDescription>
                {e.date} · {kzt(e.amount)} · changes save as you type
              </SheetDescription>
            </SheetHeader>
            <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
              <label className="block space-y-1">
                <span className="text-muted-foreground">Amount, ₸</span>
                <input
                  inputMode="numeric"
                  value={e.amount || ""}
                  onChange={(ev) => update(e.id, { amount: Number(ev.target.value.replace(/\D/g, "")) || 0 })}
                  className={cn(field, "h-12 text-2xl font-semibold tabular-nums")}
                />
              </label>
              <div className="space-y-1">
                <span className="text-muted-foreground">Vendor</span>
                <ComboInput value={e.vendor} onChange={(v) => update(e.id, { vendor: v })} options={vendors} noun="vendor" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-muted-foreground">Date</span>
                  <input type="date" value={e.date} onChange={(ev) => update(e.id, { date: ev.target.value })} className={field} />
                </label>
                <div className="space-y-1">
                  <span className="text-muted-foreground">Category</span>
                  <CategorySelect value={e.category} onChange={(v) => update(e.id, { category: v })} categories={categories} className="h-9" />
                </div>
              </div>
              <label className="block space-y-1">
                <span className="text-muted-foreground">Description</span>
                <textarea
                  value={e.description}
                  onChange={(ev) => update(e.id, { description: ev.target.value })}
                  rows={5}
                  placeholder="What was it for, who approved it, project…"
                  className={cn(field, "h-auto py-2")}
                />
              </label>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Invoices</span>
                  <button type="button" onClick={() => file.current?.click()} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs hover:bg-muted">
                    <Paperclip className="size-3.5" /> Attach
                  </button>
                  <input ref={file} type="file" multiple hidden onChange={(ev) => ev.target.files && attach(e.id, ev.target.files)} />
                </div>
                {e.invoices.length === 0 && <div className="rounded-md border border-dashed p-3 text-center text-amber-600">No invoice attached</div>}
                {e.invoices.map((inv, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                    <FileText className="size-4 text-muted-foreground" />
                    <a href={inv.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-sky-600 hover:underline">
                      {inv.name}
                    </a>
                    <button type="button" onClick={() => update(e.id, { invoices: e.invoices.filter((_, j) => j !== i) })} className="text-muted-foreground hover:text-foreground" aria-label="Remove invoice">
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex border-t p-4">
              <button type="button" onClick={() => (remove(e.id), onClose())} className="text-sm text-destructive hover:underline">
                Delete expense
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
