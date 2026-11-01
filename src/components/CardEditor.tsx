"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { AlignLeft, CalendarClock, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Hexagon, MoreHorizontal, Flag, Tag as TagIcon, Trash2, UserPen, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { createTag, deleteCard, updateCard } from "@/app/actions";
import { Avatar, AvatarStack, halfRow, PEOPLE_MENU } from "@/components/atoms";
import { CreatorMark } from "@/components/BoardCard";
import { CardComments } from "@/components/CardComments";
import { PriorityIcon } from "@/components/BoardToolbar";
import { DatePicker } from "@/components/DatePicker";
import { useT } from "@/components/I18nProvider";
import { useLabelMenu } from "@/components/TagManager";
import { TagSelect } from "@/components/TagSelect";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TAG_DOT } from "@/lib/colors";
import { pointsTone, STORY_POINTS, viaClaude } from "@/lib/card-source";
import { PRIORITIES, type Priority } from "@/lib/priority";
import { TAG_COLORS } from "@/lib/tag-colors";
import { displayName, type CardData, type Member, type Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

const NONE = "none";
// Borderless select trigger for a property row, like Plane's "select-ghost".
const ghostSelect = "h-8 w-full justify-between border-transparent bg-transparent px-2 shadow-none hover:bg-accent dark:bg-transparent";

/** Plane's property row: icon and name in a fixed column, the editable value beside it. */
function Property({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex h-8 w-32 shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        {label}
      </div>
      <div className="flex min-w-0 grow flex-wrap items-center gap-1">{children}</div>
    </div>
  );
}

/** The description as a property value: shown in full, edited in place. */
function Description({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useT();
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t.editor.descriptionPlaceholder}
      aria-label={t.editor.description}
      className="field-sizing-content block min-h-8 w-full resize-none rounded-md bg-transparent px-2 py-1.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground hover:bg-accent/60 focus:bg-accent/60"
    />
  );
}

/**
 * Plane's "side peek": the card opens in a panel on the right half of the screen, over the board,
 * which stays visible. Title and description on top, then the properties list. Changes save on
 * their own, shortly after the last edit and again on close, as in Plane.
 */
export function CardEditor({
  card,
  members,
  boardTags,
  boardName,
  assignable,
  nav,
  onClose,
}: {
  card: CardData;
  /** Where the card sits among the ones on screen, to step to its neighbours from the header. */
  nav?: { index: number; total: number; prev?: () => void; next?: () => void };
  members: Member[];
  /** Who may be newly assigned (a private board's audience); everyone when left out. */
  assignable?: Member[];
  boardTags: Tag[];
  boardName?: string;
  onClose: () => void;
}) {
  const t = useT();
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [startDate, setStartDate] = useState(card.startDate ?? "");
  const [dueDate, setDueDate] = useState(card.dueDate ?? "");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(card.assigneeIds);
  const [tagIds, setTagIds] = useState<string[]>(card.tagIds);
  const [priority, setPriority] = useState<Priority | null>(card.priority);
  const [storyPoints, setStoryPoints] = useState<number | null>(card.storyPoints);
  // Labels made here, until the board's list (which follows renames and deletes) has them.
  const [madeTags, setMadeTags] = useState<Tag[]>([]);
  const tags = [...boardTags, ...madeTags.filter((m) => !boardTags.some((x) => x.id === m.id))];
  const labelMenu = useLabelMenu(tags);
  const [confirming, setConfirming] = useState(false);
  const [, startTransition] = useTransition();

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  const datesInvalid = !!startDate && !!dueDate && startDate > dueDate;
  const assignees = members.filter((m) => assigneeIds.includes(m.id));
  const creator = card.createdBy ? (members.find((m) => m.id === card.createdBy) ?? null) : null;
  const claude = viaClaude(card.createdVia);

  // Everything the card saves, as one string so an unchanged card is cheap to spot.
  const snapshot = JSON.stringify({
    title: title.trim(),
    description,
    startDate: startDate || null,
    dueDate: dueDate || null,
    assigneeIds,
    // A label deleted from its "…" menu while the card is open drops off here.
    tagIds: tagIds.filter((id) => tags.some((x) => x.id === id)),
    priority,
    storyPoints,
  });
  const valid = !datesInvalid && !!title.trim();
  const saved = useRef(snapshot);
  // Saves run one after another, so a slow one can't land after a newer one.
  const queue = useRef<Promise<void>>(Promise.resolve());
  const latest = useRef({ snapshot, valid });
  latest.current = { snapshot, valid };

  const flush = useRef(() => {
    const { snapshot, valid } = latest.current;
    if (!valid || snapshot === saved.current) return;
    saved.current = snapshot;
    queue.current = queue.current.then(() => updateCard(card.id, JSON.parse(snapshot))).catch(() => {
      toast.error(t.editor.saveFailed);
    });
  }).current;

  // Typing settles for a moment before it saves; picks in menus save just as soon.
  useEffect(() => {
    const timer = setTimeout(flush, 600);
    return () => clearTimeout(timer);
  }, [snapshot, flush]);

  // Leaving the card (closing, or stepping to another one) saves what's still waiting.
  useEffect(() => flush, [flush]);

  const close = () => {
    flush();
    onClose();
  };

  // A label typed into the picker that the board doesn't have yet: create it with the next palette colour
  // (recolour it in the label manager) and put it on this card.
  function addTag(name: string) {
    startTransition(async () => {
      const tag = await createTag(card.boardId, { name, color: TAG_COLORS[tags.length % TAG_COLORS.length] });
      setMadeTags((list) => [...list, tag]);
      setTagIds((ids) => [...ids, tag.id]);
    });
  }

  return (
    // Not modal: the board stays scrollable beside the panel; a click outside closes it, as in Plane.
    <DialogPrimitive.Root open modal={false} onOpenChange={(open) => !open && close()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          // Menus and popovers inside the panel render in portals; clicks on them aren't "outside".
          onInteractOutside={(e) => {
            const target = e.target as HTMLElement | null;
            if (target?.closest("[data-radix-popper-content-wrapper], [role=dialog], [data-sonner-toaster]")) e.preventDefault();
          }}
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-card text-sm shadow-[0_4px_8px_rgba(0,0,0,0.12),0_6px_12px_rgba(16,24,40,0.12),0_1px_16px_rgba(16,24,40,0.12)] duration-200 outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right-8 data-[state=open]:fade-in-0 md:w-1/2 md:min-w-[520px]"
        >
          <div className="flex min-h-0 flex-1 flex-col">
            {/* Header bar: close on the left, board name, card menu on the right */}
            <header className="flex h-12 shrink-0 items-center gap-2 border-b px-5">
              <span className="text-sm font-medium">{t.editor.panelTitle}</span>
              <DialogPrimitive.Description className="min-w-0 truncate text-xs text-muted-foreground">{boardName ?? <span className="sr-only">{t.editor.heading}</span>}</DialogPrimitive.Description>
              {nav && nav.total > 1 && (
                <span className="ml-auto flex items-center gap-1">
                  <Button type="button" variant="outline" size="icon-xs" className="rounded-full" disabled={!nav.prev} onClick={nav.prev} aria-label={t.editor.prevCard} title={t.editor.prevCard}>
                    <ChevronLeft />
                  </Button>
                  <Button type="button" variant="outline" size="icon-xs" className="rounded-full" disabled={!nav.next} onClick={nav.next} aria-label={t.editor.nextCard} title={t.editor.nextCard}>
                    <ChevronRight />
                  </Button>
                  <span className="ml-1 text-xs text-muted-foreground tabular-nums">{t.editor.position(nav.index + 1, nav.total)}</span>
                </span>
              )}
              <DialogPrimitive.Close asChild>
                <Button type="button" variant="ghost" size="icon-sm" className={cn(!(nav && nav.total > 1) && "ml-auto")} aria-label={t.common.close} title={t.common.close}>
                  <X />
                </Button>
              </DialogPrimitive.Close>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <DialogPrimitive.Title className="sr-only">{t.editor.heading}</DialogPrimitive.Title>
              <div className="flex items-start gap-2">
                <textarea
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                  required
                  maxLength={200}
                  rows={1}
                  aria-label={t.editor.title}
                  className="field-sizing-content -mx-2 block min-w-0 flex-1 resize-none rounded-md bg-transparent px-2 py-1 text-xl font-semibold outline-none hover:bg-accent focus:bg-accent"
                />
              <DropdownMenu onOpenChange={(open) => !open && setConfirming(false)}>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="icon-sm" className="mt-1 shrink-0" aria-label={t.card.actionsFor(card.title)}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={(e) => {
                      if (!confirming) {
                        e.preventDefault();
                        setConfirming(true);
                        return;
                      }
                      startTransition(async () => {
                        saved.current = latest.current.snapshot; // nothing left to save on a deleted card
                        await deleteCard(card.id);
                        toast(t.editor.deleted);
                        onClose();
                      });
                    }}
                  >
                    <Trash2 /> {confirming ? t.card.confirmDelete : t.card.delete}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              </div>

              <div className="mt-4 space-y-1">
                {/* Read-only: who made the card (and whether through Claude), and when. */}
                <Property icon={UserPen} label={t.editor.creator}>
                  <div className="flex h-8 min-w-0 items-center gap-2 px-2">
                    <CreatorMark creator={creator} claude={claude} />
                    <span className="min-w-0 truncate">
                      {creator ? displayName(creator) : claude ? "Claude" : <span className="text-muted-foreground">{t.editor.unknownCreator}</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{t.fmt.day(card.createdAt.slice(0, 10))}</span>
                  </div>
                </Property>

                <Property icon={Users} label={t.editor.assignees}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label={t.editor.assignees} className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-left outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50">
                        {assignees.length > 0 ? (
                          <>
                            <AvatarStack members={assignees} size={20} />
                            <span className="min-w-0 flex-1 truncate">{assignees.length === 1 ? displayName(assignees[0]) : t.editor.assigneeCount(assignees.length)}</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="size-4 text-muted-foreground" />
                            <span className="flex-1 text-muted-foreground">{t.editor.noAssignees}</span>
                          </>
                        )}
                        <ChevronDown className="size-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent ref={halfRow(5)} align="start" className={cn(PEOPLE_MENU, "w-(--radix-dropdown-menu-trigger-width) min-w-56")}>
                      {members.filter((m) => !assignable || assignable.includes(m) || assigneeIds.includes(m.id)).map((m) => (
                        <DropdownMenuItem
                          key={m.id}
                          onSelect={(e) => {
                            e.preventDefault(); // keep the menu open to pick several people
                            toggle(assigneeIds, setAssigneeIds, m.id);
                          }}
                        >
                          <Avatar member={m} size={20} className="ring-0" />
                          <span className="min-w-0 flex-1 truncate">{displayName(m)}</span>
                          {assigneeIds.includes(m.id) && <Check className="text-brand" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Property>

                <Property icon={Flag} label={t.priority.label}>
                  <Select value={priority ?? NONE} onValueChange={(v) => setPriority(v === NONE ? null : (v as Priority))}>
                    <SelectTrigger aria-label={t.priority.label} className={ghostSelect}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t.priority.none}</SelectItem>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          <PriorityIcon priority={p} /> {t.priority[p]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Property>

                <Property icon={Hexagon} label={t.cardMeta.points}>
                  <Select value={storyPoints ? String(storyPoints) : NONE} onValueChange={(v) => setStoryPoints(v === NONE ? null : Number(v))}>
                    <SelectTrigger aria-label={t.cardMeta.points} className={ghostSelect}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>{t.cardMeta.noPoints}</SelectItem>
                      {STORY_POINTS.map((n) => (
                        <SelectItem key={n} value={String(n)} className={cn("font-medium tabular-nums", pointsTone(n))}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Property>

                <Property icon={CalendarDays} label={t.editor.start}>
                  <DatePicker ghost label={t.editor.start} placeholder={t.editor.start} value={startDate} onChange={setStartDate} invalid={datesInvalid} />
                </Property>
                <Property icon={CalendarClock} label={t.editor.deadline}>
                  <DatePicker ghost label={t.editor.deadline} placeholder={t.editor.deadline} value={dueDate} onChange={setDueDate} accent invalid={datesInvalid} />
                </Property>
                {datesInvalid && <p className="pl-34 text-xs text-destructive">{t.editor.datesInvalid}</p>}

                <Property icon={TagIcon} label={t.editor.tags}>
                  <TagSelect
                    multiple
                    options={tags.map((tag) => ({ id: tag.id, name: tag.name, dotClassName: TAG_DOT[tag.color] }))}
                    selected={tagIds}
                    onToggle={(id) => toggle(tagIds, setTagIds, id)}
                    onCreate={addTag}
                    labels={{ placeholder: t.editor.addTags, search: t.editor.searchTags, add: t.editor.addTag, empty: t.editor.noTags }}
                    optionMenu={labelMenu}
                    className="w-auto max-w-full border-transparent bg-transparent hover:bg-accent [&>svg:last-child]:hidden"
                  />
                </Property>

                <Property icon={AlignLeft} label={t.editor.description}>
                  <Description value={description} onChange={setDescription} />
                </Property>
              </div>

              <CardComments cardId={card.id} members={members} />
            </div>

          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
