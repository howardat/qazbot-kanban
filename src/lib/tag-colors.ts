export const TAG_COLORS = ["sky", "gold", "green", "red", "violet", "orange", "pink", "slate"] as const;
export type TagColor = (typeof TAG_COLORS)[number];
