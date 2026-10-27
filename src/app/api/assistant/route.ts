import { z } from "zod";
import { monthlyBudgetUsd, monthSpendUsd, runAgent, type AgentEvent } from "@/lib/ai/agent";
import { defaultModel, isAllowedModel, loadModelPrices, MODEL_TIERS } from "@/lib/ai/models";
import { openRouterKeyFor } from "@/lib/ai/keys";
import { getT } from "@/lib/i18n/server";
import { track } from "@/lib/activity";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Usable when the team has a key or this person brought their own.
const configured = async (profileId: string) => !!(await openRouterKeyFor(profileId));

/** Picker data: the curated models with live prices, the default, and this month's spend. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const [prices, monthUsd, key] = await Promise.all([loadModelPrices(), monthSpendUsd(), openRouterKeyFor(user.id)]);
  return Response.json({
    configured: !!key,
    personalKey: !!key?.personal,
    defaultModel: defaultModel(),
    tiers: MODEL_TIERS,
    prices,
    monthUsd,
    budgetUsd: monthlyBudgetUsd(),
  });
}

const body = z.object({
  model: z.string().max(100),
  chatId: z.uuid().nullable().default(null),
  text: z.string().trim().min(1).max(8_000).nullable().default(null),
  approvals: z.record(z.string(), z.boolean()).default({}),
});

/** One assistant turn on a saved chat, streamed as newline-delimited JSON events (see AgentEvent). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const t = await getT();
  if (!(await configured(user.id))) return Response.json({ error: t.assistant.notConfigured }, { status: 503 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
  const { model, chatId, text, approvals } = parsed.data;
  if (!isAllowedModel(model)) return Response.json({ error: "That model isn't available here." }, { status: 400 });
  if (!text && !chatId) return Response.json({ error: "Invalid request." }, { status: 400 });
  await track(user.id, "assistant.chat");

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (e: AgentEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        await runAgent({ user, t, model, chatId, text, approvals, emit });
      } catch (e) {
        emit({ type: "error", message: e instanceof Error ? e.message : t.assistant.failed });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
