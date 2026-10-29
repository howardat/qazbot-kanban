import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { boards, cards, columns, profiles } from "@/db/schema";
import { visibleBoardIds } from "@/lib/board-access";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const LIMIT = 6;

/** Escapes LIKE wildcards so a typed "%" or "_" matches itself. */
const pattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

export type SearchResults = {
  cards: { id: string; title: string; boardId: string; boardName: string; columnName: string; done: boolean }[];
  boards: { id: string; name: string }[];
  people: { id: string; name: string | null; email: string; image: string | null; avatar: number | null }[];
};

/** Top-bar search: cards by title, boards by name, teammates by name or email. A few of each. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const q = new URL(req.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
  if (!q) return Response.json({ cards: [], boards: [], people: [] } satisfies SearchResults);
  const like = pattern(q);
  // Boards the person may not see stay out of both card and board results.
  const visible = await visibleBoardIds(user);
  const onBoard = visible ? (visible.size ? inArray(boards.id, [...visible]) : sql`false`) : undefined;

  const [cardRows, boardRows, people] = await Promise.all([
    db
      .select({ id: cards.id, title: cards.title, boardId: cards.boardId, boardName: boards.name, columnName: columns.name, done: columns.isDone })
      .from(cards)
      .innerJoin(boards, eq(boards.id, cards.boardId))
      .innerJoin(columns, eq(columns.id, cards.columnId))
      .where(and(ilike(cards.title, like), onBoard))
      // Open cards first, then the most recently moved.
      .orderBy(asc(columns.isDone), desc(cards.columnChangedAt))
      .limit(LIMIT),
    db.select({ id: boards.id, name: boards.name }).from(boards).where(and(ilike(boards.name, like), onBoard)).orderBy(asc(boards.name)).limit(LIMIT),
    db
      .select({ id: profiles.id, name: profiles.name, email: profiles.email, image: profiles.image, avatar: profiles.avatar })
      .from(profiles)
      .where(or(ilike(profiles.name, like), ilike(profiles.email, like)))
      .orderBy(asc(profiles.name))
      .limit(LIMIT),
  ]);

  return Response.json({ cards: cardRows, boards: boardRows, people } satisfies SearchResults);
}
