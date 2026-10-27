import { openRouterKeyFor } from "@/lib/ai/keys";
import { audioUrl, logVoiceUsage, openRouterHeaders, sttModel } from "@/lib/ai/voice";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Talk mode sends 16 kHz mono WAV, 32 KB a second; the client stops an utterance at 30 s.
const MAX_BYTES = 1_500_000;

/** Transcribe one spoken utterance (the raw WAV is the request body) in the viewer's language. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const t = await getT();
  const key = await openRouterKeyFor(user.id);
  if (!key) return Response.json({ error: t.assistant.notConfigured }, { status: 503 });

  const audio = Buffer.from(await req.arrayBuffer());
  if (!audio.length || audio.length > MAX_BYTES) return Response.json({ error: "Invalid audio." }, { status: 400 });

  const model = sttModel();
  const res = await fetch(audioUrl("transcriptions"), {
    method: "POST",
    headers: openRouterHeaders(key.key),
    body: JSON.stringify({ model, language: t.locale, input_audio: { data: audio.toString("base64"), format: "wav" } }),
  });
  const body = (await res.json().catch(() => null)) as { text?: string; usage?: { cost?: number }; error?: { message?: string } } | null;
  if (!res.ok || typeof body?.text !== "string") {
    console.error("transcription failed", res.status, body?.error?.message);
    return Response.json({ error: t.assistant.voice.failed }, { status: 502 });
  }
  if (body.usage?.cost) await logVoiceUsage(user.id, model, body.usage.cost, key.personal);
  return Response.json({ text: body.text.trim() });
}
