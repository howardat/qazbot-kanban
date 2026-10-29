"use client";

import Link from "next/link";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ArrowUpRight, Bot, XIcon } from "lucide-react";
import { useT } from "@/components/I18nProvider";
import { STATUS_COLORS } from "@/components/office/palette";
import { PersonIcon } from "@/components/PersonIcon";
import { WorkerQueue } from "@/components/WorkerQueue";
import { staleness } from "@/lib/staleness";
import { displayName } from "@/lib/types";
import type { Robot, Worker } from "@/lib/workers";


/**
 * Worker card sliding in from the right when someone is clicked in the office. `container` keeps it
 * inside the office element, so it still shows while that element is full screen.
 */
export function WorkerSheet({
  worker,
  robots,
  now,
  container,
  onClose,
}: {
  worker: Worker | null;
  robots: Robot[];
  now: number;
  container: HTMLElement | null;
  onClose: () => void;
}) {
  const t = useT();
  const w = t.workers;
  const mine = worker ? robots.filter((r) => r.profileId === worker.id) : [];
  return (
    <DialogPrimitive.Root open={!!worker} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal container={container}>
        <DialogPrimitive.Overlay className="absolute inset-0 z-40 bg-black/20 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content className="absolute inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l bg-card shadow-2xl outline-none data-open:animate-in data-open:slide-in-from-right data-open:duration-200 data-closed:animate-out data-closed:slide-out-to-right data-closed:duration-150">
          {worker && (
            <>
              <header className="flex items-start gap-3 border-b px-5 py-4">
                <PersonIcon member={worker} size={40} />
                <div className="min-w-0 flex-1">
                  <DialogPrimitive.Title className="truncate text-base font-semibold">{displayName(worker)}</DialogPrimitive.Title>
                  <DialogPrimitive.Description className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className="size-2 shrink-0 rounded-full ring-1 ring-black/10"
                      style={{ background: STATUS_COLORS[staleness(worker.lastUpdate, !worker.current, now)] }}
                      aria-hidden
                    />
                    {worker.room === "lounge" || worker.room === "back_office" ? t.rooms[worker.room] : (worker.current?.boardName ?? t.rooms[worker.room])} ·{" "}
                    {worker.lastUpdate ? w.updated(t.fmt.ago(worker.lastUpdate, now)) : w.neverUpdated}
                  </DialogPrimitive.Description>
                </div>
                <DialogPrimitive.Close
                  aria-label={t.common.close}
                  className="grid size-8 cursor-pointer place-items-center rounded-md text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <XIcon className="size-4" />
                </DialogPrimitive.Close>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <h3 className="px-5 pt-4 pb-1 text-xs font-medium text-muted-foreground">{w.current}</h3>
                <WorkerQueue current={worker.current} queue={worker.queue} />
                {mine.length > 0 && (
                  <>
                    <h3 className="flex items-center gap-1.5 border-t px-5 pt-4 pb-1 text-xs font-medium text-muted-foreground">
                      <Bot className="size-3.5" /> {w.yourRobots}
                    </h3>
                    <ul className="divide-y">
                      {mine.map((r) => (
                        <li key={r.id} className="flex items-baseline gap-3 px-5 py-2 text-sm">
                          <span className="font-medium">{r.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {t.robots.models[r.model]}
                            {r.room && ` · ${t.rooms[r.room]}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              <footer className="border-t px-5 py-3">
                <Link href={`/workers/${worker.id}`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                  {w.openPage} <ArrowUpRight className="size-4" />
                </Link>
              </footer>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
