import { WorkersView } from "@/components/WorkersView";
import { track } from "@/lib/activity";
import { requireUser } from "@/lib/session";
import { loadRobots, loadRoomBoards, loadWorkers } from "@/lib/workers";

export default async function WorkersPage() {
  const user = await requireUser();
  await track(user.id, "workers.view");
  const [workers, robots, roomBoards] = await Promise.all([loadWorkers(user), loadRobots(), loadRoomBoards(user)]);

  // The office fills the whole content area; its title and legend float on top.
  return (
    <main className="h-full">
      <WorkersView workers={workers} robots={robots} roomBoards={roomBoards} />
    </main>
  );
}
