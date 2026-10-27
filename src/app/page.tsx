import { updateMyName } from "@/app/actions";
import { HomeLists } from "@/components/HomeLists";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { availabilityOf } from "@/lib/availability";
import { loadBoards, loadCards, loadMembers } from "@/lib/data";
import { diffDays, todayISO } from "@/lib/dates";
import { getT } from "@/lib/i18n/server";
import { track } from "@/lib/activity";
import { requireUser } from "@/lib/session";
import { displayName } from "@/lib/types";
import { byUrgency } from "@/lib/urgency";

/**
 * Home: a greeting, then only what needs you. Everyone gets their cards due today (anything of theirs
 * that's late on top) and this week; admins also get every overdue card on the team. Below, the team
 * in one row by how busy they are; click someone to see their open tasks.
 */
export default async function HomePage() {
  const user = await requireUser();
  await track(user.id, "dashboard.view");
  const t = await getT();
  const d = t.dashboard;
  const today = todayISO();
  const isAdmin = user.role === "admin";
  const [boards, cards, members] = await Promise.all([loadBoards(), loadCards(), loadMembers()]);

  const open = cards.filter((c) => !c.done);
  const urgent = byUrgency(today);
  const isLate = (c: (typeof cards)[number]) => !!c.dueDate && c.dueDate < today;
  const mine = open.filter((c) => c.assigneeIds.includes(user.id));
  const overdueAll = open.filter(isLate).sort(urgent);
  // Admins see late cards (theirs included) in the team-wide list; everyone else gets theirs on top of Today.
  const todayMine = mine.filter((c) => c.dueDate === today || (!isAdmin && isLate(c))).sort(urgent);
  const weekMine = mine
    .filter((c) => c.dueDate && c.dueDate > today && diffDays(c.dueDate, today) < 7)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));

  const mates = members
    .map((member) => {
      const { level, free } = availabilityOf(member, open, today);
      const theirs = open
        .filter((c) => c.assigneeIds.includes(member.id))
        .sort((a, b) => Number(b.inProgress) - Number(a.inProgress) || urgent(a, b));
      return { member, level, free, cards: theirs };
    })
    // Busiest first: who might need a hand.
    .sort((a, b) => a.free - b.free);

  // The four boards with the latest activity (a card moved or added), newest first.
  const recentBoards = boards
    .map((b) => {
      const bc = cards.filter((c) => c.boardId === b.id);
      return {
        ...b,
        total: bc.length,
        done: bc.filter((c) => c.done).length,
        late: bc.filter((c) => !c.done && isLate(c)).length,
        lastAt: bc.reduce<string | null>((max, c) => (!max || c.movedAt > max ? c.movedAt : max), null),
      };
    })
    .sort((a, b) => (b.lastAt ?? "").localeCompare(a.lastAt ?? ""))
    .slice(0, 4);

  const first = displayName(user).split(/\s+/)[0];

  return (
    <main className="w-full space-y-10 px-4 py-8 md:px-8">
      <h1 className="text-[28px] leading-[1.2] font-semibold">{d.welcome(first)}</h1>

      {!user.name && (
        <form action={updateMyName} className="bg-brand-soft-gradient flex flex-wrap items-center gap-3 rounded-lg border p-3 pl-4">
          <label htmlFor="display-name" className="mr-auto text-sm">
            {d.namePrompt}
          </label>
          <Input id="display-name" name="name" required maxLength={80} placeholder={d.namePlaceholder} className="w-56 bg-card" />
          <Button>{d.saveName}</Button>
        </form>
      )}

      <HomeLists
        sections={[
          ...(isAdmin ? [{ key: "overdue", title: d.overdueTitle, hint: d.overdueHint, empty: d.overdueEmpty, cards: overdueAll, showPeople: true, tone: "danger" as const }] : []),
          { key: "today", title: d.todayTitle, empty: d.todayEmpty, cards: todayMine },
          { key: "week", title: d.weekTitle, empty: d.weekEmpty, cards: weekMine },
        ]}
        boards={recentBoards}
        mates={mates}
        members={members}
        today={today}
      />
    </main>
  );
}
