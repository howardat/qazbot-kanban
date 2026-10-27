import { avatarHue } from "@/lib/colors";

// How a person looks, picked from their id (and their avatar hue for the shirt), shared by the 3D
// figure in the office and their avatar icon, so both always match.

const SKIN = ["#f1c7a0", "#e0b08a", "#c68d62", "#9a6440", "#6b4128"];
const HAIR = ["#2a1a10", "#5a3418", "#8a4a22", "#d1aa5a", "#161616", "#6b2416"];
const PANTS = ["#33415c", "#3d3d46", "#4b3a2e", "#2f4a44"];

export const hash = (s: string, salt: number) => {
  let h = salt;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
};
const pick = <T>(list: T[], seed: string, salt: number) => list[hash(seed, salt) % list.length];

export type Look = { skin: string; hair: string; pants: string; shirt: string };

export function lookOf(p: { id: string; email: string }): Look {
  return {
    skin: pick(SKIN, p.id, 7),
    hair: pick(HAIR, p.id, 13),
    pants: pick(PANTS, p.id, 29),
    shirt: `hsl(${avatarHue(p.email)}, 50%, 52%)`,
  };
}
