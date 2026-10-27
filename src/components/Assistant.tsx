"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowUp,
  AudioLines,
  Check,
  CircleAlert,
  Loader2,
  MessagesSquare,
  Mic,
  Pencil,
  Search,
  Sparkles,
  Square,
  SquarePen,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { deleteChat, renameChat } from "@/app/assistant/actions";
import { useT } from "@/components/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useVoice } from "@/components/useVoice";
import type { AgentEvent, CallInfo, ChatSummary, ChatView } from "@/lib/ai/agent";
import type { ModelPrice, Tier } from "@/lib/ai/models";
import { cn } from "@/lib/utils";

type Config = {
  configured: boolean;
  defaultModel: string;
  tiers: { tier: Tier; models: { id: string; label: string }[] }[];
  prices: Record<string, ModelPrice>;
  monthUsd: number;
  budgetUsd: number | null;
};

const MODEL_KEY = "qazbot:assistant-model";
const SPEAK_KEY = "qazbot:assistant-speak";
const HANDS_FREE_KEY = "qazbot:assistant-hands-free";

/** What one turn produced, for reading it aloud: the assistant's words and any changes it proposed. */
type Turn = { texts: string[]; proposed: { summary: string; destructive: boolean }[] };

/** "yes", "no", or null for an answer to a proposed change. Whole words only, and "no" wins a tie. */
function yesOrNo(heard: string, yes: string[], no: string[]): boolean | null {
  const text = ` ${heard.toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, " ").replace(/\s+/g, " ").trim()} `;
  const has = (words: string[]) => words.some((w) => text.includes(` ${w} `));
  if (has(no)) return false;
  return has(yes) ? true : null;
}
const read = <T,>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};
const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  } catch {}
};

/** The assistant page: saved chats on the left, the open conversation on the right. */
export function AssistantChat({ chats, initial }: { chats: ChatSummary[]; initial: ChatView | null }) {
  const t = useT();
  const a = t.assistant;
  const router = useRouter();
  const [config, setConfig] = useState<Config | null>(null);
  const [model, setModel] = useState<string>("");
  const [chat, setChat] = useState<ChatView | null>(initial);
  // Approve/reject answers for the proposed changes, sent once every one has an answer.
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});
  const [live, setLive] = useState<{ kind: "text" | "tool"; text: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [showList, setShowList] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const v = a.voice;
  const voice = useVoice(t.locale === "ru" ? "ru-RU" : "en-US");
  const [speakOn, setSpeakOn] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);

  // Opening another chat (or "new chat") swaps the conversation; a refresh of the same chat keeps local state.
  useEffect(() => {
    setChat((c) => (c?.id === initial?.id ? c : initial));
    setDecisions({});
    setError(null);
    setShowList(false);
  }, [initial]);

  useEffect(() => {
    setSpeakOn(read<boolean>(SPEAK_KEY) ?? false);
    setHandsFree(read<boolean>(HANDS_FREE_KEY) ?? false);
    fetch("/api/assistant")
      .then((r) => r.json())
      .then((c: Config) => {
        setConfig(c);
        const saved = read<string>(MODEL_KEY);
        const known = c.tiers.some((x) => x.models.some((m) => m.id === saved));
        setModel(saved && known ? saved : c.defaultModel);
      })
      .catch(() => setError(a.failed));
  }, [a.failed]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [chat, live, draft, busy]);

  const messages = chat?.messages ?? [];
  const calls = chat?.calls ?? {};
  // Proposed changes in the last assistant message that have no answer yet.
  const last = messages.at(-1);
  const pending = last?.role === "assistant" ? last.callIds.filter((id) => calls[id]?.status === "pending") : [];

  const run = useCallback(
    async (body: { text?: string; approvals?: Record<string, boolean> }): Promise<Turn> => {
      const turn: Turn = { texts: [], proposed: [] };
      setBusy(true);
      setError(null);
      setLive([]);
      setDraft("");
      let createdId: string | null = null;
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, chatId: chat?.id || null, text: body.text ?? null, approvals: body.approvals ?? {} }),
        });
        if (!res.ok || !res.body) {
          const b = await res.json().catch(() => ({}));
          throw new Error(b.error ?? a.failed);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines.filter(Boolean)) {
            const e = JSON.parse(line) as AgentEvent;
            if (e.type === "chat") createdId = e.id;
            if (e.type === "delta") setDraft((d) => d + e.content);
            if (e.type === "text") {
              turn.texts.push(e.content);
              setDraft("");
              setLive((l) => [...l, { kind: "text", text: e.content }]);
            }
            if (e.type === "tool" && e.status !== "rejected") setLive((l) => [...l, { kind: "tool", text: e.summary || e.name }]);
            if (e.type === "pending") for (const p of e.actions) turn.proposed.push({ summary: p.summary, destructive: p.destructive });
            if (e.type === "usage") setConfig((c) => (c ? { ...c, monthUsd: e.monthUsd } : c));
            if (e.type === "error") setError(e.message);
            if (e.type === "done") setChat(e.chat);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : a.failed);
      } finally {
        setBusy(false);
        setLive([]);
        setDraft("");
        setDecisions({});
      }
      // A new chat gets its own address; either way the chat list (and any changed board data) reloads.
      if (createdId) router.replace(`/assistant/${createdId}`);
      else if (chat?.id) router.refresh();
      return turn;
    },
    [chat?.id, model, a.failed, router],
  );

  const send = (text: string) => {
    if (!text.trim() || busy || pending.length) return;
    setInput("");
    setChat((c) => ({
      id: c?.id ?? "",
      title: c?.title ?? "",
      calls: c?.calls ?? {},
      messages: [...(c?.messages ?? []), { role: "user", text: text.trim() }],
    }));
    run({ text: text.trim() }).then((turn) => afterTurn.current(turn));
  };
  // Approve or reject proposed changes one by one (or all at once); the turn continues once each has an answer.
  const decide = (approve: boolean, only?: string) => {
    const next = { ...decisions };
    for (const id of pending) if (!only || id === only) next[id] = approve;
    setDecisions(next);
    if (pending.every((id) => id in next)) run({ approvals: next }).then((turn) => afterTurn.current(turn));
  };

  // ---------- Voice ----------
  // Callbacks fire after speech ends, by which time state has moved on; these refs always point at
  // the latest render's handlers, so they act on the current conversation.

  /** Handle words heard from the mic: answer a proposed change, or send them as a message. */
  const heard = useRef<(text: string) => void>(() => {});
  heard.current = (text: string) => {
    setInput("");
    if (!text) return;
    if (!pending.length) return send(text);
    const answer = yesOrNo(text, v.yes, v.no);
    if (answer === null) return voice.speak(v.yesNo, () => handsFree && startListening());
    // A misheard "yes" must never delete anything.
    if (answer && pending.some((id) => calls[id]?.destructive)) return voice.speak(v.needsClick);
    decide(answer);
  };

  const startListening = () => {
    setVoiceNote(null);
    voice.listen(
      (text) => heard.current(text),
      (interim) => setInput(interim),
      (e) => setVoiceNote(e === "denied" ? v.denied : v.failed),
    );
  };

  /** After a turn: read the reply (and any question) aloud, then in conversation mode listen again. */
  const afterTurn = useRef<(turn: Turn) => void>(() => {});
  afterTurn.current = (turn: Turn) => {
    const question = turn.proposed.length
      ? turn.proposed.some((p) => p.destructive)
        ? v.needsClick
        : v.confirm(turn.proposed.length)
      : "";
    const reply = [...turn.texts, question].filter(Boolean).join(" ");
    const next = () => handsFree && voice.supported.input && startListening();
    if (speakOn && voice.supported.output && reply) voice.speak(reply, next);
    else next();
  };

  const toggle = (key: string, value: boolean, set: (v: boolean) => void) => {
    set(value);
    write(key, value);
  };
  const monthUsd = config ? t.fmt.usd(config.monthUsd) : null;

  return (
    <main className="relative flex h-full min-h-0">
      <ChatList chats={chats} activeId={chat?.id ?? null} busy={busy} open={showList} onClose={() => setShowList(false)} />

      <section className="flex min-w-0 flex-1 flex-col" aria-label={a.title}>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3 md:px-4">
          <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label={a.chats} onClick={() => setShowList(true)}>
            <MessagesSquare />
          </Button>
          <Sparkles className="size-4 shrink-0 text-primary" />
          <h1 className="truncate text-sm font-semibold">{chat?.title || a.title}</h1>
          {monthUsd && <span className="hidden text-xs text-muted-foreground tabular-nums sm:inline">{a.month(monthUsd)}</span>}
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
            {voice.supported.output && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={v.readAloud}
                title={v.readAloud}
                aria-pressed={speakOn}
                className={cn(speakOn && "bg-brand-soft text-primary")}
                onClick={() => {
                  if (speakOn) voice.stopSpeaking();
                  toggle(SPEAK_KEY, !speakOn, setSpeakOn);
                }}
              >
                {speakOn ? <Volume2 /> : <VolumeX />}
              </Button>
            )}
            {voice.supported.input && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={v.handsFree}
                title={v.handsFree}
                aria-pressed={handsFree}
                className={cn(handsFree && "bg-brand-soft text-primary")}
                onClick={() => toggle(HANDS_FREE_KEY, !handsFree, setHandsFree)}
              >
                <AudioLines />
              </Button>
            )}
            {config && (
              <Select
                value={model}
                onValueChange={(m) => {
                  setModel(m);
                  write(MODEL_KEY, m);
                }}
              >
                <SelectTrigger aria-label={a.model} size="sm" className="w-40 bg-card sm:w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {config.tiers.map((tier) => (
                    <SelectGroup key={tier.tier}>
                      <SelectLabel>{a.tiers[tier.tier]}</SelectLabel>
                      {tier.models.map((m) => {
                        const p = config.prices[m.id];
                        return (
                          <SelectItem key={m.id} value={m.id}>
                            <span className="flex flex-col">
                              <span>{m.label}</span>
                              {p && <span className="text-[11px] text-muted-foreground">{a.price(+p.input.toFixed(2), +p.output.toFixed(2))}</span>}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </header>

        <div ref={scroller} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 text-sm">
            {config && !config.configured && (
              <p className="flex gap-2 rounded-md border border-warning/40 bg-warning-soft p-3 text-xs text-warning">
                <AlertTriangle className="size-4 shrink-0" /> {a.notConfigured}
              </p>
            )}

            {messages.length === 0 && !busy && (
              <div className="mx-auto max-w-md space-y-4 pt-10 text-center">
                <Sparkles className="mx-auto size-7 text-primary" />
                <p className="text-muted-foreground">{a.hint}</p>
                <div className="flex flex-col gap-1.5">
                  {a.examples.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => send(ex)}
                      disabled={!config?.configured}
                      className="cursor-pointer rounded-md border px-3 py-2 text-left text-sm hover:bg-secondary disabled:cursor-default disabled:opacity-50"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              if (m.role === "user")
                return (
                  <div key={i} className="ml-auto w-fit max-w-[85%] rounded-lg bg-brand-soft px-3 py-2 whitespace-pre-wrap">
                    {m.text}
                  </div>
                );
              return (
                <div key={i} className="space-y-1.5">
                  {m.text && <div className="leading-relaxed whitespace-pre-wrap">{m.text}</div>}
                  {m.callIds
                    .filter((id) => calls[id] && calls[id].status !== "pending" && calls[id].status !== "rejected")
                    .map((id) => (
                      <ToolChip key={id} info={calls[id]} />
                    ))}
                  {m.callIds
                    .filter((id) => calls[id]?.status === "rejected")
                    .map((id) => (
                      <div key={id} className="flex items-center gap-1.5 text-xs text-muted-foreground line-through">
                        <X className="size-3" /> {calls[id].summary}
                      </div>
                    ))}
                </div>
              );
            })}

            {busy &&
              live.map((l, i) =>
                l.kind === "text" ? (
                  <div key={i} className="leading-relaxed whitespace-pre-wrap">
                    {l.text}
                  </div>
                ) : (
                  <ToolChip key={i} info={{ summary: l.text, status: "done" }} />
                ),
              )}
            {busy && draft && <div className="leading-relaxed whitespace-pre-wrap">{draft}</div>}

            {pending.length > 0 && !busy && (
              <div className="space-y-2 rounded-lg border border-primary/30 bg-brand-soft/50 p-3">
                <div className="text-xs font-semibold text-primary">{a.proposed}</div>
                {pending.map((id) => {
                  const info = calls[id];
                  const d = decisions[id];
                  return (
                    <div key={id} className="flex items-start gap-2 rounded-md border bg-card p-2">
                      {info?.destructive ? <Trash2 className="mt-0.5 size-3.5 shrink-0 text-destructive" /> : <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />}
                      <span className={cn("min-w-0 flex-1 text-xs", d === false && "text-muted-foreground line-through")}>{info?.summary}</span>
                      {d === undefined ? (
                        <span className="flex shrink-0 gap-1">
                          <Button size="xs" variant={info?.destructive ? "destructive" : "default"} onClick={() => decide(true, id)}>
                            {a.approve}
                          </Button>
                          <Button size="xs" variant="ghost" onClick={() => decide(false, id)}>
                            {a.reject}
                          </Button>
                        </span>
                      ) : (
                        <span className="shrink-0 text-[11px] text-muted-foreground">{d ? a.approve : a.rejected}</span>
                      )}
                    </div>
                  );
                })}
                {pending.length > 1 && (
                  <div className="flex justify-end gap-1">
                    <Button size="xs" variant="ghost" onClick={() => decide(false)}>
                      {a.rejectAll}
                    </Button>
                    <Button size="xs" onClick={() => decide(true)}>
                      {a.approveAll}
                    </Button>
                  </div>
                )}
              </div>
            )}

            {busy && !draft && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" /> {a.thinking}
              </div>
            )}
            {voiceNote && (
              <p className="flex gap-2 rounded-md border border-warning/40 bg-warning-soft p-2.5 text-xs text-warning">
                <Mic className="size-4 shrink-0" /> {voiceNote}
              </p>
            )}
            {error && (
              <p className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
                <CircleAlert className="size-4 shrink-0" /> {error}
              </p>
            )}
          </div>
        </div>

        <form
          className="mx-auto w-full max-w-3xl px-4 pb-4"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <div className="flex items-end gap-2 rounded-lg border bg-card p-1.5 shadow-xs focus-within:ring-3 focus-within:ring-ring/50">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              maxLength={8000}
              disabled={!config?.configured || pending.length > 0 || voice.listening}
              placeholder={voice.listening ? v.listening : a.placeholder}
              className="max-h-48 min-h-10 resize-none border-0 bg-transparent px-1.5 py-2 shadow-none focus-visible:ring-0"
            />
            {voice.supported.input ? (
              <Button
                type="button"
                size="icon-sm"
                variant={voice.listening ? "destructive" : "ghost"}
                aria-label={voice.listening ? v.stop : v.speak}
                title={voice.listening ? v.stop : v.speak}
                disabled={busy || !config?.configured}
                className={cn(voice.listening && "animate-pulse")}
                onClick={() => (voice.listening ? voice.stopListening() : startListening())}
              >
                {voice.listening ? <Square /> : <Mic />}
              </Button>
            ) : (
              <span className="sr-only">{v.unsupported}</span>
            )}
            <Button size="icon-sm" aria-label={a.send} disabled={busy || !input.trim() || pending.length > 0 || !config?.configured}>
              <ArrowUp />
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}

/** Saved chats: a column on tablets and up, a sheet over the page on phones. */
function ChatList({
  chats,
  activeId,
  busy,
  open,
  onClose,
}: {
  chats: ChatSummary[];
  activeId: string | null;
  busy: boolean;
  open: boolean;
  onClose: () => void;
}) {
  const a = useT().assistant;
  return (
    <>
      {open && <div className="absolute inset-0 z-10 bg-foreground/20 md:hidden" onClick={onClose} aria-hidden />}
      <nav
        aria-label={a.chats}
        className={cn(
          "absolute inset-y-0 left-0 z-20 w-72 flex-col border-r bg-card md:static md:z-auto md:flex md:w-64",
          open ? "flex" : "hidden",
        )}
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <span className="text-sm font-semibold">{a.chats}</span>
          <Button asChild size="xs" variant="outline" className={cn("ml-auto", busy && "pointer-events-none opacity-50")}>
            <Link href="/assistant" onClick={onClose}>
              <SquarePen /> {a.newChat}
            </Link>
          </Button>
        </div>
        <ul className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {chats.map((c) => (
            <ChatRow key={c.id} chat={c} active={c.id === activeId} busy={busy} onOpen={onClose} />
          ))}
          {chats.length === 0 && <li className="px-2 py-3 text-xs text-muted-foreground">{a.noChats}</li>}
        </ul>
      </nav>
    </>
  );
}

function ChatRow({ chat, active, busy, onOpen }: { chat: ChatSummary; active: boolean; busy: boolean; onOpen: () => void }) {
  const a = useT().assistant;
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "rename" | "confirm">("view");
  const [title, setTitle] = useState(chat.title);
  const [saving, start] = useTransition();

  if (mode === "rename")
    return (
      <li>
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            start(async () => {
              await renameChat(chat.id, title);
              setMode("view");
            });
          }}
        >
          <Input autoFocus value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} aria-label={a.rename} className="h-8 text-sm" />
          <Button size="icon-sm" variant="ghost" aria-label={a.rename} disabled={saving || !title.trim()}>
            <Check />
          </Button>
          <Button type="button" size="icon-sm" variant="ghost" aria-label={a.cancel} onClick={() => setMode("view")}>
            <X />
          </Button>
        </form>
      </li>
    );

  return (
    <li
      className={cn(
        "group flex h-8 items-center rounded-md pr-1 text-sm",
        active ? "bg-foreground/[0.06] font-medium" : "text-secondary-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {mode === "confirm" ? (
        <>
          <span className="flex-1 truncate px-2 text-xs text-muted-foreground">{a.confirmDelete}</span>
          <Button
            size="xs"
            variant="destructive"
            disabled={saving}
            onClick={() =>
              start(async () => {
                await deleteChat(chat.id);
                if (active) router.replace("/assistant");
              })
            }
          >
            {a.delete}
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label={a.cancel} onClick={() => setMode("view")}>
            <X />
          </Button>
        </>
      ) : (
        <>
          <Link
            href={`/assistant/${chat.id}`}
            onClick={onOpen}
            aria-current={active ? "page" : undefined}
            className={cn("flex h-full min-w-0 flex-1 items-center truncate rounded-md px-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50", busy && "pointer-events-none")}
          >
            <span className="truncate">{chat.title}</span>
          </Link>
          <span className="hidden shrink-0 group-focus-within:flex group-hover:flex">
            <Button size="icon-xs" variant="ghost" aria-label={a.rename} title={a.rename} onClick={() => setMode("rename")}>
              <Pencil />
            </Button>
            <Button size="icon-xs" variant="ghost" aria-label={a.delete} title={a.delete} onClick={() => setMode("confirm")}>
              <Trash2 />
            </Button>
          </span>
        </>
      )}
    </li>
  );
}

function ToolChip({ info }: { info?: CallInfo }) {
  const failed = info?.status === "error";
  return (
    <div className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", failed && "text-destructive")}>
      {failed ? <CircleAlert className="size-3" /> : <Search className="size-3" />}
      <span className="truncate">{info?.summary}</span>
    </div>
  );
}
