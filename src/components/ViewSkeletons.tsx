"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { ViewBar } from "@/components/ViewTabs";

// Loading screens for a board's three views. Each draws the real view bar, so the view tabs stay
// exactly where they were, and a placeholder shaped like the view that's coming.

const bar = "rounded-md bg-muted";

/** The view bar with a placeholder where the board name goes (a loading screen can't look it up). */
function Bar({ boardId, active }: { boardId: string; active: "board" | "calendar" | "timeline" }) {
  return (
    <ViewBar boardId={boardId} active={active}>
      <div className={`h-5 w-40 ${bar}`} />
    </ViewBar>
  );
}

/** Title, description and controls, like PageHeader. */
function Header() {
  return (
    <div className="flex items-center gap-3 border-b px-4 py-4 md:px-6">
      <div className="mr-auto space-y-2">
        <div className={`h-6 w-44 ${bar}`} />
        <div className={`h-4 w-64 max-w-full ${bar} bg-muted/70`} />
      </div>
      <div className={`hidden h-8 w-56 sm:block ${bar}`} />
    </div>
  );
}

export function BoardSkeleton() {
  const { id } = useParams<{ id: string }>();
  return (
    <main aria-busy="true" className="flex h-full flex-col">
      <div className="border-b">
        <Bar boardId={id} active="board" />
        <div className="flex items-center gap-2 px-4 py-2 md:px-6">
          <div className={`h-7 w-20 ${bar}`} />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="size-6 rounded-full bg-muted" />
          ))}
        </div>
      </div>
      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden px-4 py-4 md:px-6">
        {[4, 3, 2, 3].map((cards, i) => (
          <div key={i} className="w-72 shrink-0 space-y-2 rounded-lg bg-muted/40 p-2">
            <div className={`h-5 w-24 ${bar}`} />
            {Array.from({ length: cards }, (_, j) => (
              <div key={j} className="h-20 animate-pulse rounded-md border bg-card" />
            ))}
          </div>
        ))}
      </div>
    </main>
  );
}

function CalendarInner() {
  const board = useSearchParams().get("board");
  return (
    <>
      {board && <Bar boardId={board} active="calendar" />}
      <Header />
      <div className="px-4 py-5 md:px-6">
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border">
          {Array.from({ length: 35 }, (_, i) => (
            <div key={i} className="h-24 animate-pulse bg-card p-2">
              <div className={`h-3 w-5 ${bar}`} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function TimelineInner() {
  const board = useSearchParams().get("board");
  return (
    <>
      {board && <Bar boardId={board} active="timeline" />}
      <Header />
      <div className="space-y-2 px-4 py-5 md:px-6">
        <div className={`h-8 w-full ${bar} bg-muted/60`} />
        {[30, 55, 20, 45, 35, 60].map((w, i) => (
          <div key={i} className="flex h-8 items-center">
            <div className="h-6 animate-pulse rounded-md bg-muted" style={{ width: `${w}%`, marginLeft: `${(i * 9) % 40}%` }} />
          </div>
        ))}
      </div>
    </>
  );
}

// useSearchParams needs a Suspense boundary of its own.
export function CalendarSkeleton() {
  return (
    <main aria-busy="true">
      <Suspense>
        <CalendarInner />
      </Suspense>
    </main>
  );
}

export function TimelineSkeleton() {
  return (
    <main aria-busy="true">
      <Suspense>
        <TimelineInner />
      </Suspense>
    </main>
  );
}
