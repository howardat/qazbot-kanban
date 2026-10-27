import { BoardView } from "./board-view";

export default async function BoardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BoardView id={id} layout="board" />;
}
