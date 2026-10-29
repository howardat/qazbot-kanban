"use client";

import { useState } from "react";
import { enGB, ru } from "react-day-picker/locale";
import { AlertCircle, ArrowRight, CalendarDays, CalendarPlus, Check, Flag, Hexagon, Minus, Tag as TagIcon, UserPlus, X } from "lucide-react";
import { Avatar, AvatarStack, TagBadge } from "@/components/atoms";
import { PriorityIcon } from "@/components/BoardToolbar";
import type { QuickPatch } from "@/components/CardQuickProps";
import { useT } from "@/components/I18nProvider";
import { ModelIcon } from "@/components/ModelIcon";
import { TagPicker } from "@/components/TagSelect";
import { Calendar } from "@/components/ui/calendar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { STORY_POINTS, viaClaude } from "@/lib/card-source";
import { TAG_DOT } from "@/lib/colors";
import { dueState, type ISODate } from "@/lib/dates";
import { PRIORITIES, type Priority } from "@/lib/priority";
import { displayName, type CardData, type Member, type Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

const toDate = (iso: string) => new Date(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const flip = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

// Soft pills on top (priority, labels): tinted, borderless.
const pill = "inline-flex h-5 max-w-full shrink-0 items-center gap-1 rounded-full bg-muted/70 px-2 text-[11px] font-medium [&_svg]:size-3";
const PRIORITY_PILL: Record<Priority, string> = {
  high: "bg-red-500/10 text-red-600 dark:text-red-400",
  medium: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  low: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
};
// Click targets in the footer: text-like, with a hover wash.
const hit = "inline-flex h-6 cursor-pointer items-center gap-1 rounded-md px-1 text-xs outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50";
// Unset fields only show while the card is hovered, so cards without them stay calm.
const ghost = cn(hit, "text-muted-foreground/70 opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100");

/** First line of the description, without markdown marks. */
const firstLine = (s: string) =>
  s
    .split("\n")
    .map((l) => l.replace(/^[#>*\-\s\d.]+/, "").replace(/[*_`]/g, "").trim())
    .find(Boolean) ?? "";

/** The card's maker, with Claude's mark beside them when it was made through Claude. */
export function CreatorMark({ creator, claude, size = 20 }: { creator: Member | null; claude: boolean; size?: number }) {
  const t = useT();
  if (!creator && !claude) return null;
  const who = creator ? displayName(creator) : "";
  const title = creator ? (claude ? t.cardMeta.createdWithClaude(who) : t.cardMeta.createdBy(who)) : t.cardMeta.madeWithClaude;
  return (
    <span title={title} aria-label={title} className="flex -space-x-1.5">
      {creator && <Avatar member={creator} size={size} />}
      {claude && (
        <span className="grid place-items-center rounded-full bg-[#F5EEE6] ring-2 ring-card dark:bg-[#3a2f27]" style={{ width: size, height: size }}>
          <ModelIcon provider="anthropic" className="size-[65%]" />
        </span>
      )}
    </span>
  );
}

/** Due date as footer text: red alert icon when late, amber today and the next two days, grey otherwise. */
function DueText({ due, today, done }: { due: ISODate; today: ISODate; done: boolean }) {
  const t = useT();
  const state = dueState(due, today, done);
  const text = state === "today" || state === "soon" ? t.due.relative(due, today) : t.fmt.day(due);
  const Icon = state === "overdue" ? AlertCircle : CalendarDays;
  return (
    <span
      title={state === "overdue" ? t.due.relative(due, today) : undefined}
      className={cn(
        "inline-flex items-center gap-1",
        state === "overdue" ? "text-destructive" : state === "today" || state === "soon" ? "text-warning" : "text-muted-foreground",
        done && "line-through",
      )}
    >
      <Icon className="size-3.5" /> {text}
    </span>
  );
}

/**
 * A board card: priority and label pills, the title, the description's first line, then a footer with
 * the creator (and Claude's mark) → assignees on the left and story points and deadline on the right.
 * Everything but the description edits in place; a click anywhere else opens the card.
 */
export function BoardCard({
  card,
  done,
  members,
  assignable,
  tags,
  today,
  selected,
  overlay,
  show,
  onPatch,
  onCreateTag,
}: {
  card: CardData;
  done: boolean;
  /** Everyone, to show the creator and current assignees. */
  members: Map<string, Member>;
  /** Who may be newly assigned here. */
  assignable: Member[];
  /** The board's labels. */
  tags: Tag[];
  today: ISODate;
  selected: boolean;
  /** Drawn under the pointer while dragging: same look, no controls. */
  overlay?: boolean;
  show: { priority: boolean; dates: boolean; assignees: boolean; tags: boolean; description: boolean };
  onPatch: (patch: QuickPatch) => void;
  onCreateTag: (name: string) => void;
}) {
  const t = useT();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [dateOpen, setDateOpen] = useState(false);
  const desc = show.description ? firstLine(card.description) : "";
  const cardTags = card.tagIds.map((id) => tags.find((x) => x.id === id)).filter((x): x is Tag => !!x);
  const people = card.assigneeIds.map((id) => members.get(id)).filter((m): m is Member => !!m);
  const creator = card.createdBy ? (members.get(card.createdBy) ?? null) : null;
  const claude = viaClaude(card.createdVia);
  const pickable = [...members.values()].filter((m) => assignable.includes(m) || card.assigneeIds.includes(m.id));
  const creatorOnly = !!creator && people.length === 1 && people[0].id === creator.id;

  // The controls' own clicks (and their portaled menus') must not open or drag the card; a click on
  // the empty part of a row still falls through to the card.
  const stop = (e: React.SyntheticEvent) => {
    const target = e.target as Element;
    const control = target.closest("button, a, input, [role=button]");
    if (!e.currentTarget.contains(target) || (control && e.currentTarget.contains(control))) e.stopPropagation();
  };
  const guard = overlay ? {} : { onPointerDown: stop, onClick: stop, onKeyDown: stop };
  const saveTitle = () => {
    setRenaming(false);
    const next = title.trim();
    if (next && next !== card.title) onPatch({ title: next });
    else setTitle(card.title);
  };

  const hasPills = (show.priority && !!card.priority) || (show.tags && cardTags.length > 0);
  return (
    <article
      className={cn(
        "group/card relative cursor-pointer rounded-xl border bg-card text-[13px] shadow-xs transition-[border-color,box-shadow] hover:border-border-strong hover:shadow-sm",
        selected && "border-primary ring-1 ring-primary hover:border-primary",
        overlay && "rotate-1 shadow-lg",
      )}
    >
      <div className="px-3.5 pt-3 pb-3">
        {/* Priority (just a flag when unset) and labels */}
        {(show.priority || show.tags) && (
          <div className={cn("flex flex-wrap items-center gap-1.5 pr-6", !hasPills && "-mb-1")} {...guard}>
            {show.priority && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild disabled={overlay}>
                  {card.priority ? (
                    <button type="button" className={cn(pill, "cursor-pointer hover:brightness-95", PRIORITY_PILL[card.priority])} aria-label={`${t.quick.priority}: ${t.priority[card.priority]}`}>
                      <PriorityIcon priority={card.priority} /> {t.priority[card.priority]}
                    </button>
                  ) : (
                    <button type="button" title={t.quick.priority} aria-label={t.quick.priority} className="grid size-5 cursor-pointer place-items-center rounded-full bg-muted/70 text-muted-foreground hover:bg-accent hover:text-foreground">
                      <Flag className="size-3" />
                    </button>
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  {PRIORITIES.map((p) => (
                    <DropdownMenuItem key={p} onSelect={() => onPatch({ priority: p })}>
                      <PriorityIcon priority={p} /> {t.priority[p]}
                      {card.priority === p && <Check className="ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => onPatch({ priority: null })}>
                    <Minus className="text-muted-foreground" /> {t.priority.none}
                    {!card.priority && <Check className="ml-auto" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {show.tags && (
              <Popover>
                <PopoverTrigger asChild disabled={overlay}>
                  {cardTags.length ? (
                    <button type="button" aria-label={t.editor.tags} className="flex cursor-pointer flex-wrap items-center gap-1.5 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
                      {cardTags.slice(0, 3).map((tag) => (
                        <TagBadge key={tag.id} tag={tag} className="h-5 rounded-full border-0 bg-muted/70 px-2 hover:bg-accent" />
                      ))}
                      {cardTags.length > 3 && <span className={cn(pill, "text-muted-foreground")}>+{cardTags.length - 3}</span>}
                    </button>
                  ) : (
                    <button type="button" title={t.editor.tags} aria-label={t.editor.tags} className={cn(ghost, "size-5 justify-center rounded-full px-0")}>
                      <TagIcon className="size-3" />
                    </button>
                  )}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-60 p-1">
                  <TagPicker
                    autoFocus
                    options={tags.map((tag) => ({ id: tag.id, name: tag.name, dotClassName: TAG_DOT[tag.color] }))}
                    selected={card.tagIds}
                    onToggle={(id) => onPatch({ tagIds: flip(card.tagIds, id) })}
                    onCreate={onCreateTag}
                    labels={{ search: t.editor.searchTags, add: t.editor.addTag, empty: t.editor.noTags }}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        )}

        {/* Title: click to rename in place */}
        {renaming ? (
          <input
            autoFocus
            value={title}
            aria-label={t.cardMeta.rename}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={saveTitle}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "Escape") {
                setTitle(card.title);
                setRenaming(false);
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="mt-2 -mx-1 w-[calc(100%+0.5rem)] rounded-md bg-muted/60 px-1 text-[14px] leading-6 font-medium outline-none"
          />
        ) : (
          <h3
            title={card.title}
            onPointerDown={overlay ? undefined : (e) => e.stopPropagation()}
            onClick={
              overlay
                ? undefined
                : (e) => {
                    e.stopPropagation();
                    setTitle(card.title);
                    setRenaming(true);
                  }
            }
            className={cn(
              "mt-2 -mx-1 line-clamp-2 cursor-text rounded-md px-1 pr-6 text-[14px] leading-6 font-medium break-words hover:bg-muted/60",
              done && "text-muted-foreground line-through decoration-muted-foreground/60",
            )}
          >
            {card.title}
          </h3>
        )}
        {desc && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{desc}</p>}
      </div>

      <div className="flex min-h-10 items-center gap-2 border-t px-3 py-1.5 text-xs" {...guard}>
        {/* Creator (and Claude) → assignees. When the creator is the only assignee nothing changed
            hands, so they show once and adding people is a hover button. */}
        {show.assignees && (
          <span className="flex items-center gap-1">
            {(creator || claude) && (
              <span className="px-1">
                <CreatorMark creator={creator} claude={claude} />
              </span>
            )}
            {(creator || claude) && !creatorOnly && <ArrowRight className="size-3 text-muted-foreground/70" aria-label={t.cardMeta.assignedTo} />}
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={overlay}>
                {people.length && !creatorOnly ? (
                  <button type="button" className={cn(hit, "px-0.5")} aria-label={t.quick.assignees}>
                    <AvatarStack members={people} size={20} />
                  </button>
                ) : (
                  <button type="button" className={creatorOnly ? ghost : cn(hit, "text-muted-foreground")} aria-label={t.quick.assignees} title={t.quick.assignees}>
                    <UserPlus className="size-3.5" />
                  </button>
                )}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
                {pickable.map((m) => (
                  <DropdownMenuItem
                    key={m.id}
                    onSelect={(e) => {
                      e.preventDefault(); // keep the menu open to pick several people
                      onPatch({ assigneeIds: flip(card.assigneeIds, m.id) });
                    }}
                  >
                    <Avatar member={m} size={20} className="ring-0" />
                    <span className="min-w-0 flex-1 truncate">{displayName(m)}</span>
                    {card.assigneeIds.includes(m.id) && <Check />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </span>
        )}

        <span className="ml-auto flex items-center gap-1">
          {/* Story points */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={overlay}>
              <button type="button" title={t.cardMeta.points} aria-label={t.cardMeta.points} className={cn(card.storyPoints == null ? ghost : cn(hit, "text-muted-foreground"), "tabular-nums")}>
                <Hexagon className="size-3.5" /> {card.storyPoints ?? ""}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel className="text-xs text-muted-foreground">{t.cardMeta.points}</DropdownMenuLabel>
              <div className="grid grid-cols-3 gap-1 p-1">
                {STORY_POINTS.map((n) => (
                  <DropdownMenuItem key={n} onSelect={() => onPatch({ storyPoints: n })} className={cn("justify-center tabular-nums", card.storyPoints === n && "bg-brand-soft text-primary")}>
                    {n}
                  </DropdownMenuItem>
                ))}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => onPatch({ storyPoints: null })}>{t.cardMeta.noPoints}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Deadline */}
          {show.dates && (
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild disabled={overlay}>
                {card.dueDate ? (
                  <button type="button" className={hit} aria-label={t.quick.deadline}>
                    <DueText due={card.dueDate} today={today} done={done} />
                  </button>
                ) : (
                  <button type="button" className={ghost} aria-label={t.quick.deadline} title={t.quick.deadline}>
                    <CalendarPlus className="size-3.5" />
                  </button>
                )}
              </PopoverTrigger>
              <PopoverContent className="w-auto rounded-2xl p-0" align="end">
                <Calendar
                  mode="single"
                  locale={t.locale === "ru" ? ru : enGB}
                  weekStartsOn={1}
                  selected={card.dueDate ? toDate(card.dueDate) : undefined}
                  defaultMonth={card.dueDate ? toDate(card.dueDate) : undefined}
                  onSelect={(d) => {
                    onPatch({ dueDate: d ? toISO(d) : null });
                    setDateOpen(false);
                  }}
                />
                {card.dueDate && (
                  <button
                    type="button"
                    onClick={() => {
                      onPatch({ dueDate: null });
                      setDateOpen(false);
                    }}
                    className="flex w-full cursor-pointer items-center justify-center gap-1 border-t px-3 py-2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" /> {t.quick.clearDeadline}
                  </button>
                )}
              </PopoverContent>
            </Popover>
          )}
        </span>
      </div>
    </article>
  );
}
