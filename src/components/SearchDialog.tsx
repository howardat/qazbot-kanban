"use client";

import { BoardIcon } from "@/components/atoms";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, CircleDot, Loader2, Search } from "lucide-react";
import type { SearchResults } from "@/app/api/search/route";
import { useT } from "@/components/I18nProvider";
import { PersonIcon } from "@/components/PersonIcon";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { displayName } from "@/lib/types";
import { cn } from "@/lib/utils";

type Hit = { key: string; href: string; node: React.ReactNode };

/**
 * Search over cards, boards and teammates, Plane-style: a field on top, results grouped below, arrow
 * keys to move, Enter to open. A card opens on its board with its panel already open.
 */
export function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useT();
  const s = t.search;
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  // Fresh each time it opens.
  useEffect(() => {
    if (open) {
      setQ("");
      setResults(null);
      setActive(0);
    }
  }, [open]);

  // Ask the server a beat after typing stops; a newer query cancels the older request.
  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults(null);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: SearchResults | null) => {
          setResults(data);
          setActive(0);
          setLoading(false);
        })
        .catch(() => {});
    }, 150);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  const groups = useMemo(() => {
    if (!results) return [];
    const cards: Hit[] = results.cards.map((c) => ({
      key: `card:${c.id}`,
      href: `/boards/${c.boardId}?card=${c.id}`,
      node: (
        <>
          {c.done ? <CircleCheck className="size-4 shrink-0 text-success" /> : <CircleDot className="size-4 shrink-0 text-muted-foreground" />}
          <span className={cn("min-w-0 flex-1 truncate", c.done && "text-muted-foreground line-through")}>{c.title}</span>
          <span className="shrink-0 truncate text-xs text-muted-foreground">
            {c.boardName} · {c.columnName}
          </span>
        </>
      ),
    }));
    const boards: Hit[] = results.boards.map((b) => ({
      key: `board:${b.id}`,
      href: `/boards/${b.id}`,
      node: (
        <>
          <BoardIcon board={b} size={20} />
          <span className="min-w-0 flex-1 truncate">{b.name}</span>
        </>
      ),
    }));
    const people: Hit[] = results.people.map((p) => ({
      key: `person:${p.id}`,
      href: `/workers/${p.id}`,
      node: (
        <>
          <PersonIcon member={p} size={20} />
          <span className="min-w-0 flex-1 truncate">{displayName(p)}</span>
          <span className="shrink-0 truncate text-xs text-muted-foreground">{p.email}</span>
        </>
      ),
    }));
    return [
      { label: s.cards, hits: cards },
      { label: s.boards, hits: boards },
      { label: s.people, hits: people },
    ].filter((g) => g.hits.length > 0);
  }, [results, s]);
  const flat = groups.flatMap((g) => g.hits);

  const go = (hit: Hit | undefined) => {
    if (!hit) return;
    onOpenChange(false);
    router.push(hit.href);
  };

  // Keep the highlighted row in view while arrowing through.
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  let index = -1;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="top-[12vh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">{s.title}</DialogTitle>
        <DialogDescription className="sr-only">{s.hint}</DialogDescription>
        <div className="flex items-center gap-2 border-b px-3">
          {loading ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : <Search className="size-4 shrink-0 text-muted-foreground" />}
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(flat.length - 1, i + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                go(flat[active]);
              }
            }}
            placeholder={s.placeholder}
            aria-label={s.title}
            className="h-12 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
          />
          <kbd className="shrink-0 rounded-sm border px-1.5 font-sans text-[10px] text-muted-foreground">Esc</kbd>
        </div>

        <div ref={list} className="max-h-[60vh] overflow-y-auto p-1.5" role="listbox" aria-label={s.title}>
          {!q.trim() && <p className="px-3 py-6 text-center text-xs text-muted-foreground">{s.hint}</p>}
          {q.trim() && results && flat.length === 0 && !loading && <p className="px-3 py-6 text-center text-xs text-muted-foreground">{s.none(q.trim())}</p>}
          {groups.map((g) => (
            <div key={g.label} className="mb-1">
              <div className="px-2.5 pt-2 pb-1 text-[11px] font-medium text-muted-foreground">{g.label}</div>
              {g.hits.map((hit) => {
                index += 1;
                const i = index;
                return (
                  <button
                    key={hit.key}
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    data-index={i}
                    onMouseMove={() => setActive(i)}
                    onClick={() => go(hit)}
                    className={cn("flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm outline-none", i === active && "bg-accent")}
                  >
                    {hit.node}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
