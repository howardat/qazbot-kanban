"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, Flag, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { createTag, deleteCard, updateCard } from "@/app/actions";
import { Avatar, AvatarStack, TagBadge } from "@/components/atoms";
import { DatePicker } from "@/components/DatePicker";
import { useT } from "@/components/I18nProvider";
import { ColorPicker } from "@/components/TagManager";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TAG_STYLE } from "@/lib/colors";
import { PRIORITIES, PRIORITY_STYLE, type Priority } from "@/lib/priority";
import { PROJECTS, type Project } from "@/lib/projects";
import type { TagColor } from "@/lib/tag-colors";
import { displayName, type CardData, type Member, type Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

const NO_PROJECT = "none";

export function CardEditor({
  card,
  members,
  boardTags,
  boardName,
  onClose,
}: {
  card: CardData;
  members: Member[];
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
  const [project, setProject] = useState<Project | null>(card.project);
  const [priority, setPriority] = useState<Priority | null>(card.priority);
  const [tags, setTags] = useState<Tag[]>(boardTags);
  const [newTag, setNewTag] = useState("");
  const [newTagColor, setNewTagColor] = useState<TagColor>("sky");
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((x) => x !== value) : [...list, value]);
  const datesInvalid = !!startDate && !!dueDate && startDate > dueDate;
  const assignees = members.filter((m) => assigneeIds.includes(m.id));

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (datesInvalid) return;
    startTransition(async () => {
      try {
        await updateCard(card.id, {
          title,
          description,
          startDate: startDate || null,
          dueDate: dueDate || null,
          assigneeIds,
          tagIds,
          project,
          priority,
        });
        toast.success(t.editor.saved);
        onClose();
      } catch {
        toast.error(t.editor.saveFailed);
      }
    });
  }

  function addTag() {
    const n = newTag.trim();
    if (!n) return;
    const existing = tags.find((tag) => tag.name.toLowerCase() === n.toLowerCase());
    if (existing) {
      if (!tagIds.includes(existing.id)) setTagIds([...tagIds, existing.id]);
      setNewTag("");
      return;
    }
    startTransition(async () => {
      const tag = await createTag(card.boardId, { name: n, color: newTagColor });
      setTags((list) => [...list, tag]);
      setTagIds((ids) => [...ids, tag.id]);
      setNewTag("");
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden rounded-3xl p-0 sm:max-w-2xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="bg-aurora relative h-16 shrink-0" aria-hidden>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/30 dark:to-black/40" />
        </div>
        <form onSubmit={save} className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Header and footer stay put; only the fields scroll when the card is taller than the screen. */}
          <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="px-6 pt-5 pb-4">
            {boardName && <DialogDescription className="mb-1">{boardName}</DialogDescription>}
            <DialogTitle className="sr-only">{t.editor.heading}</DialogTitle>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              maxLength={200}
              className="-ml-1 w-full rounded-lg bg-transparent px-1 text-xl font-semibold tracking-tight outline-none focus:bg-muted"
              aria-label={t.editor.title}
            />
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 px-6 pb-6 md:grid-cols-[minmax(0,1fr)_14rem]">
            <div className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="card-desc" className="text-muted-foreground">
                  {t.editor.description}
                </Label>
                <Textarea
                  id="card-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  placeholder={t.editor.descriptionPlaceholder}
                  className="min-h-32 resize-y rounded-xl"
                />
              </div>

              <fieldset className="min-w-0 space-y-2 rounded-2xl border bg-tray p-3">
                <legend className="sr-only">{t.editor.tags}</legend>
                <div className="text-sm font-medium text-muted-foreground">{t.editor.tags}</div>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const on = tagIds.includes(tag.id);
                    return (
                      <button
                        type="button"
                        key={tag.id}
                        aria-pressed={on}
                        onClick={() => toggle(tagIds, setTagIds, tag.id)}
                        className={cn(
                          "inline-flex h-6 cursor-pointer items-center gap-1 rounded-md border px-2 text-xs font-medium transition",
                          on ? cn(TAG_STYLE[tag.color], "border-current/25") : "bg-card text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {on && <Check className="size-3" />}
                        {tag.name}
                      </button>
                    );
                  })}
                  {tags.length === 0 && <span className="text-xs text-muted-foreground">{t.editor.noTags}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addTag();
                      }
                    }}
                    maxLength={40}
                    placeholder={t.editor.newTag}
                    className="h-8 w-36 rounded-lg bg-card"
                    aria-label={t.editor.newTagAria}
                  />
                  <ColorPicker value={newTagColor} onChange={setNewTagColor} />
                  <Button type="button" size="sm" variant="outline" onClick={addTag} disabled={!newTag.trim() || pending}>
                    <Plus /> {t.common.add}
                  </Button>
                </div>
                {newTag.trim() && (
                  <div className="text-xs text-muted-foreground">
                    {t.editor.preview} <TagBadge tag={{ name: newTag.trim(), color: newTagColor }} />
                  </div>
                )}
              </fieldset>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">{t.editor.assignees}</div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={t.editor.assignees}
                      className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-md border border-input bg-transparent px-2.5 text-left text-sm outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
                    >
                      {assignees.length > 0 ? (
                        <>
                          <AvatarStack members={assignees} size={20} />
                          <span className="min-w-0 flex-1 truncate">
                            {assignees.length === 1 ? displayName(assignees[0]) : t.editor.assigneeCount(assignees.length)}
                          </span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="size-4 text-muted-foreground" />
                          <span className="flex-1 text-muted-foreground">{t.editor.noAssignees}</span>
                        </>
                      )}
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="max-h-72 w-(--radix-dropdown-menu-trigger-width) min-w-56 overflow-y-auto">
                    {members.map((m) => (
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
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">{t.priority.label}</div>
                <Select value={priority ?? NO_PROJECT} onValueChange={(v) => setPriority(v === NO_PROJECT ? null : (v as Priority))}>
                  <SelectTrigger aria-label={t.priority.label} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT}>{t.priority.none}</SelectItem>
                    {PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p}>
                        <Flag className={PRIORITY_STYLE[p]} /> {t.priority[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">{t.editor.project}</div>
                <Select value={project ?? NO_PROJECT} onValueChange={(v) => setProject(v === NO_PROJECT ? null : (v as Project))}>
                  <SelectTrigger aria-label={t.editor.project} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_PROJECT}>{t.editor.noProject}</SelectItem>
                    {PROJECTS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {t.projects[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">{t.editor.dates}</div>
                <DatePicker label={t.editor.start} placeholder={t.editor.start} value={startDate} onChange={setStartDate} invalid={datesInvalid} />
                <DatePicker label={t.editor.deadline} placeholder={t.editor.deadline} value={dueDate} onChange={setDueDate} accent invalid={datesInvalid} />
                {datesInvalid && <p className="text-xs text-destructive">{t.editor.datesInvalid}</p>}
              </div>
            </div>
          </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-tray px-6 py-3">
            {confirming ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t.editor.confirmDelete}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await deleteCard(card.id);
                      toast(t.editor.deleted);
                      onClose();
                    })
                  }
                >
                  {t.card.delete}
                </Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                  {t.common.keep}
                </Button>
              </div>
            ) : (
              <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirming(true)}>
                <Trash2 /> {t.common.delete}
              </Button>
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t.common.cancel}
              </Button>
              <Button disabled={pending || datesInvalid}>{t.editor.save}</Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
