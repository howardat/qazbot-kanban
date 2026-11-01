// Where a card was made: in the app, by the in-app assistant, or over MCP (an external Claude).
// Cards made through Claude show its mark beside their creator.
export const CARD_SOURCES = ["app", "assistant", "mcp"] as const;
export type CardSource = (typeof CARD_SOURCES)[number];

export const viaClaude = (source: CardSource) => source !== "app";

/** Story point estimates a card can take. */
export const STORY_POINTS = [1, 2, 3, 5, 8, 13] as const;

/** Story points by size: small green, medium yellow, large orange, 13 red. */
export function pointsTone(points: number) {
  if (points <= 2) return "text-emerald-600 dark:text-emerald-400";
  if (points <= 5) return "text-yellow-600 dark:text-yellow-400";
  if (points <= 8) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}
