"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  AudioLines,
  AudioWaveform,
  Check,
  CircleAlert,
  CornerDownRight,
  ExternalLink,
  Loader2,
  Lock,
  PanelLeftClose,
  PanelLeftOpen,
  Mic,
  Pencil,
  Plus,
  PhoneOff,
  Search,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { deleteChat, renameChat } from "@/app/assistant/actions";
import { useT } from "@/components/I18nProvider";
import { Markdown } from "@/components/Markdown";
import { PersonalKeyForm } from "@/components/PersonalKeyForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTalk, type Recognizer, type TalkPhase } from "@/components/useTalk";
import { useVoice } from "@/components/useVoice";
import type { AgentEvent, CallInfo, ChatSummary, ChatView, TokenUse } from "@/lib/ai/agent";
import { providerOf, type ModelPrice, type Tier } from "@/lib/ai/models";
import { ModelIcon } from "@/components/ModelIcon";
import { cn } from "@/lib/utils";

type Config = {
  configured: boolean;
  defaultModel: string;
  tiers: { tier: Tier; models: { id: string; label: string }[] }[];
  prices: Record<string, ModelPrice>;
  monthUsd: number;
  budgetUsd: number | null;
  soniox: boolean;
};

const MODEL_KEY = "qazbot:assistant-model";
const SPEAK_KEY = "qazbot:assistant-speak";
const HANDS_FREE_KEY = "qazbot:assistant-hands-free";
const LIST_HIDDEN_KEY = "qazbot:assistant-list-hidden";
const RECOGNIZER_KEY = "qazbot:assistant-recognizer";

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
  // On wider screens the chat list can be tucked away; remembered in this browser.
  const [listHidden, setListHidden] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const v = a.voice;
  const voice = useVoice(t.locale === "ru" ? "ru-RU" : "en-US");
  const [speakOn, setSpeakOn] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const talk = useTalk(
    (text) => heard.current(text),
    (interim) => setInput(interim),
  );
  const talkOn = talk.phase !== "off";
  const { setBusy: talkBusy, setRecognizer, beginTurn, feed, flush } = talk;
  // Soniox is offered (and preferred) when the team has set it up; otherwise OpenRouter transcribes.
  const [recognizer, setRecognizerChoice] = useState<Recognizer>("soniox");
  const activeRecognizer: Recognizer = config?.soniox ? recognizer : "openrouter";
  useEffect(() => setRecognizer(activeRecognizer), [activeRecognizer, setRecognizer]);
  // Words heard in talk mode while a turn is still running wait here until it ends.
  const queued = useRef<string | null>(null);

  // Opening another chat (or "new chat") swaps the conversation; a refresh of the same chat keeps local state.
  useEffect(() => {
    setChat((c) => (c?.id === initial?.id ? c : initial));
    setDecisions({});
    setError(null);
    setShowList(false);
  }, [initial]);

  const loadConfig = useCallback(() => {
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
    setSpeakOn(read<boolean>(SPEAK_KEY) ?? false);
    setHandsFree(read<boolean>(HANDS_FREE_KEY) ?? false);
    setListHidden(read<boolean>(LIST_HIDDEN_KEY) ?? false);
    setRecognizerChoice(read<Recognizer>(RECOGNIZER_KEY) === "openrouter" ? "openrouter" : "soniox");
    loadConfig();
  }, [loadConfig]);

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
      beginTurn();
      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, chatId: chat?.id || null, text: body.text ?? null, approvals: body.approvals ?? {}, voice: talkOn }),
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
            if (e.type === "delta") {
              setDraft((d) => d + e.content);
              feed(e.content);
            }
            if (e.type === "text" || e.type === "tool" || e.type === "pending") flush();
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
    [chat?.id, model, a.failed, router, beginTurn, feed, flush, talkOn],
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
    // Talking over a reply that's still streaming: send it once the turn is done.
    if (busy) {
      queued.current = text;
      return;
    }
    if (!pending.length) return send(text);
    const answer = yesOrNo(text, v.yes, v.no);
    if (answer === null) return talkOn ? talk.say(v.yesNo) : voice.speak(v.yesNo, () => handsFree && startListening());
    // A misheard "yes" must never delete anything.
    if (answer && pending.some((id) => calls[id]?.destructive)) return talkOn ? talk.say(v.needsClick) : voice.speak(v.needsClick);
    decide(answer);
  };

  useEffect(() => {
    talkBusy(busy);
    if (busy || !queued.current) return;
    const text = queued.current;
    queued.current = null;
    heard.current(text);
  }, [busy, talkBusy]);

  useEffect(() => {
    if (talk.error) setVoiceNote(talk.error === "denied" ? v.denied : v.failed);
  }, [talk.error, v.denied, v.failed]);

  const startTalk = () => {
    voice.stopListening();
    voice.stopSpeaking();
    setVoiceNote(null);
    talk.start();
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
    // Talk mode already spoke the reply as it streamed in; only the question is left.
    if (talkOn) {
      if (question) talk.say(question);
      return;
    }
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
  const modelLabel = (id: string) => config?.tiers.flatMap((x) => x.models).find((m) => m.id === id)?.label ?? id.split("/").pop();
  // A fresh chat: heading, composer and suggestions sit together in the middle, like the reference.
  const empty = !!config?.configured && messages.length === 0 && !busy;

  const composer = (
        <form
          className="w-full"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          {talk.phase !== "off" && (
            <TalkBar
              phase={talk.phase}
              level={talk.level}
              onEnd={talk.stop}
              recognizer={config?.soniox ? activeRecognizer : null}
              onRecognizer={(r) => {
                setRecognizerChoice(r);
                write(RECOGNIZER_KEY, r);
              }}
            />
          )}
          {/* A plain textarea: the shared Textarea's own border and fills would draw a box inside this one. */}
          <div
            className={cn(
              "rounded-2xl border border-primary/15 bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04),0_4px_16px_-4px_rgba(16,24,40,0.08)] transition-[border-color,box-shadow] focus-within:border-primary/40 focus-within:ring-3 focus-within:ring-ring/30",
              !config?.configured && "opacity-60",
            )}
          >
            <textarea
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
              aria-label={a.placeholder}
              className={cn(
                "field-sizing-content block max-h-48 w-full resize-none bg-transparent px-4 pt-4 pb-1 text-[14px] leading-relaxed outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed",
                empty ? "min-h-24" : "min-h-12",
              )}
            />
            <div className="flex items-center gap-1 px-2.5 pb-2.5">
              {config && (
                <Select
                  value={model}
                  onValueChange={(m) => {
                    setModel(m);
                    write(MODEL_KEY, m);
                  }}
                >
                  <SelectTrigger
                    aria-label={a.model}
                    size="sm"
                    className="ml-auto w-auto max-w-60 gap-1.5 border-transparent bg-transparent px-2 font-medium shadow-none hover:bg-accent dark:bg-transparent"
                  >
                    {/* Show just the mark and name here; the menu rows add the price */}
                    <SelectValue>
                      <span className="flex items-center gap-1.5">
                        <ModelIcon provider={providerOf(model)} />
                        <span className="truncate">{modelLabel(model)}</span>
                      </span>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent align="end" className="w-72">
                    {config.tiers.map((tier, i) => (
                      <SelectGroup key={tier.tier} className={cn(i > 0 && "mt-1 border-t pt-1")}>
                        <SelectLabel className="flex flex-col gap-0.5 py-1.5">
                          <span className="text-xs font-medium text-foreground">{a.tiers[tier.tier]}</span>
                          <span className="text-[11px] font-normal text-muted-foreground">{a.tierHints[tier.tier]}</span>
                        </SelectLabel>
                        {tier.models.map((m) => {
                          const p = config.prices[m.id];
                          return (
                            <SelectItem key={m.id} value={m.id} className="py-2">
                              <ModelIcon provider={providerOf(m.id)} />
                              <span className="flex-1">{m.label}</span>
                              {p && (
                                <span className="ml-3 text-[11px] text-muted-foreground tabular-nums" title={a.price(+p.input.toFixed(2), +p.output.toFixed(2))}>
                                  ${+p.input.toFixed(2)} / ${+p.output.toFixed(2)}
                                </span>
                              )}
                            </SelectItem>
                          );
                        })}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className={cn("flex items-center gap-1", !config && "ml-auto")}>
                {talk.supported && !talkOn && (
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={v.talk}
                    title={v.talk}
                    disabled={busy || !config?.configured}
                    className="rounded-lg text-muted-foreground"
                    onClick={startTalk}
                  >
                    <AudioWaveform />
                  </Button>
                )}
                {talkOn ? null : voice.supported.input ? (
                  <Button
                    type="button"
                    size="icon"
                    variant={voice.listening ? "destructive" : "ghost"}
                    aria-label={voice.listening ? v.stop : v.speak}
                    title={voice.listening ? v.stop : v.speak}
                    disabled={busy || !config?.configured}
                    className={cn("rounded-lg text-muted-foreground", voice.listening && "animate-pulse text-white")}
                    onClick={() => (voice.listening ? voice.stopListening() : startListening())}
                  >
                    {voice.listening ? <Square /> : <Mic />}
                  </Button>
                ) : (
                  <span className="sr-only">{v.unsupported}</span>
                )}
                <Button
                  size="icon"
                  aria-label={a.send}
                  title={a.composerHint}
                  variant={input.trim() ? "default" : "secondary"}
                  className="rounded-lg disabled:opacity-100 disabled:text-muted-foreground"
                  disabled={busy || !input.trim() || pending.length > 0 || !config?.configured}
                >
                  {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
                </Button>
              </div>
            </div>
          </div>
        </form>
  );

  return (
    <main className="relative flex h-full min-h-0">
      <ChatList
        chats={chats}
        activeId={chat?.id ?? null}
        busy={busy}
        open={showList}
        hidden={listHidden}
        onClose={() => setShowList(false)}
        onHide={() => toggle(LIST_HIDDEN_KEY, true, setListHidden)}
      />

      <section className="flex min-w-0 flex-1 flex-col" aria-label={a.title}>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-3 md:px-4">
          {/* Show the chat list: always on phones, on wider screens only while it's hidden */}
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(!listHidden && "md:hidden")}
            aria-label={a.showChats}
            title={a.showChats}
            onClick={() => {
              setShowList(true);
              toggle(LIST_HIDDEN_KEY, false, setListHidden);
            }}
          >
            <PanelLeftOpen />
          </Button>
          {/* New chat stays reachable while the list is out of sight */}
          <Button asChild variant="ghost" size="icon-sm" className={cn(!listHidden && "md:hidden", busy && "pointer-events-none opacity-50")}>
            <Link href="/assistant" aria-label={a.newChat} title={a.newChat}>
              <Plus />
            </Link>
          </Button>
          <Sparkles className="size-4 shrink-0 text-brand" />
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
          </div>
        </header>

        <div ref={scroller} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 text-sm">
            {config && !config.configured && <KeyWelcome onSaved={loadConfig} />}

            {empty && (
              <div className="mx-auto flex min-h-[calc(100dvh-14rem)] max-w-3xl flex-col justify-center pb-10">
                <h2 className="mb-8 text-center text-[28px] leading-[1.2] font-semibold">{a.welcomeTitle}</h2>
                {composer}
                <h3 className="mt-8 mb-1 text-[13px] font-medium text-muted-foreground">{a.suggestions}</h3>
                <ul className="divide-y">
                  {a.examples.map((ex) => (
                    <li key={ex}>
                      <button
                        type="button"
                        onClick={() => send(ex)}
                        className="flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-3 text-left text-[14px] outline-none hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <CornerDownRight className="size-4 shrink-0 text-muted-foreground" />
                        {ex}
                      </button>
                    </li>
                  ))}
                </ul>
                <p className="mt-8 text-center text-xs text-muted-foreground">{a.disclaimer}</p>
              </div>
            )}

            {messages.map((m, i) => {
              if (m.role === "user")
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[80%] rounded-2xl rounded-br-md bg-muted px-4 py-2.5 leading-relaxed whitespace-pre-wrap">{m.text}</div>
                  </div>
                );
              // A run of assistant messages (one per model step) shares one avatar, on the first.
              const first = messages[i - 1]?.role !== "assistant";
              const done = m.callIds.filter((id) => calls[id] && calls[id].status !== "pending" && calls[id].status !== "rejected");
              const rejected = m.callIds.filter((id) => calls[id]?.status === "rejected");
              if (!m.text && done.length === 0 && rejected.length === 0) return null;
              return (
                <AssistantTurn key={i} first={first}>
                  {(done.length > 0 || rejected.length > 0) && (
                    <div className="flex flex-wrap gap-1.5">
                      {done.map((id) => (
                        <ToolChip key={id} info={calls[id]} />
                      ))}
                      {rejected.map((id) => (
                        <span key={id} className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground line-through">
                          <X className="size-3 shrink-0" /> <span className="truncate">{calls[id].summary}</span>
                        </span>
                      ))}
                    </div>
                  )}
                  {m.text && <Markdown text={m.text} />}
                  {m.usage && m.text && <TokenNote usage={m.usage} />}
                </AssistantTurn>
              );
            })}

            {busy && (live.length > 0 || draft) && (
              <AssistantTurn first={messages.at(-1)?.role !== "assistant"}>
                {live.some((l) => l.kind === "tool") && (
                  <div className="flex flex-wrap gap-1.5">
                    {live
                      .filter((l) => l.kind === "tool")
                      .map((l, i) => (
                        <ToolChip key={i} info={{ summary: l.text, status: "done" }} />
                      ))}
                  </div>
                )}
                {live
                  .filter((l) => l.kind === "text")
                  .map((l, i) => (
                    <Markdown key={i} text={l.text} />
                  ))}
                {draft && (
                  <div className="leading-relaxed whitespace-pre-wrap">
                    {draft}
                    {/* Typing cursor while the reply streams in */}
                    <span aria-hidden className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-foreground/70" />
                  </div>
                )}
              </AssistantTurn>
            )}

            {pending.length > 0 && !busy && (
              <div className="space-y-2 rounded-lg border border-primary/25 bg-brand-soft-gradient p-3">
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
              <AssistantTurn first={live.length === 0 && messages.at(-1)?.role !== "assistant"}>
                <span className="inline-flex items-center gap-2 text-muted-foreground" role="status" aria-label={a.thinking}>
                  <span className="flex gap-1" aria-hidden>
                    {[0, 150, 300].map((d) => (
                      <span key={d} className="size-1.5 animate-bounce rounded-full bg-muted-foreground/60" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </span>
                  <span className="text-xs">{a.thinking}</span>
                </span>
              </AssistantTurn>
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

        {!empty && (
          <div className="mx-auto w-full max-w-3xl px-4 pb-3">
            {composer}
            <p className="mt-2 text-center text-[11px] text-muted-foreground">{a.disclaimer}</p>
          </div>
        )}
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
  hidden,
  onClose,
  onHide,
}: {
  chats: ChatSummary[];
  activeId: string | null;
  busy: boolean;
  open: boolean;
  /** Tucked away on wider screens. */
  hidden: boolean;
  onClose: () => void;
  onHide: () => void;
}) {
  const a = useT().assistant;
  return (
    <>
      {open && <div className="absolute inset-0 z-10 bg-foreground/20 md:hidden" onClick={onClose} aria-hidden />}
      <nav
        aria-label={a.chats}
        className={cn(
          "absolute inset-y-0 left-0 z-20 w-72 flex-col border-r bg-card md:static md:z-auto md:w-64",
          open ? "flex" : "hidden",
          hidden ? "md:hidden" : "md:flex",
        )}
      >
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <span className="text-sm font-semibold">{a.chats}</span>
          <span className="ml-auto flex items-center gap-0.5">
            <Button asChild size="icon-sm" variant="ghost" className={cn(busy && "pointer-events-none opacity-50")}>
              <Link href="/assistant" onClick={onClose} aria-label={a.newChat} title={a.newChat}>
                <Plus />
              </Link>
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={a.hideChats}
              title={a.hideChats}
              onClick={() => {
                onClose();
                onHide();
              }}
            >
              <PanelLeftClose />
            </Button>
          </span>
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

/** Talk mode's status line: what it's doing, a dot that follows the mic level, and a way out. */
function TalkBar({
  phase,
  level,
  onEnd,
  recognizer,
  onRecognizer,
}: {
  phase: Exclude<TalkPhase, "off">;
  level: number;
  onEnd: () => void;
  /** The recogniser in use, or null when there's no choice to offer. */
  recognizer: Recognizer | null;
  onRecognizer: (r: Recognizer) => void;
}) {
  const v = useT().assistant.voice;
  return (
    <div role="status" className="mb-2 flex items-center gap-3 rounded-2xl border border-primary/25 bg-brand-soft-gradient py-2 pr-2 pl-4">
      <span className="flex size-5 shrink-0 items-center justify-center text-primary">
        {phase === "thinking" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : phase === "speaking" ? (
          <Volume2 className="size-4 animate-pulse" />
        ) : (
          <span
            className={cn("size-2.5 rounded-full bg-primary transition-transform duration-100", phase === "listening" && "opacity-60")}
            style={{ transform: `scale(${1 + level * 1.6})` }}
          />
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm">{v.phases[phase]}</span>
      {recognizer && (
        <Select value={recognizer} onValueChange={(r) => onRecognizer(r as Recognizer)}>
          <SelectTrigger aria-label={v.recognizer} title={v.recognizer} size="sm" className="h-7 w-28 bg-card text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            <SelectItem value="soniox">Soniox</SelectItem>
            <SelectItem value="openrouter">OpenRouter</SelectItem>
          </SelectContent>
        </Select>
      )}
      <Button type="button" size="xs" variant="outline" onClick={onEnd}>
        <PhoneOff /> {v.endTalk}
      </Button>
    </div>
  );
}

/** One thing the assistant looked up or did, as a small pill above its reply. */
function ToolChip({ info }: { info?: CallInfo }) {
  const failed = info?.status === "error";
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground",
        failed && "border-destructive/30 text-destructive",
      )}
    >
      {failed ? <CircleAlert className="size-3 shrink-0" /> : <Search className="size-3 shrink-0" />}
      <span className="truncate">{info?.summary}</span>
    </span>
  );
}

/** An assistant turn: the avatar on its first message, then the content in a column beside it. */
function AssistantTurn({ first, children }: { first: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("flex gap-3", !first && "-mt-3")}>
      {first ? (
        <span className="bg-brand-gradient grid size-7 shrink-0 place-items-center rounded-full text-white shadow-xs" aria-hidden>
          <Sparkles className="size-3.5" />
        </span>
      ) : (
        <span className="w-7 shrink-0" aria-hidden />
      )}
      <div className="min-w-0 flex-1 space-y-2 pt-0.5">{children}</div>
    </div>
  );
}

/** First run: the assistant stays off until this person adds their own OpenRouter key. */
function KeyWelcome({ onSaved }: { onSaved: () => void }) {
  const w = useT().assistant.welcome;
  return (
    <div className="mx-auto max-w-lg space-y-5 pt-8">
      <div className="space-y-2 text-center">
        <Sparkles className="mx-auto size-7 text-brand" />
        <h2 className="text-lg font-semibold">{w.title}</h2>
        <p className="text-muted-foreground">{w.intro}</p>
      </div>
      <p className="text-center">
        {w.paste}{" "}
        <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 font-medium text-primary hover:underline">
          {w.keyLink} <ExternalLink className="size-3" />
        </a>
      </p>
      <PersonalKeyForm hint={null} onSaved={onSaved} />
      <p className="flex gap-2 rounded-md border border-primary/20 bg-brand-soft-gradient p-3 text-xs text-muted-foreground">
        <Lock className="size-4 shrink-0 text-primary" /> {w.privacy}
      </p>
    </div>
  );
}

/** Tokens a reply used, small and quiet under it; input, output and cost on hover. */
function TokenNote({ usage }: { usage: TokenUse }) {
  const t = useT();
  const n = new Intl.NumberFormat(t.locale === "ru" ? "ru-RU" : "en-GB", { notation: "compact", maximumFractionDigits: 1 });
  return (
    <div className="text-[11px] text-muted-foreground/80 tabular-nums" title={t.assistant.tokensDetail(n.format(usage.input), n.format(usage.output), t.fmt.usd(usage.costUsd))}>
      {t.assistant.tokens(n.format(usage.input + usage.output))}
    </div>
  );
}
