import { avatarHue } from "@/lib/colors";

// How a person looks: one of the 20 preset avatars they picked in Settings, or (until they pick) a
// look derived from their id and avatar hue. Shared by the 3D figure in the office and the avatar
// icon, so both always match.

export type HairStyle = "short" | "long" | "bun" | "buzz" | "curly" | "bald";
export type Extra = "glasses" | "headphones" | "beard" | "cap";

export type Look = { skin: string; hair: string; pants: string; shirt: string; style: HairStyle; extra: Extra | null; cap: string };

const SKIN = ["#f1c7a0", "#e0b08a", "#c68d62", "#9a6440", "#6b4128"];
const HAIR = ["#2a1a10", "#5a3418", "#8a4a22", "#d1aa5a", "#161616", "#6b2416"];
const PANTS = ["#33415c", "#3d3d46", "#4b3a2e", "#2f4a44"];

const p = (skin: number, hair: string, style: HairStyle, shirt: string, pants: string, extra: Extra | null = null, cap = "#e2574c"): Look => ({
  skin: SKIN[skin],
  hair,
  style,
  shirt,
  pants,
  extra,
  cap,
});

/** The 20 avatars people can pick from. The order is stored by index, so only ever append. */
export const AVATARS: Look[] = [
  p(0, "#d1aa5a", "long", "#e2574c", "#33415c"),
  p(1, "#2a1a10", "short", "#3fa7a0", "#3d3d46", "glasses"),
  p(2, "#161616", "curly", "#f2b134", "#33415c"),
  p(3, "#161616", "buzz", "#4a6fa5", "#2f4a44", "headphones"),
  p(4, "#161616", "bun", "#8e6bb8", "#3d3d46"),
  p(0, "#6b2416", "short", "#5c9a45", "#4b3a2e", "beard"),
  p(1, "#5a3418", "long", "#d84aa8", "#33415c", "glasses"),
  p(2, "#2a1a10", "short", "#2f2f33", "#3d3d46", "cap", "#4a6fa5"),
  p(3, "#2a1a10", "curly", "#ee7a2a", "#33415c", "headphones"),
  p(4, "#161616", "bald", "#3fa7a0", "#2f4a44", "beard"),
  p(0, "#8a4a22", "bun", "#4a6fa5", "#3d3d46", "glasses"),
  p(1, "#161616", "buzz", "#e2574c", "#33415c"),
  p(2, "#5a3418", "long", "#5c9a45", "#4b3a2e", "headphones"),
  p(0, "#d1aa5a", "short", "#8e6bb8", "#33415c", "cap", "#f2b134"),
  p(3, "#161616", "bun", "#f2b134", "#2f4a44"),
  p(1, "#6b2416", "curly", "#4a6fa5", "#3d3d46", "glasses"),
  p(4, "#161616", "short", "#ee7a2a", "#33415c"),
  p(2, "#2a1a10", "bald", "#2f2f33", "#4b3a2e", "glasses"),
  p(0, "#5a3418", "buzz", "#d84aa8", "#3d3d46", "beard"),
  p(3, "#2a1a10", "long", "#3fa7a0", "#33415c", "cap", "#e2574c"),
];

export const hash = (s: string, salt: number) => {
  let h = salt;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};
const pick = <T>(list: readonly T[], seed: string, salt: number) => list[hash(seed, salt) % list.length];
const AUTO_STYLES: HairStyle[] = ["short", "long", "bun", "buzz", "curly"];

export function lookOf(m: { id: string; email: string; avatar?: number | null }): Look {
  const preset = m.avatar != null ? AVATARS[m.avatar] : undefined;
  if (preset) return preset;
  return {
    skin: pick(SKIN, m.id, 7),
    hair: pick(HAIR, m.id, 13),
    pants: pick(PANTS, m.id, 29),
    shirt: `hsl(${avatarHue(m.email)}, 50%, 52%)`,
    style: pick(AUTO_STYLES, m.id, 41),
    extra: null,
    cap: "#e2574c",
  };
}
