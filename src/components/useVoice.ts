"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Talking to the assistant with the browser's Web Speech API: recognition for input, synthesis for
// replies. Free and key-less. Recognition exists in Chrome, Edge and Safari (Chrome sends the audio to
// Google's speech service); Firefox has no recognition, so the mic stays hidden there.

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionCtor = new () => Recognition;

const recognitionCtor = (): RecognitionCtor | null => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

/** Plain speakable text: drop markdown marks and list bullets, then split into short sentences. */
export function chunks(text: string) {
  const plain = text
    .replace(/[*_`#>|]/g, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
  // Chrome cuts long utterances off after ~15 s, so speak sentence by sentence.
  return plain.match(/[^.!?…]+[.!?…]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
}

export type VoiceError = "denied" | "failed";

export function useVoice(lang: string) {
  const [supported, setSupported] = useState({ input: false, output: false });
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const recognition = useRef<Recognition | null>(null);

  useEffect(() => {
    setSupported({ input: !!recognitionCtor(), output: typeof window !== "undefined" && "speechSynthesis" in window });
    // Voices load asynchronously in Chrome; asking once warms the list up.
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.getVoices();
    return () => {
      recognition.current?.abort();
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  /** Listen for one utterance. `onInterim` gets the words so far; `onFinal` gets the result ("" if nothing was heard). */
  const listen = useCallback(
    (onFinal: (text: string) => void, onInterim?: (text: string) => void, onError?: (e: VoiceError) => void) => {
      const Ctor = recognitionCtor();
      if (!Ctor) return;
      stopSpeaking();
      recognition.current?.abort();
      const r = new Ctor();
      r.lang = lang;
      r.interimResults = true;
      r.continuous = false;
      r.maxAlternatives = 1;
      let finalText = "";
      r.onresult = (e) => {
        let interim = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) finalText += res[0].transcript;
          else interim += res[0].transcript;
        }
        onInterim?.((finalText + interim).trim());
      };
      r.onerror = (e) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") onError?.("denied");
        else if (e.error !== "no-speech" && e.error !== "aborted") onError?.("failed");
      };
      r.onend = () => {
        setListening(false);
        recognition.current = null;
        onFinal(finalText.trim());
      };
      recognition.current = r;
      setListening(true);
      r.start();
    },
    [lang, stopSpeaking],
  );

  const stopListening = useCallback(() => recognition.current?.stop(), []);

  /** Read text aloud in the panel's language; `onEnd` runs when it finishes (not when it's cancelled). */
  const speak = useCallback(
    (text: string, onEnd?: () => void) => {
      if (!("speechSynthesis" in window)) return onEnd?.();
      const synth = window.speechSynthesis;
      synth.cancel();
      const parts = chunks(text);
      if (!parts.length) return onEnd?.();
      const prefix = lang.slice(0, 2);
      const voice =
        synth.getVoices().find((v) => v.lang === lang) ?? synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(prefix));
      setSpeaking(true);
      parts.forEach((part, i) => {
        const u = new SpeechSynthesisUtterance(part);
        u.lang = lang;
        if (voice) u.voice = voice;
        u.rate = 1.05;
        if (i === parts.length - 1) {
          u.onend = () => {
            setSpeaking(false);
            onEnd?.();
          };
          u.onerror = () => setSpeaking(false);
        }
        synth.speak(u);
      });
    },
    [lang],
  );

  return { supported, listening, speaking, listen, stopListening, speak, stopSpeaking };
}
