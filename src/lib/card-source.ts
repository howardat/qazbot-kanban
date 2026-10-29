// Where a card was made: in the app, by the in-app assistant, or over MCP (an external Claude).
// Cards made through Claude show its mark beside their creator.
export const CARD_SOURCES = ["app", "assistant", "mcp"] as const;
export type CardSource = (typeof CARD_SOURCES)[number];

export const viaClaude = (source: CardSource) => source !== "app";

/** Story point estimates a card can take. */
export const STORY_POINTS = [1, 2, 3, 5, 8, 13] as const;
