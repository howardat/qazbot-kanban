"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Tag as TagIcon, Trash2 } from "lucide-react";
import { createTag, deleteTag, updateTag } from "@/app/actions";
import { BoardIcon } from "@/components/atoms";
import { useT } from "@/components/I18nProvider";
import type { OptionMenu } from "@/components/TagSelect";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TAG_DOT } from "@/lib/colors";
import { TAG_COLORS, type TagColor } from "@/lib/tag-colors";
import type { Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Board labels, as in Plane's label settings: one row per label (colour, name, delete), and one row to add.
 * Given `boards` (All tasks), every board's labels, grouped under its name, and the add row picks the board.
 */
export function TagManager({ boardId, tags, boards }: { boardId: string; tags: Tag[]; boards?: { id: string; name: string }[] }) {
  const t = useT();
  const groups = boards ? boards.map((b) => ({ board: b, tags: tags.filter((x) => x.boardId === b.id) })).filter((g) => g.tags.length > 0) : null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <TagIcon /> {t.tags.button}
          {tags.length > 0 && <span className="text-[11px] text-muted-foreground tabular-nums">{tags.length}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 overflow-hidden rounded-xl p-0">
        <header className="border-b px-3 py-2.5">
          <h3 className="text-sm font-medium">{groups ? t.tags.allTitle : t.tags.title}</h3>
          <p className="text-xs text-muted-foreground">{groups ? t.tags.allHint : t.tags.hint}</p>
        </header>
        <ul className="max-h-72 overflow-y-auto p-1">
          {groups
            ? groups.map((g) => (
                <li key={g.board.id}>
                  <p className="flex items-center gap-1.5 px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                    <BoardIcon board={g.board} size={14} /> <span className="truncate">{g.board.name}</span>
                  </p>
                  <ul>
                    {g.tags.map((tag) => (
                      <TagRow key={tag.id} tag={tag} />
                    ))}
                  </ul>
                </li>
              ))
            : tags.map((tag) => <TagRow key={tag.id} tag={tag} />)}
          {tags.length === 0 && <li className="px-2 py-4 text-center text-xs text-muted-foreground">{t.tags.empty}</li>}
        </ul>
        <NewTagRow boardId={boardId} boards={boards} />
      </PopoverContent>
    </Popover>
  );
}

/** Colour dot that opens the palette; shared by existing rows and the new-label row. */
function ColorDot({ value, onChange, label }: { value: TagColor; onChange: (c: TagColor) => void; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className={cn("size-3.5 rounded-full", TAG_DOT[value])} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto rounded-lg p-2">
        <ColorPicker
          value={value}
          onChange={(c) => {
            onChange(c);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function TagRow({ tag }: { tag: Tag }) {
  const t = useT();
  const [name, setName] = useState(tag.name);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setName(tag.name), [tag.name]);
  return (
    // Leaving the row disarms a pending delete.
    <li className="group flex items-center gap-1 rounded-md pr-1 hover:bg-muted/60" onMouseLeave={() => setConfirming(false)}>
      <ColorDot value={tag.color} onChange={(c) => updateTag(tag.id, { name: tag.name, color: c })} label={t.tags.changeColor(tag.name)} />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => (name.trim() && name !== tag.name ? updateTag(tag.id, { name, color: tag.color }) : setName(tag.name))}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          if (e.key === "Escape") {
            setName(tag.name);
            e.currentTarget.blur();
          }
        }}
        maxLength={40}
        className="h-7 min-w-0 flex-1 rounded-sm bg-transparent px-1 text-[13px] outline-none focus:bg-card focus:ring-1 focus:ring-border-strong"
        aria-label={t.tags.rename(tag.name)}
      />
      {confirming ? (
        <span className="flex shrink-0 items-center gap-1">
          <Button size="xs" variant="ghost" onClick={() => setConfirming(false)}>
            {t.common.cancel}
          </Button>
          <Button size="xs" variant="destructive" onClick={() => deleteTag(tag.id)}>
            {t.tags.removeEverywhere}
          </Button>
        </span>
      ) : (
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => setConfirming(true)}
          aria-label={t.tags.deleteTag(tag.name)}
          title={t.tags.deleteTag(tag.name)}
          className="text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <Trash2 />
        </Button>
      )}
    </li>
  );
}

/** Plane's inline create: colour, name and Add on one line; Enter adds and stays ready for the next. */
function NewTagRow({ boardId, boards }: { boardId: string; boards?: { id: string; name: string }[] }) {
  const t = useT();
  const [target, setTarget] = useState(boards?.[0]?.id ?? boardId);
  const [name, setName] = useState("");
  const [color, setColor] = useState<TagColor>("sky");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex flex-wrap items-center gap-1 border-t bg-tray p-1.5 pl-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        startTransition(async () => {
          await createTag(target, { name, color });
          setName("");
        });
      }}
    >
      {boards && (
        // Which board the new label goes on: labels belong to one board.
        <Select value={target} onValueChange={setTarget}>
          <SelectTrigger size="sm" aria-label={t.common.board} className="mb-1 w-full bg-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {boards.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                <BoardIcon board={b} size={14} /> {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <ColorDot value={color} onChange={setColor} label={t.tags.color} />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        placeholder={t.tags.newName}
        aria-label={t.tags.newName}
        className="h-7 min-w-0 flex-1 rounded-sm bg-transparent px-1 text-[13px] outline-none placeholder:text-muted-foreground"
      />
      <Button size="xs" disabled={pending || !name.trim()}>
        <Plus /> {t.tags.add}
      </Button>
    </form>
  );
}

export function ColorPicker({ value, onChange }: { value: TagColor; onChange: (c: TagColor) => void }) {
  const t = useT();
  return (
    <div className="flex gap-1.5" role="radiogroup" aria-label={t.tags.color}>
      {TAG_COLORS.map((c) => (
        <button
          type="button"
          key={c}
          role="radio"
          aria-checked={value === c}
          aria-label={t.tags.colors[c]}
          title={t.tags.colors[c]}
          onClick={() => onChange(c)}
          className={cn(
            "size-5 cursor-pointer rounded-full transition",
            TAG_DOT[c],
            value === c ? "ring-2 ring-foreground ring-offset-2 ring-offset-popover" : "hover:scale-110",
          )}
        />
      ))}
    </div>
  );
}

/** A label's "…" menu in the label pickers: rename (Enter or leaving the field saves), recolour, delete. */
export function TagEditPanel({ tag }: { tag: Tag }) {
  const t = useT();
  const [name, setName] = useState(tag.name);
  const [color, setColor] = useState(tag.color);
  const [confirming, setConfirming] = useState(false);
  const rename = () => (name.trim() && name !== tag.name ? updateTag(tag.id, { name, color }) : setName(tag.name));
  return (
    // Keys stay here, so the picker and menus around it don't take them.
    <div className="space-y-2.5" onKeyDown={(e) => e.key !== "Escape" && e.stopPropagation()}>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={rename}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        maxLength={40}
        aria-label={t.tags.rename(tag.name)}
        className="h-8 w-full rounded-md border bg-card px-2 text-[13px] outline-none focus:ring-1 focus:ring-border-strong"
      />
      <ColorPicker
        value={color}
        onChange={(c) => {
          setColor(c);
          updateTag(tag.id, { name: tag.name, color: c });
        }}
      />
      {confirming ? (
        <div className="flex justify-end gap-1">
          <Button size="xs" variant="ghost" onClick={() => setConfirming(false)}>
            {t.common.cancel}
          </Button>
          <Button size="xs" variant="destructive" onClick={() => deleteTag(tag.id)}>
            {t.tags.removeEverywhere}
          </Button>
        </div>
      ) : (
        <Button size="xs" variant="ghost" onClick={() => setConfirming(true)} className="w-full justify-start text-muted-foreground hover:text-destructive">
          <Trash2 /> {t.tags.delete}
        </Button>
      )}
    </div>
  );
}

/** The "…" menu for a board's labels in a TagPicker or TagSelect. */
export function useLabelMenu(tags: Tag[]): OptionMenu {
  const t = useT();
  return {
    label: (o) => t.tags.edit(o.name),
    render: (o) => {
      const tag = tags.find((x) => x.id === o.id);
      return tag && <TagEditPanel key={`${tag.name}:${tag.color}`} tag={tag} />;
    },
  };
}
