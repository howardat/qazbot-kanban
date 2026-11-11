import { TasksView } from "../tasks-view";

export default async function TasksListPage({ searchParams }: { searchParams: Promise<{ board?: string }> }) {
  return <TasksView board={(await searchParams).board} layout="list" />;
}
