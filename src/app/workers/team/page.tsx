import Link from "next/link";
import { AlertCircle, CheckCheck, CircleDot, Coffee, LayoutGrid, Users } from "lucide-react";
import { PageHeader, Panel } from "@/components/atoms";
import { PROJECT_COLORS } from "@/components/office/palette";
import { PersonIcon } from "@/components/PersonIcon";
import { WorkersTabs } from "@/components/WorkersTabs";
import { track } from "@/lib/activity";
import { availabilityOf, LEVEL_BAR, LEVEL_TEXT } from "@/lib/availability";
import { loadCards } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";
import { PROJECTS } from "@/lib/projects";
import { requireUser } from "@/lib/session";
import { displayName } from "@/lib/types";
import { cn } from "@/lib/utils";
import { loadDoneCounts, loadWorkers } from "@/lib/workers";

// The classic counterpart of the 3D office: summary numbers, who sits in which room, and one row per
// person with their availability, current task and workload.
export default async function TeamPage() {
  const user = await requireUser();
  await track(user.id, "workers.view");
  const t = await getT();
  const w = t.workers;
  const today = todayISO();
  const [workers, cards, done30] = await Promise.all([loadWorkers(), loadCards(), loadDoneCounts(new Date(Date.now() - 30 * 86_400_000))]);
  const open = cards.filter((c) => !c.done);

  const rows = workers
    .map((wk) => ({ wk, a: availabilityOf(wk, open, today), done: done30.get(wk.id) ?? 0 }))
    .sort((x, y) => Number(!!y.wk.current) - Number(!!x.wk.current) || x.a.free - y.a.free || displayName(x.wk).localeCompare(displayName(y.wk)));
  const working = workers.filter((x) => x.current).length;
  const lateCards = open.filter((c) => c.dueDate && c.dueDate < today && c.assigneeIds.length > 0).length;
  const doneTotal = [...done30.values()].reduce((n, v) => n + v, 0);
  const rooms = [...PROJECTS.map((p) => ({ key: p, label: t.projects[p], color: PROJECT_COLORS[p] })), { key: "lounge", label: t.rooms.lounge, color: "#9a918a" }].map(
    (r) => ({ ...r, n: workers.filter((x) => x.room === r.key).length }),
  );
  const roomMax = Math.max(1, ...rooms.map((r) => r.n));

  const stats = [
    { label: w.stats.people, value: workers.length, Icon: Users },
    { label: w.stats.working, value: working, Icon: CircleDot },
    { label: w.stats.free, value: workers.length - working, Icon: Coffee },
    { label: w.stats.late, value: lateCards, Icon: AlertCircle, bad: lateCards > 0 },
    { label: w.stats.done30, value: doneTotal, Icon: CheckCheck },
  ];
  const c = w.columns;

  return (
    <main>
      <PageHeader title={w.teamTitle} description={w.teamDescription} actions={<WorkersTabs active="team" />} />
      <div className="space-y-4 px-4 py-5 md:px-6">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {stats.map(({ label, value, Icon, bad }) => (
            <Panel key={label} icon={<Icon />} title={label}>
              <div className={cn("p-4 text-2xl font-semibold tracking-tight tabular-nums", bad && "text-destructive")}>{value}</div>
            </Panel>
          ))}
        </div>

        <Panel icon={<LayoutGrid />} title={w.byProject}>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-2.5 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {rooms.map((r) => (
              <li key={r.key} className="flex items-center gap-3 text-sm">
                <span className="w-44 shrink-0 truncate">{r.label}</span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span className="block h-full rounded-full" style={{ width: `${(r.n / roomMax) * 100}%`, background: r.color }} />
                </span>
                <span className="w-5 text-right tabular-nums text-muted-foreground">{r.n}</span>
              </li>
            ))}
          </ul>
        </Panel>

        <section className="overflow-hidden rounded-lg border bg-card shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">{c.person}</th>
                  <th className="px-4 py-2.5 font-medium">{c.status}</th>
                  <th className="px-4 py-2.5 font-medium">{c.current}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{c.queue}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{c.late}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{c.soon}</th>
                  <th className="px-3 py-2.5 text-right font-medium">{c.done}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{c.updated}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map(({ wk, a, done }) => (
                  <tr key={wk.id} className="hover:bg-accent/50">
                    <td className="px-4 py-2.5">
                      <Link href={`/workers/${wk.id}`} className="flex items-center gap-2.5 font-medium hover:underline">
                        <PersonIcon member={wk} size={28} />
                        <span className="truncate">{displayName(wk)}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <span className={cn("block h-full rounded-full", LEVEL_BAR[a.level])} style={{ width: `${Math.max(a.free, 4)}%` }} />
                        </span>
                        <span className={cn("text-xs font-medium whitespace-nowrap", LEVEL_TEXT[a.level])}>{t.dashboard.levels[a.level]}</span>
                      </div>
                    </td>
                    <td className="max-w-72 px-4 py-2.5">
                      {wk.current ? (
                        <Link href={`/boards/${wk.current.boardId}`} className="flex items-center gap-2 hover:underline">
                          <span className="size-2 shrink-0 rounded-full" style={{ background: PROJECT_COLORS[wk.current.project] }} aria-hidden />
                          <span className="truncate">{wk.current.title}</span>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{w.idle}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{wk.queue.length || w.nothing}</td>
                    <td className={cn("px-3 py-2.5 text-right tabular-nums", a.late > 0 && "font-medium text-destructive")}>{a.late || w.nothing}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{a.soon || w.nothing}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{done || w.nothing}</td>
                    <td className="px-4 py-2.5 text-right text-xs whitespace-nowrap text-muted-foreground">
                      {wk.lastUpdate ? t.fmt.ago(wk.lastUpdate) : w.nothing}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
