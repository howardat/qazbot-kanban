"use client";

import Link from "next/link";
import { CalendarDays, ChartGantt, Columns3 } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { cn } from "@/lib/utils";

type View = "board" | "calendar" | "timeline";

/** Switch between the three views of one board. Calendar and timeline are filtered by ?board=. */
export function ViewTabs({ boardId, active }: { boardId: string; active: View }) {
  const t = useT();
  const tabs = [
    { view: "board" as const, label: t.views.board, href: `/boards/${boardId}`, Icon: Columns3 },
    { view: "calendar" as const, label: t.views.calendar, href: `/calendar?board=${boardId}`, Icon: CalendarDays },
    { view: "timeline" as const, label: t.views.timeline, href: `/timeline?board=${boardId}`, Icon: ChartGantt },
  ];
  return (
    // Plane's layout switcher: a recessed track with the current view raised on it.
    <nav className="inline-flex h-8 items-center gap-0.5 rounded-md bg-muted p-0.5 text-xs" aria-label={t.views.aria}>
      {tabs.map(({ view, label, href, Icon }) => (
        <Link
          key={view}
          href={href}
          aria-current={view === active ? "page" : undefined}
          className={cn(
            "inline-flex h-full items-center gap-1.5 rounded-sm px-2.5 font-medium transition-colors",
            view === active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" />
          {label}
        </Link>
      ))}
    </nav>
  );
}
