import "server-only";
import { and, asc, count, countDistinct, desc, eq, gte, inArray, max, sql } from "drizzle-orm";
import { db } from "@/db";
import { activityEvents, boards, cardAssignees, cards, columns, employeeNotes, profiles, robots } from "@/db/schema";
import { CARD_DONE, FEATURES } from "@/lib/activity";
import { loadMembers } from "@/lib/data";
import { visibleBoardIds, type Viewer } from "@/lib/board-access";
import type { RobotModel, WorkRoom } from "@/lib/rooms";
import type { Member } from "@/lib/types";

const TZ = process.env.APP_TIMEZONE ?? "Asia/Almaty";

export type WorkerTask = {
  id: string;
  title: string;
  boardId: string;
  boardName: string;
  /** The board's room on the workers view. */
  room: WorkRoom;
  dueDate: string | null;
  inProgress: boolean;
  /** When the card entered its current column (ISO). */
  since: string;
};

/**
 * Where someone is on the workers view: the room of the board holding the in-progress card they were
 * most recently assigned to, or the lounge when nothing of theirs is in progress.
 */
export type Room = WorkRoom | "lounge";

export type Worker = Member & {
  /** The one card they're working on: their most recently moved in-progress card. */
  current: WorkerTask | null;
  /** Everything else open: other in-progress cards first (newest move first), then the rest by due date. */
  queue: WorkerTask[];
  room: Room;
  /** Last time any card assigned to them changed column (ISO), or null if they have none. */
  lastUpdate: string | null;
};

export type Robot = { id: string; name: string; model: RobotModel; room: WorkRoom | null; profileId: string | null };

/**
 * Every person (or one) with their current task, queue and room, for the workers view. Tasks on
 * boards the viewer can't see are left out of current and queue; the room still counts them.
 */
export async function loadWorkers(viewer: Viewer, profileId?: string): Promise<Worker[]> {
  const base = db
    .select({
      profileId: cardAssignees.profileId,
      id: cards.id,
      title: cards.title,
      boardId: cards.boardId,
      boardName: boards.name,
      room: boards.room,
      assignedAt: cardAssignees.assignedAt,
      dueDate: cards.dueDate,
      changedAt: cards.columnChangedAt,
      inProgress: columns.isInProgress,
      done: columns.isDone,
    })
    .from(cardAssignees)
    .innerJoin(cards, eq(cards.id, cardAssignees.cardId))
    .innerJoin(columns, eq(columns.id, cards.columnId))
    .innerJoin(boards, eq(boards.id, cards.boardId))
    .orderBy(desc(cards.columnChangedAt));
  const [members, rows, visible] = await Promise.all([
    loadMembers(),
    profileId ? base.where(eq(cardAssignees.profileId, profileId)) : base,
    visibleBoardIds(viewer),
  ]);
  const task = (r: (typeof rows)[number]): WorkerTask => ({
    id: r.id,
    title: r.title,
    boardId: r.boardId,
    boardName: r.boardName,
    room: r.room,
    dueDate: r.dueDate,
    inProgress: r.inProgress,
    since: r.changedAt.toISOString(),
  });

  return members
    .filter((m) => !profileId || m.id === profileId)
    .map((m) => {
      const all = rows.filter((r) => r.profileId === m.id);
      const latest = all
        .filter((r) => r.inProgress && !r.done)
        .reduce<(typeof all)[number] | null>((best, r) => (!best || r.assignedAt > best.assignedAt ? r : best), null);
      const mine = visible ? all.filter((r) => visible.has(r.boardId)) : all;
      const open = mine.filter((r) => !r.done);
      const [current, ...otherInProgress] = open.filter((r) => r.inProgress).map(task);
      const waiting = open
        .filter((r) => !r.inProgress)
        .map(task)
        .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"));
      return {
        ...m,
        current: current ?? null,
        queue: [...otherInProgress, ...waiting],
        room: latest?.room ?? "lounge",
        lastUpdate: mine[0]?.changedAt.toISOString() ?? null,
      };
    });
}

export async function loadRobots(): Promise<Robot[]> {
  return db
    .select({ id: robots.id, name: robots.name, model: robots.model, room: robots.room, profileId: robots.profileId })
    .from(robots)
    .orderBy(asc(robots.name));
}

/** Cards finished per day ("YYYY-MM-DD" in the app time zone) since `since`, for the productivity grid. */
export async function loadDoneByDay(profileId: string, since: Date): Promise<Record<string, number>> {
  const day = sql<string>`to_char(timezone(${TZ}, ${activityEvents.at} at time zone 'UTC'), 'YYYY-MM-DD')`;
  const rows = await db
    .select({ day, n: count() })
    .from(activityEvents)
    .where(and(eq(activityEvents.profileId, profileId), eq(activityEvents.kind, CARD_DONE), gte(activityEvents.at, since)))
    // By position: the time zone is a bound parameter, so repeating the expression wouldn't match it.
    .groupBy(sql`1`);
  return Object.fromEntries(rows.map((r) => [r.day, r.n]));
}

export async function loadNotes(profileId: string) {
  const rows = await db
    .select({ id: employeeNotes.id, text: employeeNotes.text, createdAt: employeeNotes.createdAt, authorId: employeeNotes.authorId })
    .from(employeeNotes)
    .where(eq(employeeNotes.profileId, profileId))
    .orderBy(desc(employeeNotes.createdAt));
  const authorIds = [...new Set(rows.flatMap((r) => (r.authorId ? [r.authorId] : [])))];
  const authors = authorIds.length
    ? await db.select({ id: profiles.id, name: profiles.name, email: profiles.email, image: profiles.image }).from(profiles).where(inArray(profiles.id, authorIds))
    : [];
  const byId = new Map(authors.map((a) => [a.id, a]));
  return rows.map((r) => ({ ...r, author: r.authorId ? (byId.get(r.authorId) ?? null) : null }));
}

/** Use of every registered feature since `since`; features nobody used come first. */
export async function loadFeatureUsage(since: Date) {
  const rows = await db
    .select({ kind: activityEvents.kind, uses: count(), people: countDistinct(activityEvents.profileId), last: max(activityEvents.at) })
    .from(activityEvents)
    .where(and(gte(activityEvents.at, since), inArray(activityEvents.kind, [...FEATURES])))
    .groupBy(activityEvents.kind);
  const byKind = new Map(rows.map((r) => [r.kind, r]));
  return FEATURES.map((f) => {
    const r = byKind.get(f);
    return { feature: f, uses: r?.uses ?? 0, people: r?.people ?? 0, last: r?.last ?? null };
  }).sort((a, b) => a.uses - b.uses || a.feature.localeCompare(b.feature));
}

/** Cards each person finished since `since` ("card.done" credits), by profile id. */
export async function loadDoneCounts(since: Date): Promise<Map<string, number>> {
  const rows = await db
    .select({ profileId: activityEvents.profileId, n: count() })
    .from(activityEvents)
    .where(and(eq(activityEvents.kind, CARD_DONE), gte(activityEvents.at, since)))
    .groupBy(activityEvents.profileId);
  return new Map(rows.flatMap((r) => (r.profileId ? [[r.profileId, r.n] as const] : [])));
}
