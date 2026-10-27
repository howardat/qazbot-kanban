"use client";

import { useEffect, useState, useTransition } from "react";
import { Tag as TagIcon, Trash2 } from "lucide-react";
import { createTag, deleteTag, updateTag } from "@/app/actions";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { TAG_DOT } from "@/lib/colors";
import { TAG_COLORS, type TagColor } from "@/lib/tag-colors";
import type { Tag } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Board tags: rename, recolor, delete, add. */
export function TagManager({ boardId, tags }: { boardId: string; tags: Tag[] }) {
  const t = useT();
  const [name, setName] = useState("");
  const [color, setColor] = useState<TagColor>("sky");
  const [pending, startTransition] = useTransition();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <TagIcon /> {t.tags.button}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 rounded-2xl p-0">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-medium">{t.tags.title}</h3>
          <p className="text-xs text-muted-foreground">{t.tags.hint}</p>
        </div>
        <ul className="max-h-64 space-y-0.5 overflow-y-auto p-2">
          {tags.map((tag) => (
            <TagRow key={tag.id} tag={tag} />
          ))}
          {tags.length === 0 && <li className="px-2 py-3 text-sm text-muted-foreground">{t.tags.empty}</li>}
        </ul>
        <form
          className="space-y-2 border-t p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) return;
            startTransition(async () => {
              await createTag(boardId, { name, color });
              setName("");
            });
          }}
        >
          <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={t.tags.newName} aria-label={t.tags.newName} />
          <div className="flex items-center justify-between gap-2">
            <ColorPicker value={color} onChange={setColor} />
            <Button size="sm" disabled={pending || !name.trim()}>
              {t.tags.add}
            </Button>
          </div>
        </form>
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
    <li className="group flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-muted">
      <Popover>
        <PopoverTrigger asChild>
          <button type="button" aria-label={t.tags.changeColor(tag.name)} className={cn("size-3.5 shrink-0 cursor-pointer rounded-full", TAG_DOT[tag.color])} />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto rounded-xl p-2">
          <ColorPicker value={tag.color} onChange={(c) => updateTag(tag.id, { name: tag.name, color: c })} />
        </PopoverContent>
      </Popover>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== tag.name && updateTag(tag.id, { name, color: tag.color })}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        className="h-7 min-w-0 flex-1 rounded-md bg-transparent px-1 text-sm outline-none focus:bg-card"
        aria-label={t.tags.rename(tag.name)}
      />
      {confirming ? (
        <Button size="xs" variant="destructive" onClick={() => deleteTag(tag.id)}>
          {t.tags.removeEverywhere}
        </Button>
      ) : (
        <Button
          size="icon-xs"
          variant="ghost"
          onClick={() => setConfirming(true)}
          aria-label={t.tags.deleteTag(tag.name)}
          className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Trash2 />
        </Button>
      )}
    </li>
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
