import { z } from "zod";
import { openRouterKeyFor, sonioxKeyFor } from "@/lib/ai/keys";
import { audioUrl, logVoiceUsage, openRouterHeaders, sonioxTtsModel, sonioxVoice, ttsModel, ttsPricePerChar, ttsVoice } from "@/lib/ai/voice";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Talk mode speaks a reply a few sentences at a time, so one request stays short.
const body = z.object({ text: z.string().trim().min(1).max(1_500), provider: z.enum(["openrouter", "soniox"]).default("openrouter") });

/** Read a piece of an assistant reply aloud: streams MP3 back as Soniox or OpenRouter produces it. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const t = await getT();
  const key = await openRouterKeyFor(user.id);
  if (!key) return Response.json({ error: t.assistant.notConfigured }, { status: 503 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { text, provider } = parsed.data;

  const soniox = provider === "soniox" ? await sonioxKeyFor(user.id) : null;
  if (soniox) {
    const res = await fetch("https://tts-rt.soniox.com/tts", {
      method: "POST",
      headers: { Authorization: `Bearer ${soniox}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: sonioxTtsModel(), language: t.locale, voice: sonioxVoice(), audio_format: "mp3", text, client_reference_id: user.id }),
    });
    if (!res.ok || !res.body) {
      const err = (await res.json().catch(() => null)) as { error_message?: string; request_id?: string } | null;
      console.error("Soniox speech failed", res.status, err?.error_message, err?.request_id);
      return Response.json({ error: t.assistant.voice.failed }, { status: 502 });
    }
    // Soniox bills its own account; its usage shows in the Soniox Console, tagged with the person's id.
    return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
  }

  const model = ttsModel();
  const res = await fetch(audioUrl("speech"), {
    method: "POST",
    headers: openRouterHeaders(key.key),
    body: JSON.stringify({ model, input: text, voice: ttsVoice(t.locale), response_format: "mp3" }),
  });
  if (!res.ok || !res.body) {
    const err = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    console.error("speech failed", res.status, err?.error?.message);
    return Response.json({ error: t.assistant.voice.failed }, { status: 502 });
  }
  // Speech is billed per character of input, and the response doesn't report a cost.
  await logVoiceUsage(user.id, model, text.length * (await ttsPricePerChar(model)), key.personal);
  return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } });
}
