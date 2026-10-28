"use client";

// Category picker modelled on Plane's LabelSelect (packages/blocks/src/property-select/label-select):
// a pill trigger opens a popover with a search box; typing filters the categories; when nothing matches, a
// `+ Add "query" to categories` row creates the category from what was typed (Enter does the same).
import { useState } from "react";
import { Check, ChevronDown, Plus, Search, Tag } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { catColor } from "./data";

export function CategorySelect({
  value,
  onChange,
  categories,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  categories: string[];
  className?: string;
}) {
  const tx = useT().expenses;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const q = query.trim().toLowerCase();
  const matches = categories.filter((c) => !q || c.toLowerCase().includes(q));
  const canCreate = !!q && matches.length === 0;

  const close = () => (setOpen(false), setQuery(""), setHi(0));
  const pick = (c: string) => (onChange(c), close());

  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-8 w-full items-center gap-1.5 rounded-md border bg-card px-2 text-left text-sm outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40",
            className,
          )}
        >
          {value ? (
            <span className="flex h-6 min-w-0 items-center gap-1.5 rounded-md bg-muted px-2 text-xs font-medium text-muted-foreground">
              <span className="size-2 shrink-0 rounded-full" style={{ background: catColor(value, categories) }} />
              <span className="truncate">{value}</span>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Tag className="size-3.5" /> {tx.category}
            </span>
          )}
          <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[max(15rem,var(--radix-popover-trigger-width))] p-1" onOpenAutoFocus={(e) => (e.preventDefault(), (e.currentTarget as HTMLElement).querySelector("input")?.focus())}>
        <label className="mb-1 flex items-center gap-2 border-b px-2 text-muted-foreground">
          <Search className="size-3.5 shrink-0" />
          <input
          value={query}
          onChange={(e) => (setQuery(e.target.value), setHi(0))}
          onKeyDown={(e) => {
            if (!["ArrowDown", "ArrowUp", "Enter"].includes(e.key)) return;
            e.preventDefault();
            if (e.key === "ArrowDown") setHi((h) => Math.min(h + 1, Math.max(matches.length - 1, 0)));
            else if (e.key === "ArrowUp") setHi((h) => Math.max(h - 1, 0));
            else if (canCreate) pick(query.trim());
            else if (matches[hi]) pick(matches[hi]);
          }}
          placeholder={tx.searchCategories}
          className="h-9 w-full bg-transparent text-sm text-foreground outline-none"
        />
        </label>
        <ul className="max-h-60 overflow-y-auto">
          {matches.map((c, i) => (
            <li key={c}>
              <button
                type="button"
                onClick={() => pick(c)}
                onMouseEnter={() => setHi(i)}
                className={cn("flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm", i === hi && "bg-accent")}
              >
                <span className="size-2 shrink-0 rounded-full" style={{ background: catColor(c, categories) }} />
                <span className="flex-1 truncate">{c}</span>
                {c === value && <Check className="size-3.5 text-muted-foreground" />}
              </button>
            </li>
          ))}
          {canCreate && (
            <li>
              <button type="button" onClick={() => pick(query.trim())} className="flex w-full items-center gap-2 rounded-sm bg-accent px-2 py-1.5 text-left text-sm text-muted-foreground">
                <Plus className="size-3.5 shrink-0" />
                <span className="truncate">
                  {tx.addCategory(query.trim())}
                </span>
              </button>
            </li>
          )}
          {!q && matches.length === 0 && <li className="px-2 py-1.5 text-xs text-muted-foreground">{tx.noCategories}</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
