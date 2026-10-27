"use client";

import { useEffect, useState } from "react";
import { ChevronDown, Circle, CircleCheck, CircleDashed, ListFilter, SignalHigh, SignalLow, SignalMedium, SlidersHorizontal, TriangleAlert, X } from "lucide-react";
import { Avatar, TagBadge } from "@/components/atoms";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PRIORITIES, PRIORITY_STYLE, type Priority } from "@/lib/priority";
import { displayName, type CardData, type Member, type Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

// ---------- Filters ----------

/** What the board shows. Within a group any match counts; across groups all must match. */
export type Filters = { people: string[]; tags: string[]; priorities: Priority[] };
export const NO_FILTERS: Filters = { people: [], tags: [], priorities: [] };

export const hasFilters = (f: Filters) => f.people.length + f.tags.length + f.priorities.length > 0;

export const matches = (f: Filters, card: CardData) =>
  (!f.people.length || card.assigneeIds.some((id) => f.people.includes(id))) &&
  (!f.tags.length || card.tagIds.some((id) => f.tags.includes(id))) &&
  (!f.priorities.length || (!!card.priority && f.priorities.includes(card.priority)));

const flip = <T,>(list: T[], value: T) => (list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);

/** Plane's "Filters" button: one menu with a section per property, several picks per section. */
export function FiltersMenu({
  value,
  onChange,
  members,
  tags,
  currentUserId,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
  members: Member[];
  tags: Tag[];
  currentUserId: string;
}) {
  const t = useT();
  const b = t.board;
  const count = value.people.length + value.tags.length + value.priorities.length;
  // Keep the menu open while ticking several boxes.
  const keepOpen = (e: Event) => e.preventDefault();
  const me = members.find((m) => m.id === currentUserId);
  const others = members.filter((m) => m.id !== currentUserId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn(count > 0 && "border-primary/40 text-primary")}>
          <ListFilter /> {b.filters}
          {count > 0 && <span className="rounded-sm bg-primary/10 px-1 text-[11px] tabular-nums">{count}</span>}
          <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[70vh] w-60 overflow-y-auto">
        <DropdownMenuLabel className="text-xs text-muted-foreground">{b.assignee}</DropdownMenuLabel>
        {me && (
          <DropdownMenuCheckboxItem checked={value.people.includes(me.id)} onSelect={keepOpen} onCheckedChange={() => onChange({ ...value, people: flip(value.people, me.id) })}>
            <Avatar member={me} size={18} className="ring-0" /> {b.me}
          </DropdownMenuCheckboxItem>
        )}
        {others.map((m) => (
          <DropdownMenuCheckboxItem key={m.id} checked={value.people.includes(m.id)} onSelect={keepOpen} onCheckedChange={() => onChange({ ...value, people: flip(value.people, m.id) })}>
            <Avatar member={m} size={18} className="ring-0" /> <span className="truncate">{displayName(m)}</span>
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">{t.priority.label}</DropdownMenuLabel>
        {PRIORITIES.map((p) => (
          <DropdownMenuCheckboxItem key={p} checked={value.priorities.includes(p)} onSelect={keepOpen} onCheckedChange={() => onChange({ ...value, priorities: flip(value.priorities, p) })}>
            <PriorityIcon priority={p} /> {t.priority[p]}
          </DropdownMenuCheckboxItem>
        ))}
        {tags.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">{b.tag}</DropdownMenuLabel>
            {tags.map((tag) => (
              <DropdownMenuCheckboxItem key={tag.id} checked={value.tags.includes(tag.id)} onSelect={keepOpen} onCheckedChange={() => onChange({ ...value, tags: flip(value.tags, tag.id) })}>
                <TagBadge tag={tag} />
              </DropdownMenuCheckboxItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The filters in use as removable chips under the header, grouped per property, with "Clear all". */
export function AppliedFilters({ value, onChange, members, tags }: { value: Filters; onChange: (f: Filters) => void; members: Member[]; tags: Tag[] }) {
  const t = useT();
  const b = t.board;
  if (!hasFilters(value)) return null;
  const group = (label: string, items: { key: string; node: React.ReactNode; remove: () => void }[]) =>
    items.length > 0 && (
      <span className="inline-flex h-7 items-center gap-1 rounded-md border bg-card py-0.5 pr-0.5 pl-2 text-xs shadow-xs">
        <span className="text-muted-foreground">{label}</span>
        {items.map((i) => (
          <span key={i.key} className="inline-flex h-5 items-center gap-1 rounded-sm bg-muted pr-0.5 pl-1.5">
            {i.node}
            <button type="button" onClick={i.remove} aria-label={b.removeFilter} className="grid size-4 cursor-pointer place-items-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground">
              <X className="size-3" />
            </button>
          </span>
        ))}
      </span>
    );
  const memberById = new Map(members.map((m) => [m.id, m]));
  const tagById = new Map(tags.map((x) => [x.id, x]));
  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 md:px-6">
      {group(
        b.assignee,
        value.people.flatMap((id) => {
          const m = memberById.get(id);
          return m ? [{ key: id, node: <><Avatar member={m} size={14} className="ring-0" /> {displayName(m)}</>, remove: () => onChange({ ...value, people: flip(value.people, id) }) }] : [];
        }),
      )}
      {group(
        t.priority.label,
        value.priorities.map((p) => ({ key: p, node: <><PriorityIcon priority={p} className="size-3" /> {t.priority[p]}</>, remove: () => onChange({ ...value, priorities: flip(value.priorities, p) }) })),
      )}
      {group(
        b.tag,
        value.tags.flatMap((id) => {
          const tag = tagById.get(id);
          return tag ? [{ key: id, node: tag.name, remove: () => onChange({ ...value, tags: flip(value.tags, id) }) }] : [];
        }),
      )}
      <Button variant="ghost" size="xs" onClick={() => onChange(NO_FILTERS)}>
        <X /> {b.clearFilters}
      </Button>
    </div>
  );
}

// ---------- Display ----------

/** Which properties cards show, and whether empty columns stay. A per-viewer preference in this browser. */
export type Display = { description: boolean; tags: boolean; priority: boolean; dates: boolean; assignees: boolean; emptyColumns: boolean };
const DEFAULT_DISPLAY: Display = { description: false, tags: true, priority: true, dates: true, assignees: true, emptyColumns: true };
const DISPLAY_KEY = "qazbot:board-display";

export function useDisplay() {
  const [display, setDisplay] = useState<Display>(DEFAULT_DISPLAY);
  useEffect(() => {
    try {
      setDisplay({ ...DEFAULT_DISPLAY, ...JSON.parse(localStorage.getItem(DISPLAY_KEY) ?? "{}") });
    } catch {}
  }, []);
  const update = (patch: Partial<Display>) =>
    setDisplay((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(DISPLAY_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  return [display, update] as const;
}

/** Plane's "Display" button: toggles for the card properties and for empty columns. */
export function DisplayMenu({ value, onChange }: { value: Display; onChange: (patch: Partial<Display>) => void }) {
  const d = useT().board.display;
  const keepOpen = (e: Event) => e.preventDefault();
  const props = ["priority", "dates", "assignees", "tags", "description"] as const;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <SlidersHorizontal /> {d.button}
          <ChevronDown className="opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60 p-2">
        <DropdownMenuLabel className="px-1 text-xs text-muted-foreground">{d.properties}</DropdownMenuLabel>
        {/* Property toggles as chips, like Plane: filled when shown */}
        <div className="flex flex-wrap gap-1.5 px-1 pb-2">
          {props.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={value[p]}
              onClick={() => onChange({ [p]: !value[p] })}
              className={cn(
                "h-6 cursor-pointer rounded-md border px-2 text-xs font-medium transition-colors",
                value[p] ? "border-primary/30 bg-brand-soft text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {d[p]}
            </button>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={value.emptyColumns} onSelect={keepOpen} onCheckedChange={(v) => onChange({ emptyColumns: !!v })}>
          {d.emptyColumns}
        </DropdownMenuCheckboxItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------- Icons ----------

/** Plane-style state glyph for a column: empty circle, half-filled while in progress, check when done. */
export function StateIcon({ done, inProgress, first, className }: { done: boolean; inProgress: boolean; first?: boolean; className?: string }) {
  if (done) return <CircleCheck className={cn("size-4 shrink-0 fill-success/15 text-success", className)} aria-hidden />;
  if (inProgress)
    return (
      <svg viewBox="0 0 16 16" className={cn("size-4 shrink-0 text-warning", className)} aria-hidden>
        <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M8 4a4 4 0 0 1 0 8z" fill="currentColor" />
      </svg>
    );
  // The first open column reads as the backlog: a dashed ring.
  const Icon = first ? CircleDashed : Circle;
  return <Icon className={cn("size-4 shrink-0 text-muted-foreground", className)} aria-hidden />;
}

/** Plane-style priority glyph: signal bars, or a warning sign for urgent. */
export function PriorityIcon({ priority, className }: { priority: Priority; className?: string }) {
  const Icon = priority === "urgent" ? TriangleAlert : priority === "high" ? SignalHigh : priority === "medium" ? SignalMedium : SignalLow;
  return <Icon className={cn("size-3.5 shrink-0", PRIORITY_STYLE[priority], className)} aria-hidden />;
}
