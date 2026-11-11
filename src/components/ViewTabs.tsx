"use client";

import { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, ChartGantt, Columns3, List, Loader2 } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { TabLink, TabsNav } from "@/components/ui/tabs";

export type View = "list" | "board" | "calendar" | "timeline";

// A full prefetch: the page's data too, not just up to its loading screen. Next types `kind` as an
// internal enum, so the string goes through a cast.
const FULL = { kind: "full" } as unknown as Parameters<ReturnType<typeof useRouter>["prefetch"]>[1];

/**
 * Top row of a board's views: the board on the left, the view switcher always at the right edge of
 * the same row, so it stays put when you switch views. Without a board it's All tasks' row.
 */
export function ViewBar({
  boardId,
  active,
  children,
  actions,
  pickedBoard,
}: {
  /** null: every board's views (All tasks). */
  boardId: string | null;
  active: View;
  /** All tasks only: the board picked in its filter, kept when switching views. */
  pickedBoard?: string | null;
  children?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-13 flex-wrap items-center gap-3 border-b px-4 py-2 md:px-6">
      {children}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {actions}
        <ViewTabs boardId={boardId} active={active} pickedBoard={pickedBoard} />
      </div>
    </div>
  );
}

/**
 * Switch between a board's views, in Plane's order. Calendar and timeline are filtered by ?board=.
 * Without a board, All tasks' views: every board's cards as a list, board, calendar or timeline.
 */
export function ViewTabs({ boardId, active, pickedBoard }: { boardId: string | null; active: View; pickedBoard?: string | null }) {
  const t = useT();
  const router = useRouter();
  const q = pickedBoard ? `?board=${pickedBoard}` : "";
  const tabs = boardId
    ? [
        { view: "list" as const, label: t.views.list, href: `/boards/${boardId}/list`, Icon: List },
        { view: "board" as const, label: t.views.board, href: `/boards/${boardId}`, Icon: Columns3 },
        { view: "calendar" as const, label: t.views.calendar, href: `/calendar?board=${boardId}`, Icon: CalendarDays },
        { view: "timeline" as const, label: t.views.timeline, href: `/timeline?board=${boardId}`, Icon: ChartGantt },
      ]
    : [
        { view: "list" as const, label: t.views.list, href: `/tasks/list${q}`, Icon: List },
        { view: "board" as const, label: t.views.board, href: `/tasks${q}`, Icon: Columns3 },
        { view: "calendar" as const, label: t.views.calendar, href: `/calendar${q}`, Icon: CalendarDays },
        { view: "timeline" as const, label: t.views.timeline, href: `/timeline${q}`, Icon: ChartGantt },
      ];
  return (
    <TabsNav aria-label={t.views.aria}>
      {tabs.map(({ view, label, href, Icon }) => (
        <TabLink
          key={view}
          href={href}
          active={view === active}
          // Fetch the view while the pointer is on its tab, so the click usually lands on a ready page.
          // Only on hover: prefetching every view of every board would run their queries for nothing.
          prefetch={false}
          onMouseEnter={() => view !== active && router.prefetch(href, FULL)}
          onFocus={() => view !== active && router.prefetch(href, FULL)}
          aria-label={label}
          title={label}
          className="px-2"
        >
          <TabIcon Icon={Icon} />
        </TabLink>
      ))}
    </TabsNav>
  );
}

/** The tab's icon, swapped for a spinner while its page is on the way. */
function TabIcon({ Icon }: { Icon: React.ComponentType<{ className?: string }> }) {
  const { pending } = useLinkStatus();
  return pending ? <Loader2 className="size-3.5 animate-spin" /> : <Icon className="size-3.5" />;
}
