"use client";

import { useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { AgeAvatar, AgeText } from "@/components/AgeRing";
import { AGE_COLORS } from "@/components/office/palette";
import { ageOf, isOutdated } from "@/lib/staleness";
import { displayName } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Worker } from "@/lib/workers";

/**
 * Team panel docked on the right of the office: people who haven't updated their status for 2+ days
 * first (oldest on top), then free and busy people. Collapses to a strip of avatar icons. Clicking
 * someone opens their worker card.
 */
export function WorkersRoster({ workers, now, onSelect }: { workers: Worker[]; now: number; onSelect: (id: string) => void }) {
  const t = useT();
  const w = t.workers;
  const [open, setOpen] = useState(true);
  const byName = (a: Worker, b: Worker) => displayName(a).localeCompare(displayName(b));
  const oldestFirst = (a: Worker, b: Worker) => (ageOf(b.lastUpdate, now) ?? Infinity) - (ageOf(a.lastUpdate, now) ?? Infinity) || byName(a, b);
  const outdated = workers.filter((x) => isOutdated(x.lastUpdate, now)).sort(oldestFirst);
  const recent = workers.filter((x) => !isOutdated(x.lastUpdate, now));
  const free = recent.filter((x) => !x.current).sort(byName);
  const busy = recent.filter((x) => x.current).sort(byName);

  const row = (x: Worker) => (
    <li key={x.id}>
      <button
        type="button"
        onClick={() => onSelect(x.id)}
        title={open ? undefined : `${displayName(x)}${x.current ? `: ${x.current.title}` : ""}`}
        className={cn(
          "flex w-full cursor-pointer items-center gap-2 rounded-md text-left outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40",
          open ? "px-2 py-1.5" : "justify-center p-1",
        )}
      >
        <AgeAvatar member={x} lastUpdate={x.lastUpdate} now={now} size={open ? 24 : 26} />
        {open && (
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-1.5">
              <span className="truncate text-xs font-medium">{displayName(x)}</span>
              <AgeText lastUpdate={x.lastUpdate} now={now} className="ml-auto shrink-0 text-[10px] font-medium tabular-nums" />
            </span>
            <span className="block truncate text-[10px] text-[#c9bfb2]">
              {x.current ? `${x.current.boardName} · ${x.current.title}` : x.lastUpdate ? w.idle : w.neverUpdated}
            </span>
          </span>
        )}
      </button>
    </li>
  );

  const heading = (label: string, count: number, color: string) =>
    open ? (
      <h3 className="flex items-center gap-1.5 px-2 pt-2 pb-0.5 text-[10px] font-semibold tracking-wide uppercase" style={{ color }}>
        <span className="size-1.5 rounded-full" style={{ background: color }} aria-hidden /> {label}
        <span className="ml-auto font-normal text-[#c9bfb2]">{count}</span>
      </h3>
    ) : (
      <div className="mx-auto my-1.5 h-0.5 w-6 rounded-full" style={{ background: color }} aria-label={label} />
    );

  return (
    <aside
      className={cn(
        "pointer-events-auto flex max-h-full flex-col overflow-hidden rounded-lg bg-[#24201c]/90 text-[#f1ebe1] shadow-lg backdrop-blur-sm",
        open ? "w-64" : "w-12",
      )}
      aria-label={w.team}
    >
      <header className={cn("flex items-center gap-2 border-b border-white/10 py-2", open ? "px-3" : "justify-center")}>
        {open && <span className="flex-1 text-sm font-semibold">{w.team}</span>}
        {open && (
          <span className="text-[11px] text-[#c9bfb2]">
            {w.freeCount(free.length)} · {w.busyCount(busy.length)}
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={open ? w.collapseTeam : w.expandTeam}
          title={open ? w.collapseTeam : w.expandTeam}
          className="grid size-7 cursor-pointer place-items-center rounded-md outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40"
        >
          {open ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
        </button>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {heading(w.outdated, outdated.length, AGE_COLORS.stale)}
        {outdated.length ? <ul>{outdated.map(row)}</ul> : open && <p className="px-2 py-1 text-xs text-[#c9bfb2]">{w.noneOutdated}</p>}
        {heading(w.free, free.length, "#8ce99a")}
        {free.length ? <ul>{free.map(row)}</ul> : open && <p className="px-2 py-1 text-xs text-[#c9bfb2]">{w.noneFree}</p>}
        {heading(w.busy, busy.length, "#ffa94d")}
        {busy.length ? <ul>{busy.map(row)}</ul> : open && <p className="px-2 py-1 text-xs text-[#c9bfb2]">{w.noneBusy}</p>}
      </div>
    </aside>
  );
}
