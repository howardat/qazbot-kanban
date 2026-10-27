import { BoardView } from "../board-view";

/** Plane's list layout of the same board. */
export default async function BoardListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BoardView id={id} layout="list" />;
}
