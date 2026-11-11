import { TasksView } from "./tasks-view";

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ board?: string }> }) {
  return <TasksView board={(await searchParams).board} layout="board" />;
}
