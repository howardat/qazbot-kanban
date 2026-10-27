import type { TagColor } from "@/lib/tag-colors";

// Tag swatches: background tint + readable text in both themes (see globals.css --tag-* tokens).
export const TAG_STYLE: Record<TagColor, string> = {
  sky: "bg-[var(--tag-sky-bg)] text-[var(--tag-sky-fg)]",
  gold: "bg-[var(--tag-gold-bg)] text-[var(--tag-gold-fg)]",
  green: "bg-[var(--tag-green-bg)] text-[var(--tag-green-fg)]",
  red: "bg-[var(--tag-red-bg)] text-[var(--tag-red-fg)]",
  violet: "bg-[var(--tag-violet-bg)] text-[var(--tag-violet-fg)]",
  orange: "bg-[var(--tag-orange-bg)] text-[var(--tag-orange-fg)]",
  pink: "bg-[var(--tag-pink-bg)] text-[var(--tag-pink-fg)]",
  slate: "bg-[var(--tag-slate-bg)] text-[var(--tag-slate-fg)]",
};

export const TAG_DOT: Record<TagColor, string> = {
  sky: "bg-[var(--tag-sky-fg)]",
  gold: "bg-[var(--tag-gold-fg)]",
  green: "bg-[var(--tag-green-fg)]",
  red: "bg-[var(--tag-red-fg)]",
  violet: "bg-[var(--tag-violet-fg)]",
  orange: "bg-[var(--tag-orange-fg)]",
  pink: "bg-[var(--tag-pink-fg)]",
  slate: "bg-[var(--tag-slate-fg)]",
};

const AVATAR_HUES = [195, 42, 150, 265, 20, 330, 220, 95];

export function avatarHue(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_HUES[h % AVATAR_HUES.length];
}

// Board icons: one curated set of calm, evenly bright colours (Tailwind 500s) instead of arbitrary
// hues, so neighbouring boards look like a family. White initial on top reads on every one.
// Checked for distinctness: every pair is at least ΔE 0.09 apart in OKLab, and all stay clear of the violet accent.
const BOARD_COLORS = ["#3B82F6", "#06B6D4", "#10B981", "#CA8A04", "#F97316", "#EC4899", "#A855F7", "#64748B"] as const;

/** A board's icon colour, stable for its id. */
export function boardColor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return BOARD_COLORS[h % BOARD_COLORS.length];
}
