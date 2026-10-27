import { sonioxKeyFor } from "@/lib/ai/keys";
import { sonioxModel } from "@/lib/ai/voice";
import { getT } from "@/lib/i18n/server";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * A short-lived Soniox key for one talk-mode utterance, so the browser can stream to Soniox directly
 * without seeing the real key. Single use and capped at two minutes; usage is tagged with the person's id.
 */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const key = await sonioxKeyFor(user.id);
  if (!key) return Response.json({ error: "Soniox isn't set up." }, { status: 404 });
  const t = await getT();

  const res = await fetch("https://api.soniox.com/v1/auth/temporary-api-key", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      usage_type: "transcribe_websocket",
      expires_in_seconds: 60,
      single_use: true,
      max_session_duration_seconds: 120,
      client_reference_id: user.id,
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as { api_key?: string; error_message?: string } | null;
  if (!res.ok || !body?.api_key) {
    console.error("Soniox temporary key failed", res.status, body?.error_message);
    return Response.json({ error: t.assistant.voice.failed }, { status: 502 });
  }
  return Response.json({ apiKey: body.api_key, model: sonioxModel(), language: t.locale });
}
