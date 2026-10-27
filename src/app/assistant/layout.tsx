import { TalkProvider } from "@/components/useTalk";

// Talk mode lives here, above the chat page, so starting a new chat (which changes the URL and
// remounts the page) doesn't end the conversation.
export default function AssistantLayout({ children }: { children: React.ReactNode }) {
  return <TalkProvider>{children}</TalkProvider>;
}
