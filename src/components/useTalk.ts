"use client";

import { createContext, createElement, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { chunks } from "@/components/useVoice";

// Talk mode: a hands-free conversation with the assistant. The mic stays open; a simple loudness
// detector finds where each utterance starts and ends, and the clip goes to /api/voice/stt. Replies are
// read aloud as they stream in, a few sentences per /api/voice/tts request, so speech starts before the
// reply is finished. Talking over a reply cuts it off and starts a new utterance (barge-in).
// Audio is captured as 16 kHz PCM and sent as WAV, so every browser produces the same format.
// With Soniox picked as the voice provider, each utterance streams over a WebSocket instead: words show
// up as they're recognised, and Soniox's own endpointing decides when the person has finished. Replies
// are then read aloud by Soniox too.

export type TalkPhase = "off" | "listening" | "hearing" | "thinking" | "speaking";
export type TalkError = "denied" | "failed";
export type Recognizer = "openrouter" | "soniox";

const RATE = 16_000;
const PREROLL_MS = 400; // audio kept from before the detector fires, so the first syllable isn't lost
const START_MS = 120; // this much loud audio starts an utterance
const BARGE_MS = 300; // while a reply plays, the person must talk longer (and louder) to cut in
const END_MS = 900; // this much quiet ends an utterance
// Quiet during an utterance means this far below the person's own speech level (or near the floor).
// The room floor alone isn't enough: noise suppression can drive it to -80 dB, and then ordinary room
// hum counted as speech, so an utterance never ended until the 30 s cap.
const QUIET_BELOW_SPEECH_DB = 18;
const MIN_SPEECH_MS = 250; // shorter bursts are coughs and clicks, not words
const MAX_UTTERANCE_MS = 30_000;
const MAX_TTS_CHARS = 1_000;
// Soniox: if its endpointing hasn't closed the utterance after this much quiet, finalize it ourselves.
// Only a backstop: finalizing at 1 s cut people off mid-sentence ("Подскажи по."), while Soniox's
// semantic endpointing already ends complete sentences quickly and waits through a thinking pause.
const SONIOX_QUIET_MS = 2_500;
// Timings of each utterance in the browser console during development, for tuning the detector.
const trace = (...args: unknown[]) => process.env.NODE_ENV !== "production" && console.debug("[talk]", ...args);
const SONIOX_URL = "wss://stt-rt.soniox.com/transcribe-websocket";

// Copies mic frames out of the audio thread in batches of 1024 samples.
const TAP = `class Tap extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Float32Array(1024); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) for (let i = 0; i < ch.length; i++) {
      this.buf[this.n++] = ch[i];
      if (this.n === this.buf.length) { this.port.postMessage(this.buf.slice(0)); this.n = 0; }
    }
    return true;
  }
}
registerProcessor("qazbot-tap", Tap);`;

/** Averages the mic's samples down to about 16 kHz 16-bit, carrying the remainder between frames. */
class Downsampler {
  private acc = 0;
  private n = 0;
  private t = 0;
  private ratio: number;
  readonly rate: number;
  /** `ratio` is the mic's sample rate over 16 kHz; a mic slower than that is passed through as is. */
  constructor(ratio: number) {
    this.ratio = Math.max(ratio, 1);
    this.rate = Math.round(RATE * Math.min(ratio, 1));
  }
  push(input: Float32Array) {
    const out: number[] = [];
    for (const x of input) {
      this.acc += x;
      this.n++;
      if (++this.t >= this.ratio) {
        out.push(Math.max(-1, Math.min(1, this.acc / this.n)) * 0x7fff);
        this.acc = this.n = 0;
        this.t -= this.ratio;
      }
    }
    return Int16Array.from(out);
  }
}

function wav(parts: Int16Array[], rate: number) {
  const samples = parts.reduce((n, p) => n + p.length, 0);
  const view = new DataView(new ArrayBuffer(44 + samples * 2));
  const ascii = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples * 2, true);
  ascii(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  ascii(36, "data");
  view.setUint32(40, samples * 2, true);
  let at = 44;
  for (const p of parts)
    for (const s of p) {
      view.setInt16(at, s, true);
      at += 2;
    }
  return new Blob([view.buffer], { type: "audio/wav" });
}

/** Where streamed text can be cut for speaking: after the last sentence end, once there's enough of it. */
function cutPoint(text: string, min: number) {
  let cut = -1;
  for (const m of text.matchAll(/[.!?…](?=\s)|\n/g)) cut = m.index + 1;
  return cut >= min ? cut : -1;
}

type Audio = { ctx: AudioContext; stream: MediaStream; node: AudioWorkletNode; down: Downsampler };
type Callbacks = {
  phase: (p: TalkPhase) => void;
  level: (l: number) => void;
  error: (e: TalkError) => void;
  text: (t: string) => void;
  interim: (t: string) => void;
};
type SonioxToken = { text: string; is_final: boolean };
type SonioxMessage = { tokens?: SonioxToken[]; finished?: boolean; error_code?: number; error_message?: string };

/**
 * One Soniox utterance. The socket opens (on a single-use temporary key) as soon as this is created, so
 * it's ready when speech starts; the stream itself, which Soniox bills, only begins at start().
 */
class SonioxStream {
  private ws: WebSocket | null = null;
  private config: Record<string, unknown> | null = null;
  private outbox: (string | ArrayBuffer)[] = [];
  private started = false;
  private configSent = false;
  private finalized = false;
  private finals = "";
  private rate = RATE;
  private keepalive: ReturnType<typeof setInterval> | null = null;
  /** Ended: finished, failed or closed. A warm stream that ended unused is replaced. */
  ended = false;

  constructor(private on: { interim: (t: string) => void; done: (t: string) => void; error: () => void }) {
    this.connect();
  }

  private async connect() {
    try {
      const res = await fetch("/api/voice/soniox", { method: "POST" });
      if (!res.ok) throw new Error(`Soniox key request failed: ${res.status}`);
      const { apiKey, model, language } = (await res.json()) as { apiKey: string; model: string; language: string };
      if (this.ended) return;
      this.config = {
        model,
        language_hints: [language],
        enable_endpoint_detection: true,
        // How long Soniox may wait after speech for the sentence to go on; complete sentences end sooner.
        max_endpoint_delay_ms: 1500,
        context: { general: [{ key: "domain", value: "Task planning on the kanban board of a robotics team" }] },
      };
      const ws = new WebSocket(SONIOX_URL, ["soniox-api-key", apiKey]);
      ws.onopen = () => this.flush();
      ws.onmessage = (e) => typeof e.data === "string" && this.message(e.data);
      ws.onclose = () => this.fail();
      this.ws = ws;
      // An idle socket is closed after 40 s without a message, until the stream starts.
      this.keepalive = setInterval(() => !this.started && ws.readyState === WebSocket.OPEN && ws.send('{"type":"keepalive"}'), 25_000);
    } catch (e) {
      console.warn("talk:", e);
      this.fail();
    }
  }

  /** Speech began: open the stream with the audio from just before it. */
  start(preroll: Int16Array[], rate: number) {
    this.started = true;
    this.rate = rate;
    for (const p of preroll) this.outbox.push(p.buffer as ArrayBuffer);
    this.flush();
  }

  push(pcm: Int16Array) {
    if (this.ended) return;
    this.outbox.push(pcm.buffer as ArrayBuffer);
    this.flush();
  }

  /** Close the utterance now instead of waiting for Soniox's endpointing. */
  finalize() {
    if (this.finalized || this.ended) return;
    this.finalized = true;
    this.outbox.push('{"type":"finalize"}');
    this.flush();
  }

  close() {
    this.ended = true;
    this.stopKeepalive();
    this.ws?.close();
  }

  private flush() {
    const ws = this.ws;
    if (!ws || ws.readyState !== WebSocket.OPEN || !this.started || !this.config) return;
    if (!this.configSent) {
      ws.send(JSON.stringify({ ...this.config, audio_format: "pcm_s16le", sample_rate: this.rate, num_channels: 1 }));
      this.configSent = true;
    }
    for (const m of this.outbox) ws.send(m);
    this.outbox = [];
  }

  private message(data: string) {
    if (this.ended) return;
    const m = JSON.parse(data) as SonioxMessage;
    if (m.error_code) {
      console.warn("talk: Soniox error", m.error_code, m.error_message);
      return this.fail();
    }
    let interim = "";
    let end = false;
    for (const t of m.tokens ?? []) {
      // <end> is Soniox's endpoint; <fin> answers our finalize request.
      if (t.text === "<end>" || t.text === "<fin>") end = true;
      else if (t.is_final) this.finals += t.text;
      else interim += t.text;
    }
    this.on.interim((this.finals + interim).trim());
    if (!end) return;
    this.ended = true;
    this.stopKeepalive();
    this.ws?.send(""); // ends the stream; Soniox replies "finished" and closes the socket
    this.on.done(this.finals.trim());
  }

  private fail() {
    if (this.ended) return;
    this.ended = true;
    this.stopKeepalive();
    this.ws?.close();
    if (this.started) this.on.error();
  }

  private stopKeepalive() {
    if (this.keepalive) clearInterval(this.keepalive);
    this.keepalive = null;
  }
}

class TalkEngine {
  private audio: Audio | null = null;
  private phase: TalkPhase = "off";
  // Detector state.
  private floor = -55; // dBFS of the room's background noise
  private loudMs = 0;
  private preroll: Int16Array[] = [];
  private capture: {
    parts: Int16Array[];
    speechMs: number;
    quietMs: number;
    totalMs: number;
    voice: number; // running average of the person's speech level, dBFS
    since: number; // performance.now() at the start, for trace timings
    finalized: boolean;
  } | null = null;
  private lastLevel = 0;
  // Recognition: with Soniox, a socket is kept warm for the next utterance and `active` holds the current one.
  private recognizer: Recognizer = "openrouter";
  private warm: SonioxStream | null = null;
  private active: SonioxStream | null = null;
  // Conversation state.
  private busy = false; // the assistant is working on a turn
  private transcribing = false;
  private muted = false; // set by a barge-in: the rest of the interrupted reply isn't spoken
  private pendingText = "";
  private spoke = false; // whether this turn has queued any speech yet
  // Playback: clips are fetched as soon as they're queued and played in order.
  private queue: Promise<AudioBuffer | null>[] = [];
  private playing = false;
  private source: AudioBufferSourceNode | null = null;
  private gen = 0; // bumped on cancel, so late clips are dropped

  constructor(private cb: Callbacks) {}

  static supported = () =>
    typeof window !== "undefined" && typeof AudioWorkletNode !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

  start = async () => {
    if (this.audio) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch (e) {
      this.cb.error(e instanceof DOMException && e.name === "NotAllowedError" ? "denied" : "failed");
      return;
    }
    try {
      const ctx = new AudioContext();
      await ctx.resume();
      const url = URL.createObjectURL(new Blob([TAP], { type: "application/javascript" }));
      await ctx.audioWorklet.addModule(url);
      URL.revokeObjectURL(url);
      const node = new AudioWorkletNode(ctx, "qazbot-tap");
      ctx.createMediaStreamSource(stream).connect(node);
      // The tap writes no output; connecting it keeps the browser pulling audio through it.
      node.connect(ctx.destination);
      node.port.onmessage = (e: MessageEvent<Float32Array>) => this.frame(e.data);
      this.audio = { ctx, stream, node, down: new Downsampler(ctx.sampleRate / RATE) };
      this.floor = -55;
      if (this.recognizer === "soniox") this.warm = this.sonioxStream();
      this.refresh();
    } catch (e) {
      console.error("talk: audio setup failed", e);
      stream.getTracks().forEach((t) => t.stop());
      this.cb.error("failed");
    }
  };

  stop = () => {
    this.cancelSpeech();
    this.warm?.close();
    this.active?.close();
    this.warm = this.active = null;
    const a = this.audio;
    this.audio = null;
    this.capture = null;
    this.preroll = [];
    this.transcribing = false;
    if (a) {
      a.node.port.onmessage = null;
      a.stream.getTracks().forEach((t) => t.stop());
      a.ctx.close().catch(() => {});
    }
    this.refresh();
    this.cb.level(0);
  };

  setRecognizer = (r: Recognizer) => {
    if (r === this.recognizer) return;
    this.recognizer = r;
    this.warm?.close();
    this.warm = r === "soniox" && this.audio ? this.sonioxStream() : null;
  };

  private sonioxStream(): SonioxStream {
    const s: SonioxStream = new SonioxStream({
      interim: (t) => s === this.active && this.cb.interim(t),
      done: (t) => {
        if (s !== this.active) return;
        const c = this.capture;
        if (c) trace(`${Math.round(performance.now() - c.since)} ms: Soniox closed the utterance, ${Math.round(c.quietMs)} ms after speech stopped: "${t}"`);
        this.endSoniox();
        if (t) this.cb.text(t);
      },
      error: () => {
        if (s !== this.active) return;
        this.endSoniox();
        this.cb.error("failed");
      },
    });
    return s;
  }

  /** The Soniox utterance is over: clear it and warm up a socket for the next one. */
  private endSoniox() {
    this.active = null;
    this.capture = null;
    this.cb.interim("");
    if (this.audio && this.recognizer === "soniox") this.warm = this.sonioxStream();
    this.refresh();
  }

  setBusy = (busy: boolean) => {
    this.busy = busy;
    this.refresh();
  };

  /** A new assistant turn is starting: speak its reply again even if the last one was interrupted. */
  beginTurn = () => {
    this.muted = false;
    this.pendingText = "";
    this.spoke = false;
  };

  /** Streamed reply text. Whole sentences are queued for speech as soon as there's enough of them. */
  feed = (delta: string) => {
    if (!this.audio || this.muted) return;
    this.pendingText += delta;
    // Start the first clip early (a short first sentence), then speak in bigger pieces.
    const cut = cutPoint(this.pendingText, this.spoke ? 80 : 12);
    if (cut < 0) return;
    this.enqueue(this.pendingText.slice(0, cut));
    this.pendingText = this.pendingText.slice(cut);
  };

  /** The reply (or one message of it) ended: speak whatever is left. */
  flush = () => {
    if (!this.audio || this.muted) return;
    this.enqueue(this.pendingText);
    this.pendingText = "";
  };

  /** Say something outside the reply stream, such as a yes/no question. */
  say = (text: string) => {
    this.muted = false;
    this.enqueue(text);
  };

  private enqueue(raw: string) {
    if (!this.audio) return;
    // Group the speakable sentences into requests of at most MAX_TTS_CHARS.
    const pieces: string[] = [];
    for (const s of chunks(raw)) {
      const last = pieces.at(-1);
      if (last !== undefined && last.length + s.length < MAX_TTS_CHARS) pieces[pieces.length - 1] = `${last} ${s}`;
      else pieces.push(s.slice(0, MAX_TTS_CHARS));
    }
    for (const p of pieces) this.queue.push(this.clip(p, this.gen));
    if (pieces.length) this.spoke = true;
    this.pump();
  }

  private async clip(text: string, gen: number) {
    try {
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, provider: this.recognizer }),
      });
      if (!res.ok) throw new Error(`speech request failed: ${res.status}`);
      const data = await res.arrayBuffer();
      if (gen !== this.gen || !this.audio) return null;
      return await this.audio.ctx.decodeAudioData(data);
    } catch (e) {
      console.warn("talk:", e);
      if (gen === this.gen && this.audio) this.cb.error("failed");
      return null;
    }
  }

  private async pump(): Promise<void> {
    if (this.playing) return;
    const next = this.queue.shift();
    if (!next) return this.refresh();
    this.playing = true;
    this.refresh();
    const gen = this.gen;
    const buffer = await next;
    if (gen !== this.gen) return; // cancelled while loading; cancelSpeech already reset playback
    if (!buffer || !this.audio) {
      this.playing = false;
      return this.pump();
    }
    const src = this.audio.ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(this.audio.ctx.destination);
    src.onended = () => {
      if (this.source !== src) return;
      this.source = null;
      this.playing = false;
      this.pump();
    };
    this.source = src;
    src.start();
    this.refresh();
  }

  private cancelSpeech() {
    this.gen++;
    this.queue = [];
    this.pendingText = "";
    this.playing = false;
    const src = this.source;
    this.source = null;
    try {
      src?.stop();
    } catch {}
    this.refresh();
  }

  private current(): TalkPhase {
    if (!this.audio) return "off";
    if (this.source) return "speaking";
    if (this.capture) return "hearing";
    if (this.transcribing || this.busy || this.playing || this.queue.length) return "thinking";
    return "listening";
  }

  private refresh() {
    const p = this.current();
    if (p === this.phase) return;
    this.phase = p;
    this.cb.phase(p);
  }

  private frame(f: Float32Array) {
    const a = this.audio;
    if (!a) return;
    let sum = 0;
    for (const x of f) sum += x * x;
    const db = 10 * Math.log10(sum / f.length + 1e-12);
    const ms = (f.length / a.ctx.sampleRate) * 1000;
    const pcm = a.down.push(f);
    const phase = this.current();

    const level = Math.max(0, Math.min(1, (db + 60) / 45));
    if (Math.abs(level - this.lastLevel) > 0.04) {
      this.lastLevel = level;
      this.cb.level(level);
    }

    const c = this.capture;
    if (c) {
      c.totalMs += ms;
      const quiet = Math.max(this.floor + 8, c.voice - QUIET_BELOW_SPEECH_DB);
      if (db > quiet) {
        if (c.quietMs >= 300) trace(`${Math.round(performance.now() - c.since)} ms: speech again after ${Math.round(c.quietMs)} ms quiet`);
        c.quietMs = 0;
        c.speechMs += ms;
        c.voice = c.voice * 0.9 + db * 0.1;
      } else c.quietMs += ms;
      const over = c.totalMs >= MAX_UTTERANCE_MS;
      if (this.active) {
        this.active.push(pcm);
        if (!c.finalized && (c.quietMs >= SONIOX_QUIET_MS || over)) {
          c.finalized = true;
          trace(`${Math.round(performance.now() - c.since)} ms: no Soniox endpoint yet, finalizing (${over ? "30 s cap" : "quiet"})`);
          this.active.finalize();
        }
        return;
      }
      c.parts.push(pcm);
      if (c.quietMs >= END_MS || over) this.finish();
      return;
    }

    // Track the background level while the room is quiet. A playing reply would leak into it, so skip then.
    if (phase !== "speaking") {
      this.floor = db < this.floor ? this.floor * 0.8 + db * 0.2 : this.floor * 0.995 + db * 0.005;
      this.floor = Math.max(-80, Math.min(-30, this.floor));
    }
    this.preroll.push(pcm);
    let kept = this.preroll.reduce((n, p) => n + p.length, 0);
    while (kept > (a.down.rate * PREROLL_MS) / 1000 && this.preroll.length > 1) kept -= this.preroll.shift()!.length;

    // The mic is open while waiting for the person, and during a reply so they can cut in.
    if (phase !== "listening" && phase !== "speaking") {
      this.loudMs = 0;
      return;
    }
    const barge = phase === "speaking";
    const threshold = barge ? Math.max(this.floor + 22, -40) : Math.max(this.floor + 14, -50);
    this.loudMs = db > threshold ? this.loudMs + ms : 0;
    if (this.loudMs < (barge ? BARGE_MS : START_MS)) return;

    if (barge) {
      this.cancelSpeech();
      this.muted = true;
    }
    const prerollMs = (kept / a.down.rate) * 1000;
    const base = { speechMs: this.loudMs, quietMs: 0, totalMs: prerollMs, voice: db, since: performance.now(), finalized: false };
    trace(`speech start (${this.recognizer}), level ${Math.round(db)} dB, floor ${Math.round(this.floor)} dB${barge ? ", barge-in" : ""}`);
    if (this.recognizer === "soniox") {
      const warm = this.warm && !this.warm.ended;
      this.active = warm ? this.warm! : this.sonioxStream();
      this.warm = null;
      if (!warm) trace("no warm Soniox socket: connecting now");
      this.active.start(this.preroll, a.down.rate);
      this.capture = { ...base, parts: [] };
    } else this.capture = { ...base, parts: this.preroll };
    this.preroll = [];
    this.loudMs = 0;
    this.refresh();
  }

  private async finish() {
    const c = this.capture;
    const a = this.audio;
    this.capture = null;
    if (!c || !a || c.speechMs < MIN_SPEECH_MS) return this.refresh();
    this.transcribing = true;
    this.refresh();
    const sent = performance.now();
    trace(`${Math.round(sent - c.since)} ms: utterance ended, ${Math.round(c.speechMs)} ms of speech; transcribing`);
    try {
      const res = await fetch("/api/voice/stt", { method: "POST", headers: { "Content-Type": "audio/wav" }, body: wav(c.parts, a.down.rate) });
      const body = (await res.json().catch(() => ({}))) as { text?: string };
      trace(`transcribed in ${Math.round(performance.now() - sent)} ms: "${body.text ?? ""}"`);
      if (this.audio !== a) return; // talk mode ended meanwhile
      if (!res.ok) this.cb.error("failed");
      else if (body.text) this.cb.text(body.text);
    } catch {
      if (this.audio === a) this.cb.error("failed");
    } finally {
      if (this.audio === a) {
        this.transcribing = false;
        this.refresh();
      }
    }
  }
}

type Handlers = { onText: (text: string) => void; onInterim: (text: string) => void };
type TalkState = ReturnType<typeof useTalkEngine>;

/** The engine and its state. Lives in TalkProvider, so it outlives the chat page. */
function useTalkEngine() {
  const [phase, setPhase] = useState<TalkPhase>("off");
  const [level, setLevel] = useState(0);
  const [error, setError] = useState<TalkError | null>(null);
  const [supported, setSupported] = useState(false);
  const handlers = useRef<Handlers>({ onText: () => {}, onInterim: () => {} });
  const engine = useRef<TalkEngine | null>(null);
  engine.current ??= new TalkEngine({
    phase: setPhase,
    level: setLevel,
    error: setError,
    text: (t) => handlers.current.onText(t),
    interim: (t) => handlers.current.onInterim(t),
  });

  useEffect(() => {
    setSupported(TalkEngine.supported());
    const e = engine.current;
    return () => e?.stop();
  }, []);

  const e = engine.current;
  return {
    handlers,
    supported,
    phase,
    level,
    error,
    start: () => {
      setError(null);
      return e.start();
    },
    stop: e.stop,
    setRecognizer: e.setRecognizer,
    setBusy: e.setBusy,
    beginTurn: e.beginTurn,
    feed: e.feed,
    flush: e.flush,
    say: e.say,
  };
}

const TalkContext = createContext<TalkState | null>(null);

/**
 * Holds talk mode for every page under /assistant. The chat page remounts when its id changes (a new
 * chat moves /assistant to /assistant/<id> after its first reply), which used to end talk mode there.
 */
export function TalkProvider({ children }: { children: ReactNode }) {
  return createElement(TalkContext.Provider, { value: useTalkEngine() }, children);
}

/** Talk mode for the mounted chat page: words heard go to `onText`, live partial words to `onInterim`. */
export function useTalk(onText: (text: string) => void, onInterim: (text: string) => void) {
  const talk = useContext(TalkContext);
  if (!talk) throw new Error("useTalk needs a TalkProvider (see app/assistant/layout.tsx).");
  const { handlers } = talk;
  useEffect(() => {
    handlers.current = { onText, onInterim };
  });
  return talk;
}
