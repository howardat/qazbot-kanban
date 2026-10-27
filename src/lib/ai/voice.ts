import "server-only";
import { db } from "@/db";
import { aiUsage } from "@/db/schema";
import { isLocale, type Locale } from "@/lib/i18n";

// Talk mode's speech models on OpenRouter: one for transcribing what the person says, one for reading
// replies aloud. Both run on the person's own OpenRouter key, like the assistant itself.

const OPENROUTER_BASE_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1";

// Voxtral Mini Transcribe 3.0 came back fastest of the Russian-capable models (~1.3 s for a 5 s clip).
export const sttModel = () => process.env.VOICE_STT_MODEL?.trim() || "mistralai/voxtral-mini-transcribe-3-0";
// MAI-Voice 2.1 Flash has native ru-RU and en-US voices; the voice's locale sets the language it speaks.
export const ttsModel = () => process.env.VOICE_TTS_MODEL?.trim() || "microsoft/mai-voice-2.1-flash";

const VOICES: Record<Locale, string> = {
  en: "en-US-Harper:MAI-Voice-2.1-Flash",
  ru: "ru-RU-Masha:MAI-Voice-2.1-Flash",
};
/** The voice for a language. VOICE_TTS_VOICE_EN / _RU override it (needed when VOICE_TTS_MODEL changes). */
export function ttsVoice(lang: string) {
  const locale: Locale = isLocale(lang) ? lang : "en";
  return process.env[`VOICE_TTS_VOICE_${locale.toUpperCase()}`]?.trim() || VOICES[locale];
}

export const openRouterHeaders = (key: string) => ({
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  "HTTP-Referer": process.env.APP_URL ?? "http://localhost:3000",
  "X-Title": "Qazbot Kanban",
});

export const audioUrl = (path: "transcriptions" | "speech") => `${OPENROUTER_BASE_URL}/audio/${path}`;

/** Dollars per character for a speech model, from OpenRouter's catalog (cached for a day). TTS responses carry no cost. */
export async function ttsPricePerChar(model: string) {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models?output_modalities=speech", { next: { revalidate: 86_400 } });
    if (!res.ok) return 0;
    const { data } = (await res.json()) as { data: { id: string; pricing: { prompt: string } }[] };
    return Number(data.find((m) => m.id === model)?.pricing.prompt) || 0;
  } catch {
    return 0;
  }
}

/** Log one speech request in the usage table, next to the assistant's own requests. */
export async function logVoiceUsage(profileId: string, model: string, costUsd: number, personal: boolean) {
  await db.insert(aiUsage).values({ profileId, model, costUsd: costUsd.toFixed(6), personal });
}

// Soniox: an optional recogniser for talk mode, on the person's own key or the team's (see sonioxKeyFor).
// It streams, so words appear while the person talks and its semantic endpointing decides when they're done.
export const sonioxModel = () => process.env.SONIOX_STT_MODEL?.trim() || "stt-rt-v5";
// Soniox TTS: every voice speaks every supported language (Russian and Kazakh included), so one voice
// covers both UI languages. Browse voices in the Soniox Console under Text-to-speech > Voices.
export const sonioxTtsModel = () => process.env.SONIOX_TTS_MODEL?.trim() || "tts-rt-v2";
export const sonioxVoice = () => process.env.SONIOX_TTS_VOICE?.trim() || "Adrian";
