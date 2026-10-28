"use client";

// "Add record" modal: the whole expense in one form, with the invoice upload.
import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CategorySelect } from "./CategorySelect";
import { AmountField } from "./AmountField";
import { ComboInput } from "./ExpenseSheet";
import { filesToInvoices, todayISO, type Expense, type Invoice } from "./data";

const field = "h-9 w-full rounded-md border bg-card px-3 text-sm outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20";
const label = "text-xs font-medium text-muted-foreground";

export function AddRecordDialog({
  open,
  onOpenChange,
  onAdd,
  vendors,
  categories,
  defaultCategory,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onAdd: (e: Omit<Expense, "id">) => void;
  vendors: string[];
  categories: string[];
  defaultCategory: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {/* Remount per open so the form starts empty each time. */}
        {open && <Form onAdd={(e) => (onAdd(e), onOpenChange(false))} onCancel={() => onOpenChange(false)} vendors={vendors} categories={categories} defaultCategory={defaultCategory} />}
      </DialogContent>
    </Dialog>
  );
}

function Form({
  onAdd,
  onCancel,
  vendors,
  categories,
  defaultCategory,
}: { onAdd: (e: Omit<Expense, "id">) => void; onCancel: () => void; vendors: string[]; categories: string[]; defaultCategory: string }) {
  const [amount, setAmount] = useState(0);
  const [vendor, setVendor] = useState("");
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState(defaultCategory);
  const [description, setDescription] = useState("");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [over, setOver] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const addFiles = (files: FileList | File[]) => setInvoices((xs) => [...xs, ...filesToInvoices(files)]);
  const valid = !!vendor.trim() && amount > 0 && !!category.trim();
  const submit = () => valid && onAdd({ amount, vendor: vendor.trim(), date, category: category.trim(), description: description.trim(), invoices });

  return (
    <form onSubmit={(e) => (e.preventDefault(), submit())}>
      <DialogHeader className="gap-1 px-5 pt-5 pb-3">
        <DialogTitle className="text-base font-semibold">New expense</DialogTitle>
        <DialogDescription className="text-xs">Amount, vendor and category are required.</DialogDescription>
      </DialogHeader>
      <div
        className="space-y-4 px-5 pb-5 text-sm"
        onKeyDown={(e) => {
          // ⌘/Ctrl+Enter saves from anywhere in the form, including the description.
          if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey)) return;
          e.preventDefault();
          submit();
        }}
      >
        {/* The amount is the headline: big, right next to its currency. */}
        <AmountField autoFocus amount={amount} onChange={setAmount} />
        <div className="grid grid-cols-[1fr_10rem] gap-3">
          <div className="space-y-1.5">
            <span className={label}>Vendor</span>
            <ComboInput value={vendor} onChange={setVendor} options={vendors} noun="vendor" inputClassName="h-9 px-3" />
          </div>
          <label className="space-y-1.5">
            <span className={label}>Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
          </label>
        </div>
        <div className="space-y-1.5">
          <span className={label}>Category</span>
          <CategorySelect value={category} onChange={setCategory} categories={categories} className="h-9" />
        </div>
        <label className="block space-y-1.5">
          <span className={label}>
            Description <span className="font-normal text-muted-foreground/70">· optional</span>
          </span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="What was it for, project, who approved it…" className={cn(field, "h-auto resize-none py-2")} />
        </label>
        <div className="space-y-1.5">
          <span className={label}>
            Invoice <span className="font-normal text-muted-foreground/70">· optional</span>
          </span>
          {invoices.map((inv, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-md border bg-card px-3 py-2">
              <span className="grid size-7 place-items-center rounded bg-red-50 text-red-600 dark:bg-red-950/40">
                <FileText className="size-4" />
              </span>
              <span className="flex-1 truncate">{inv.name}</span>
              <button type="button" onClick={() => setInvoices((xs) => xs.filter((_, j) => j !== i))} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Remove invoice">
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          <div
            onDragOver={(e) => (e.preventDefault(), setOver(true))}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => (e.preventDefault(), setOver(false), addFiles(e.dataTransfer.files))}
            onClick={() => file.current?.click()}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-md border border-dashed px-3 py-2.5 text-muted-foreground transition-colors",
              over ? "border-sky-500 bg-sky-50 dark:bg-sky-950/30" : "hover:border-border-strong hover:bg-muted/40",
            )}
          >
            <span className="grid size-7 place-items-center rounded bg-muted">
              <Upload className="size-3.5" />
            </span>
            <span>
              <span className="font-medium text-foreground">{invoices.length ? "Add another file" : "Upload invoice"}</span> or drag it here
              <span className="block text-xs">PDF, JPG or PNG</span>
            </span>
            <input ref={file} type="file" multiple hidden accept=".pdf,image/*" onChange={(e) => e.target.files && addFiles(e.target.files)} />
          </div>
        </div>
      </div>
      <DialogFooter className="mx-0 mb-0 items-center px-5 py-3">
        <span className="mr-auto hidden text-xs text-muted-foreground sm:block">⌘ Enter to save</span>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          Add expense
        </Button>
      </DialogFooter>
    </form>
  );
}
