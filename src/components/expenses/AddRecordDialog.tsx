"use client";

// "Add record" modal: the whole expense in one form. Picked invoice files upload once the expense is saved.
import { useRef, useState } from "react";
import { FileText, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MAX_INVOICE_BYTES } from "@/lib/invoice-files";
import { cn } from "@/lib/utils";
import { AmountField } from "./AmountField";
import { CategorySelect } from "./CategorySelect";
import { ComboInput } from "./ExpenseSheet";
import { todayISO, type NewExpense } from "./data";

const field = "h-9 w-full rounded-md border bg-card px-3 text-sm outline-none transition-shadow focus:border-ring focus:ring-3 focus:ring-ring/20";
const label = "text-xs font-medium text-muted-foreground";

type OnAdd = (e: NewExpense, files: File[]) => Promise<string | null>;

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
  onAdd: OnAdd;
  vendors: string[];
  categories: string[];
  defaultCategory: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-lg">
        {/* Remount per open so the form starts empty each time. */}
        {open && <Form onAdd={onAdd} onDone={() => onOpenChange(false)} vendors={vendors} categories={categories} defaultCategory={defaultCategory} />}
      </DialogContent>
    </Dialog>
  );
}

function Form({ onAdd, onDone, vendors, categories, defaultCategory }: { onAdd: OnAdd; onDone: () => void; vendors: string[]; categories: string[]; defaultCategory: string }) {
  const t = useT();
  const tx = t.expenses;
  const [amount, setAmount] = useState(0);
  const [vendor, setVendor] = useState("");
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState(defaultCategory);
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [over, setOver] = useState(false);
  const [saving, setSaving] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  // Files over the cap are refused here, before anything is saved.
  const addFiles = (list: FileList | File[]) => {
    const picked = Array.from(list);
    picked.filter((f) => f.size > MAX_INVOICE_BYTES).forEach((f) => toast.error(tx.fileTooBig(f.name)));
    setFiles((xs) => [...xs, ...picked.filter((f) => f.size <= MAX_INVOICE_BYTES)]);
  };
  const valid = !!vendor.trim() && amount > 0 && !!category.trim();

  const submit = async () => {
    if (!valid || saving) return;
    setSaving(true);
    // Close once the expense exists; invoice uploads carry on in the background.
    const id = await onAdd({ amount, vendor: vendor.trim(), date, category: category.trim(), description: description.trim() }, files);
    setSaving(false);
    if (id) onDone();
  };

  return (
    <form onSubmit={(e) => (e.preventDefault(), void submit())}>
      <DialogHeader className="gap-1 px-5 pt-5 pb-3">
        <DialogTitle className="text-base font-semibold">{tx.newExpense}</DialogTitle>
        <DialogDescription className="text-xs">{tx.required}</DialogDescription>
      </DialogHeader>
      <div
        className="space-y-4 px-5 pb-5 text-sm"
        onKeyDown={(e) => {
          // ⌘/Ctrl+Enter saves from anywhere in the form, including the description.
          if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey)) return;
          e.preventDefault();
          void submit();
        }}
      >
        {/* The amount is the headline: big, right next to its currency. */}
        <AmountField autoFocus amount={amount} onChange={setAmount} />
        <div className="grid grid-cols-[1fr_10rem] gap-3">
          <div className="space-y-1.5">
            <span className={label}>{tx.vendor}</span>
            <ComboInput value={vendor} onChange={setVendor} options={vendors} placeholder={tx.vendorPlaceholder} createLabel={tx.addVendor} inputClassName="h-9 px-3" />
          </div>
          <label className="space-y-1.5">
            <span className={label}>{tx.date}</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} />
          </label>
        </div>
        <div className="space-y-1.5">
          <span className={label}>{tx.category}</span>
          <CategorySelect value={category} onChange={setCategory} categories={categories} className="h-9" />
        </div>
        <label className="block space-y-1.5">
          <span className={label}>
            {tx.description} <span className="font-normal text-muted-foreground/70">· {tx.optional}</span>
          </span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder={tx.descriptionPlaceholder} className={cn(field, "h-auto resize-none py-2")} />
        </label>
        <div className="space-y-1.5">
          <span className={label}>
            {tx.invoice} <span className="font-normal text-muted-foreground/70">· {tx.optional}</span>
          </span>
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-2.5 rounded-md border bg-card px-3 py-2">
              <span className="grid size-7 place-items-center rounded bg-red-50 text-red-600 dark:bg-red-950/40">
                <FileText className="size-4" />
              </span>
              <span className="flex-1 truncate">{f.name}</span>
              <button type="button" onClick={() => setFiles((xs) => xs.filter((_, j) => j !== i))} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={tx.removeInvoice}>
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
              <span className="font-medium text-foreground">{files.length ? tx.addAnotherFile : tx.uploadInvoice}</span> {tx.orDrag}
              <span className="block text-xs">{tx.fileTypes}</span>
            </span>
            <input ref={file} type="file" multiple hidden accept=".pdf,image/*" onChange={(e) => e.target.files && addFiles(e.target.files)} />
          </div>
        </div>
      </div>
      <DialogFooter className="mx-0 mb-0 items-center px-5 py-3">
        <span className="mr-auto hidden text-xs text-muted-foreground sm:block">{tx.saveHint}</span>
        <Button type="button" variant="ghost" onClick={onDone}>
          {t.common.cancel}
        </Button>
        <Button type="submit" disabled={!valid || saving}>
          {tx.addExpense}
        </Button>
      </DialogFooter>
    </form>
  );
}
