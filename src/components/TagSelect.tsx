"use client";

// Tag picker modelled on Plane's LabelSelect (packages/blocks/src/property-select/label-select), shared by
// expense categories and card labels: a pill trigger shows what's picked, its popover has a search box,
// typing filters the options, and when nothing matches a `+ Add "query"` row creates one from what was
// typed (Enter does the same). Single-select closes on pick; multi-select stays open and toggles.
import { useState } from "react";
import { Check, ChevronDown, Plus, Search, Tag } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** One choice: its dot is either a CSS colour or a class (the label palette's TAG_DOT). */
export type TagOption = { id: string; name: string; color?: string; dotClassName?: string };

function Dot({ option }: { option: TagOption }) {
  return <span className={cn("size-2 shrink-0 rounded-full", option.dotClassName)} style={option.color ? { background: option.color } : undefined} aria-hidden />;
}

/** A picked tag: Plane-style grey pill with the tag's colour as its dot. */
export function TagPill({ option, className }: { option: TagOption; className?: string }) {
  return (
    <span className={cn("flex h-6 min-w-0 items-center gap-1.5 rounded-md bg-muted px-2 text-xs font-medium text-muted-foreground", className)}>
      <Dot option={option} />
      <span className="truncate">{option.name}</span>
    </span>
  );
}

export function TagSelect({
  options,
  selected,
  onToggle,
  onCreate,
  multiple = false,
  labels,
  className,
}: {
  options: TagOption[];
  /** Ids of the picked options. */
  selected: string[];
  /** Pick (single) or toggle (multiple) an option. */
  onToggle: (id: string) => void;
  /** Create an option from the typed name; without it there is no Add row. */
  onCreate?: (name: string) => void;
  multiple?: boolean;
  labels: { placeholder: string; search: string; add: (name: string) => string; empty: string };
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hi, setHi] = useState(0);
  const q = query.trim().toLowerCase();
  const matches = options.filter((o) => !q || o.name.toLowerCase().includes(q));
  const canCreate = !!onCreate && !!q && !options.some((o) => o.name.toLowerCase() === q);
  const picked = options.filter((o) => selected.includes(o.id));

  const close = () => (setOpen(false), setQuery(""), setHi(0));
  // Multi-select stays open for the next pick; single-select is done.
  const after = () => {
    if (!multiple) return close();
    setQuery("");
    setHi(0);
  };
  const pick = (id: string) => (onToggle(id), after());
  const create = () => (onCreate?.(query.trim()), after());

  return (
    <Popover open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-8 w-full cursor-pointer items-center gap-1.5 rounded-md border bg-card px-1.5 py-1 text-left text-sm outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring/40",
            className,
          )}
        >
          {picked.length > 0 ? (
            <span className="flex min-w-0 flex-1 flex-wrap gap-1">
              {picked.map((o) => (
                <TagPill key={o.id} option={o} />
              ))}
            </span>
          ) : (
            <span className="flex flex-1 items-center gap-1.5 px-0.5 text-muted-foreground">
              <Tag className="size-3.5" /> {labels.placeholder}
            </span>
          )}
          <ChevronDown className="ml-auto size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[max(15rem,var(--radix-popover-trigger-width))] p-1"
        onOpenAutoFocus={(e) => (e.preventDefault(), (e.currentTarget as HTMLElement).querySelector("input")?.focus())}
      >
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
              else if (canCreate && matches.length === 0) create();
              else if (matches[hi]) pick(matches[hi].id);
            }}
            placeholder={labels.search}
            maxLength={40}
            className="h-9 w-full bg-transparent text-sm text-foreground outline-none"
          />
        </label>
        <ul className="max-h-60 overflow-y-auto">
          {matches.map((o, i) => (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => pick(o.id)}
                onMouseEnter={() => setHi(i)}
                className={cn("flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm", i === hi && "bg-accent")}
              >
                <Dot option={o} />
                <span className="flex-1 truncate">{o.name}</span>
                {selected.includes(o.id) && <Check className="size-3.5 text-muted-foreground" />}
              </button>
            </li>
          ))}
          {canCreate && (
            <li>
              <button
                type="button"
                onClick={create}
                className={cn("flex w-full cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent", matches.length === 0 && "bg-accent")}
              >
                <Plus className="size-3.5 shrink-0" />
                <span className="line-clamp-2 break-all">{labels.add(query.trim())}</span>
              </button>
            </li>
          )}
          {!q && options.length === 0 && <li className="px-2 py-1.5 text-xs text-muted-foreground">{labels.empty}</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
