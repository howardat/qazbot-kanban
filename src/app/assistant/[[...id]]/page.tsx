import { notFound } from "next/navigation";
import { AssistantChat } from "@/components/Assistant";
import { listChats, loadChat } from "@/lib/ai/agent";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/** The assistant's own page: saved chats on the left, the open chat (or a new one) on the right. */
export default async function AssistantPage({ params }: { params: Promise<{ id?: string[] }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (id && (id.length > 1 || !/^[0-9a-f-]{36}$/i.test(id[0]))) notFound();
  const [chats, chat] = await Promise.all([listChats(user), id ? loadChat(user, id[0]) : null]);
  if (id && !chat) notFound();

  return <AssistantChat chats={chats} initial={chat} />;
}
