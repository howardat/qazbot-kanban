// Assistant models on OpenRouter: three picks per price range. Prices aren't hard-coded; the picker
// reads them live from OpenRouter's catalog (see loadModelPrices), and the agent prices each request's
// token usage with the same numbers.

export type Tier = "premium" | "balanced" | "budget";

export const MODEL_TIERS: { tier: Tier; models: { id: string; label: string }[] }[] = [
  {
    tier: "premium",
    models: [
      { id: "anthropic/claude-opus-5.5", label: "Claude Opus 5.5" },
      { id: "openai/gpt-6-astra", label: "GPT-6 Astra" },
      { id: "anthropic/claude-fable-5.1", label: "Claude Fable 5.1" },
    ],
  },
  {
    tier: "balanced",
    models: [
      { id: "anthropic/claude-sonnet-5.5", label: "Claude Sonnet 5.5" },
      { id: "openai/gpt-6.1-sol", label: "GPT-6.1 Sol" },
      { id: "google/gemini-4-argon", label: "Gemini 4 Argon" },
    ],
  },
  {
    tier: "budget",
    models: [
      { id: "anthropic/claude-haiku-5.5", label: "Claude Haiku 5.5" },
      { id: "openai/gpt-6-luna", label: "GPT-6 Luna" },
      { id: "deepseek/deepseek-v4.1-flash-1017", label: "DeepSeek V4.1 Flash" },
    ],
  },
];

export const DEFAULT_MODEL = "anthropic/claude-sonnet-5.5";

/** The model to use when the viewer hasn't picked one: OPENROUTER_MODEL if set, else Claude Sonnet. */
export const defaultModel = () => process.env.OPENROUTER_MODEL?.trim() || DEFAULT_MODEL;

/** Only listed models (plus the configured default) may be requested, so a client can't pick anything pricier. */
export function isAllowedModel(model: string) {
  return model === defaultModel() || MODEL_TIERS.some((t) => t.models.some((m) => m.id === model));
}

export type ModelPrice = { input: number; output: number; cacheRead?: number; cacheWrite?: number }; // USD per million tokens

/** Live prices for the listed models from OpenRouter's public catalog, cached for a day. Empty on failure. */
export async function loadModelPrices(): Promise<Record<string, ModelPrice>> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { next: { revalidate: 86_400 } });
    if (!res.ok) return {};
    const { data } = (await res.json()) as {
      data: { id: string; pricing: { prompt: string; completion: string; input_cache_read?: string; input_cache_write?: string } }[];
    };
    const wanted = new Set([defaultModel(), ...MODEL_TIERS.flatMap((t) => t.models.map((m) => m.id))]);
    const prices: Record<string, ModelPrice> = {};
    for (const m of data) {
      if (!wanted.has(m.id)) continue;
      const { prompt, completion, input_cache_read, input_cache_write } = m.pricing;
      prices[m.id] = {
        input: +prompt * 1e6,
        output: +completion * 1e6,
        ...(input_cache_read ? { cacheRead: +input_cache_read * 1e6 } : {}),
        ...(input_cache_write ? { cacheWrite: +input_cache_write * 1e6 } : {}),
      };
    }
    return prices;
  } catch {
    return {};
  }
}
