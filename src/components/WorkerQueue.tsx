"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { workOnCard } from "@/app/actions";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WorkerTask } from "@/lib/workers";

/** A person's current card, then their queue; any queued card can be made current. */
export function WorkerQueue({ current, queue }: { current: WorkerTask | null; queue: WorkerTask[] }) {
  const t = useT();
  const [pending, startTransition] = useTransition();
  const workOn = (id: string) =>
    startTransition(async () => {
      if (!(await workOnCard(id))) toast.error(t.workers.workOnFailed);
    });

  return (
    <div>
      {current ? (
        <TaskRow task={current} highlight />
      ) : (
        <p className="px-4 py-4 text-sm text-muted-foreground">{t.workers.noCurrent}</p>
      )}
      <h3 className="border-t bg-muted/40 px-4 py-1.5 text-xs font-medium text-muted-foreground">
        {t.workers.queue} · {queue.length}
      </h3>
      {queue.length === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">{t.workers.noQueue}</p>
      ) : (
        <ol className="divide-y">
          {queue.map((task) => (
            <TaskRow key={task.id} task={task}>
              <Button size="xs" variant="outline" disabled={pending} onClick={() => workOn(task.id)}>
                <Play /> {t.workers.workOn}
              </Button>
            </TaskRow>
          ))}
        </ol>
      )}
    </div>
  );
}

function TaskRow({ task, highlight, children }: { task: WorkerTask; highlight?: boolean; children?: React.ReactNode }) {
  const t = useT();
  return (
    <li className={cn("flex items-center gap-3 px-4 py-2.5 text-sm", highlight && "bg-primary/5")}>
      <div className="min-w-0 flex-1">
        <Link href={`/boards/${task.boardId}`} className={cn("block truncate hover:underline", highlight && "font-semibold")} title={task.title}>
          {task.title}
        </Link>
        <p className="truncate text-xs text-muted-foreground">
          {t.rooms[task.room]} · {task.boardName}
          {task.inProgress && ` · ${t.workers.since(t.fmt.ago(task.since))}`}
          {task.dueDate && ` · ${t.fmt.day(task.dueDate)}`}
        </p>
      </div>
      {children}
    </li>
  );
}
