import Link from "next/link";
import { notFound } from "next/navigation";
import { Bot, ChevronLeft, CircleDot, NotebookPen, Trophy } from "lucide-react";
import { z } from "zod";
import { Avatar, PageHeader, Panel } from "@/components/atoms";
import { EmployeeNotes } from "@/components/EmployeeNotes";
import { WorkerQueue } from "@/components/WorkerQueue";
import { track } from "@/lib/activity";
import { addDays, startOfWeek, todayISO, weekday } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";
import { requireUser } from "@/lib/session";
import { displayName } from "@/lib/types";
import { cn } from "@/lib/utils";
import { loadDoneByDay, loadNotes, loadRobots, loadWorkers } from "@/lib/workers";

const LEVELS = ["bg-muted", "bg-primary/25", "bg-primary/50", "bg-primary/75", "bg-primary"];

export default async function WorkerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [worker] = await loadWorkers(id);
  if (!worker) notFound();
  await track(user.id, "worker.view");
  const t = await getT();
  const w = t.workers;
  const isAdmin = user.role === "admin";

  // GitHub-style grid: 53 week columns ending this week, Monday on top.
  const today = todayISO();
  const first = startOfWeek(addDays(today, -364));
  // A day of slack on the lower bound covers the app time zone being ahead of UTC.
  const [done, notes, allRobots] = await Promise.all([
    loadDoneByDay(worker.id, new Date(Date.parse(`${first}T00:00:00Z`) - 86_400_000)),
    isAdmin ? loadNotes(worker.id) : Promise.resolve([]),
    loadRobots(),
  ]);
  const myRobots = allRobots.filter((r) => r.profileId === worker.id);
  const days = Array.from({ length: 53 * 7 }, (_, i) => addDays(first, i)).filter((d) => d <= today);
  const total = days.reduce((n, d) => n + (done[d] ?? 0), 0);
  const peak = Math.max(1, ...days.map((d) => done[d] ?? 0));
  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / peak) * 4)));

  return (
    <main>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <Avatar member={worker} size={32} />
            {displayName(worker)}
          </span>
        }
        description={worker.lastUpdate ? w.updated(t.fmt.ago(worker.lastUpdate)) : w.neverUpdated}
        actions={
          <Link href="/workers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" /> {w.back}
          </Link>
        }
      />
      <div className="space-y-4 px-4 py-5 md:px-6">
        <Panel icon={<CircleDot />} title={w.current}>
          <WorkerQueue current={worker.current} queue={worker.queue} />
        </Panel>

        {myRobots.length > 0 && (
          <Panel icon={<Bot />} title={w.yourRobots}>
            <ul className="divide-y">
              {myRobots.map((r) => (
                <li key={r.id} className="flex items-baseline gap-3 px-4 py-2.5 text-sm">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t.robots.models[r.model]}
                    {r.project && ` · ${t.projects[r.project]}`}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Panel icon={<Trophy />} title={w.productivity} action={<span className="text-xs tabular-nums">{w.finished(total)}</span>}>
          <div className="overflow-x-auto px-4 py-4">
            <div className="grid w-max grid-flow-col grid-rows-7 gap-[3px]">
              {/* Blank cells push the first week down to its weekday */}
              {Array.from({ length: weekday(first) }, (_, i) => (
                <span key={`pad-${i}`} />
              ))}
              {days.map((d) => {
                const n = done[d] ?? 0;
                return <span key={d} title={w.dayCount(n, t.fmt.dayYear(d))} className={cn("size-[11px] rounded-[2px]", LEVELS[level(n)])} />;
              })}
            </div>
            <div className="mt-2 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
              {w.scaleLess}
              {LEVELS.map((c) => (
                <span key={c} className={cn("size-[11px] rounded-[2px]", c)} aria-hidden />
              ))}
              {w.scaleMore}
            </div>
          </div>
        </Panel>

        {isAdmin && (
          <Panel icon={<NotebookPen />} title={w.notes} action={<span className="text-xs">{w.notesHint}</span>}>
            <EmployeeNotes
              profileId={worker.id}
              notes={notes.map((n) => ({
                id: n.id,
                text: n.text,
                when: t.fmt.stamp(n.createdAt),
                author: n.author ? displayName(n.author) : w.unknownAuthor,
              }))}
            />
          </Panel>
        )}
      </div>
    </main>
  );
}
