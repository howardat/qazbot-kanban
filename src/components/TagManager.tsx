"use client";

import { useEffect, useState, useTransition } from "react";
import { Plus, Tag as TagIcon, Trash2 } from "lucide-react";
import { createTag, deleteTag, updateTag } from "@/app/actions";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TAG_DOT } from "@/lib/colors";
import { TAG_COLORS, type TagColor } from "@/lib/tag-colors";
import type { Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Board labels, as in Plane's label settings: one row per label (colour, name, delete), and one row to add. */
export function TagManager({ boardId, tags }: { boardId: string; tags: Tag[] }) {
  const t = useT();
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
          <h3 className="text-sm font-medium">{t.tags.title}</h3>
          <p className="text-xs text-muted-foreground">{t.tags.hint}</p>
        </header>
        <ul className="max-h-72 overflow-y-auto p-1">
          {tags.map((tag) => (
            <TagRow key={tag.id} tag={tag} />
          ))}
          {tags.length === 0 && <li className="px-2 py-4 text-center text-xs text-muted-foreground">{t.tags.empty}</li>}
        </ul>
        <NewTagRow boardId={boardId} />
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
function NewTagRow({ boardId }: { boardId: string }) {
  const t = useT();
  const [name, setName] = useState("");
  const [color, setColor] = useState<TagColor>("sky");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="flex items-center gap-1 border-t bg-tray p-1.5 pl-1"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        startTransition(async () => {
          await createTag(boardId, { name, color });
          setName("");
        });
      }}
    >
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
