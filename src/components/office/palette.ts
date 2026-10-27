// Flat colours for the office. Kept free of three.js so page UI can share them without loading it.

import type { Project } from "@/lib/projects";

export const PAL = {
  bg: "#24201c",
  wall: "#f1ebe1",
  cap: "#ffffff",
  deskTop: "#d6ae78",
  deskLeg: "#f5f2ec",
  metal: "#7d8288",
  metalDark: "#3e4247",
  wood: "#8a5a34",
  woodLight: "#c79a62",
  paper: "#f1efe6",
  box: "#c99b62",
  boxDark: "#a97c48",
  plant: "#5c9a45",
  plantDark: "#3f7a35",
  pot: "#d27d4f",
  couch: "#e0884f",
  couchDark: "#b86a39",
  teal: "#3fa7a0",
  rug: "#e9d8b4",
  // Desk screens and lamps: the 3D-lit versions of STATUS_COLORS below.
  screenFresh: "#7fe0a8",
  screenDim: "#f0b44a",
  screenOff: "#2a2f2e",
  tape: "#e7c33a",
  cone: "#ee7a2a",
  stage: "#2c2638",
  shadow: "#000000",
};

/** Mismatched chair colours, picked per desk. */
export const CHAIRS = ["#e2574c", "#f2b134", "#3fa7a0", "#4a6fa5", "#8e6bb8", "#2f2f33"];

/** One colour per project: room accents and the stripe on people's status cards. */
export const PROJECT_COLORS: Record<Project, string> = {
  receptionist: "#3fa7a0",
  surveillance: "#4a6fa5",
  entertainment: "#d84aa8",
  navigation: "#e0a12e",
  welding: "#ee7a2a",
  back_office: "#8e6bb8",
};

/** Status dot colours: updated today, 1–3 days ago, older or idle. Match the desk lamps. */
export const STATUS_COLORS = { fresh: "#4cc38a", dim: "#e0a12e", stale: "#9a918a" } as const;
