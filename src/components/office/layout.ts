import type { WorkRoom } from "@/lib/rooms";

// Floor plan of the office, in world units (about a metre each). x runs toward the bottom right of the
// screen, z toward the bottom left; the camera looks from +x +z, so walls at low x/z are the far ones.
//
//   z  0 ┌ inventory ┬── welding ──┬ surveillance ┬ navigation ┐
//      8 ├ robot     ┤             hall           ├────────────┤
//        │ reception │      (meeting table)       │ entertain- │
//     17 ├  lounge   ┤                            │   ment     │
//     19 │           ├─ back office ─┬────────────┴────────────┘
//     28 └───────────┴───────────────┘
//        x 0         9              24
//                                                 28           36

export type RoomId = WorkRoom | "lounge" | "inventory" | "hall";
type Side = "top" | "bottom" | "left" | "right";

/** Floor finish: plank wood, darker oak, polished concrete, or the dark stage floor. */
export type Floor = "wood" | "oak" | "concrete" | "dark";

export type RoomDef = {
  id: RoomId;
  /** x0, z0, x1, z1 */
  rect: [number, number, number, number];
  floor: Floor;
  /** Openings, as [side, from, to] along that side (whole units). */
  doors: [Side, number, number][];
};

export const FLOOR_W = 36;
export const FLOOR_D = 28;

export const ROOMS: RoomDef[] = [
  { id: "inventory", rect: [0, 0, 8, 8], floor: "concrete", doors: [["right", 3, 5], ["bottom", 3, 5]] },
  { id: "welding", rect: [8, 0, 18, 8], floor: "concrete", doors: [["bottom", 12, 14]] },
  { id: "surveillance", rect: [18, 0, 28, 8], floor: "oak", doors: [["bottom", 22, 24]] },
  { id: "navigation", rect: [28, 0, 36, 10], floor: "concrete", doors: [["left", 8, 10]] },
  { id: "receptionist", rect: [0, 8, 9, 17], floor: "wood", doors: [["right", 11, 13], ["bottom", 4, 6]] },
  { id: "hall", rect: [9, 8, 28, 19], floor: "wood", doors: [] },
  { id: "entertainment", rect: [28, 10, 36, 19], floor: "dark", doors: [["left", 13, 15]] },
  { id: "lounge", rect: [0, 17, 9, 28], floor: "oak", doors: [["right", 21, 23]] },
  { id: "back_office", rect: [9, 19, 24, 28], floor: "wood", doors: [["top", 15, 20]] },
];

export const roomById = new Map(ROOMS.map((r) => [r.id, r]));

/** Where a person can be. rot turns them from facing -z: π/2 faces -x, π faces +z, -π/2 faces +x. */
/** "vr" is the teleoperation spot: standing on a tracked mat in a headset, driving the X2. */
export type Seat = { x: number; z: number; rot: number; kind: "desk" | "couch" | "stand" | "vr" };

const row = (z: number, xs: number[], kind: Seat["kind"], rot = 0): Seat[] => xs.map((x) => ({ x, z, rot, kind }));
const range = (from: number, step: number, n: number) => Array.from({ length: n }, (_, i) => from + i * step);

/** Seats per room, filled in order. People past the last seat stand around the room's open spots. */
export const SEATS: Partial<Record<RoomId, Seat[]>> = {
  back_office: [
    ...row(21.6, range(11.5, 3.4, 4), "desk"),
    ...row(24.9, range(11.5, 3.4, 4), "desk"),
    ...row(27.3, range(11.5, 3.4, 4), "desk"),
  ],
  // The robot-receptionist team works facing their mock hotel front desk on the far wall.
  receptionist: [9.8, 12.4, 15].map((z) => ({ x: 6.9, z, rot: Math.PI / 2, kind: "desk" as const })),
  surveillance: [...row(3.6, [20.2, 23, 25.8], "desk"), ...row(6, [21.6, 24.4], "desk")],
  navigation: row(8.6, [30, 32.4, 34.8], "desk"),
  // First comes the VR teleoperator driving the X2 at the welding table; the rest of the team sits
  // at desks facing it.
  welding: [{ x: 16.8, z: 4.6, rot: Math.PI / 2, kind: "vr" }, ...row(5.6, [9.8, 12.2, 14.6], "desk")],
  entertainment: row(16.6, [30, 32.4, 34.8], "desk"),
  lounge: [
    ...[21.2, 22.5, 23.8].map((z) => ({ x: 4.1, z, rot: Math.PI / 2, kind: "couch" as const })),
    ...[1.7, 3].map((x) => ({ x, z: 19.3, rot: Math.PI, kind: "couch" as const })),
    ...[1.7, 3.2].map((x) => ({ x, z: 25.6, rot: Math.PI * 0.75, kind: "couch" as const })),
  ],
};

/** Open floor in each room for extra people and robots. */
export const SPOTS: Partial<Record<RoomId, [number, number][]>> = {
  back_office: [[23.2, 25.2], [23.2, 26.8], [10.4, 24], [16.4, 20]],
  receptionist: [[3.6, 15.9], [3.6, 9.2], [8.2, 16.3]],
  surveillance: [[27, 4.5], [19, 6.8]],
  navigation: [[35, 4], [29, 4]],
  entertainment: [[29, 18], [35.2, 18], [33, 14.6]],
  lounge: [[6.5, 19.5], [7.5, 21], [6.5, 26.2], [7.6, 25]],
  welding: [[9.2, 7], [16.9, 7.3]],
  inventory: [[2, 5], [3.4, 5], [4.8, 5], [6.2, 5], [2, 6.8], [3.4, 6.8], [4.8, 6.8], [6.2, 6.8]],
  hall: [[12, 17], [25, 17], [12, 10], [25, 10]],
};

/** Loops robodogs and walking robots follow when nobody has them. */
export const PATROLS: Partial<Record<RoomId, [number, number][]>> = {
  surveillance: [[18.9, 1.4], [27.2, 1.4], [27.2, 7.3], [18.9, 7.3]],
  navigation: [[29.5, 1.5], [35, 1.5], [35, 6.6], [29.5, 6.6]],
};

/** Where unassigned robots of a project dance, greet or wait. */
export const STAGE: [number, number][] = [[30.6, 12.2], [32.4, 12.2], [34.2, 12.2]];
/** In front of the welding test table, where the X2 scans seams for defects. */
export const INSPECT: [number, number] = [12, 2.9];
/** Behind the mock front desk in the robot-receptionist room, facing the test guest. */
export const GREETER: [number, number] = [0.95, 12.5];

export type Wall = { x0: number; z0: number; x1: number; z1: number; h: number };

const FAR_H = 2.3; // outer walls at the back
const INNER_H = 1.5; // between rooms: low enough to see over
const NEAR_H = 0.35; // outer walls facing the camera: a cutaway stub

/**
 * Wall segments: every room edge minus its doors, merged into runs, without duplicates. An edge only
 * one room touches is an outside wall: tall at the back, a low cutaway stub on the sides facing the
 * camera (a room's bottom and right), so the building can be any shape of rooms.
 */
export function buildWalls(): Wall[] {
  // "h,x,z" is the edge (x..x+1, z); "v,x,z" is (x, z..z+1).
  const unit = (side: Side, [x0, z0, x1, z1]: RoomDef["rect"], at: number) =>
    side === "top" ? `h,${at},${z0}` : side === "bottom" ? `h,${at},${z1}` : side === "left" ? `v,${x0},${at}` : `v,${x1},${at}`;
  const touches = new Map<string, Side[]>();
  const touch = (key: string, side: Side) => touches.set(key, [...(touches.get(key) ?? []), side]);
  for (const room of ROOMS) {
    const [x0, z0, x1, z1] = room.rect;
    for (let x = x0; x < x1; x++) {
      touch(unit("top", room.rect, x), "top");
      touch(unit("bottom", room.rect, x), "bottom");
    }
    for (let z = z0; z < z1; z++) {
      touch(unit("left", room.rect, z), "left");
      touch(unit("right", room.rect, z), "right");
    }
  }
  for (const room of ROOMS)
    for (const [side, from, to] of room.doors) for (let at = from; at < to; at++) touches.delete(unit(side, room.rect, at));

  const height = (sides: Side[]) => (sides.length > 1 ? INNER_H : sides[0] === "bottom" || sides[0] === "right" ? NEAR_H : FAR_H);

  const walls: Wall[] = [];
  for (const dir of ["h", "v"] as const) {
    // Group unit edges by line, then merge consecutive ones of the same height.
    const byLine = new Map<number, { at: number; h: number }[]>();
    for (const [key, sides] of touches) {
      const [d, a, b] = key.split(",");
      if (d !== dir) continue;
      const line = Number(dir === "h" ? b : a);
      byLine.set(line, [...(byLine.get(line) ?? []), { at: Number(dir === "h" ? a : b), h: height(sides) }]);
    }
    for (const [line, units] of byLine) {
      units.sort((p, q) => p.at - q.at);
      let start = 0;
      for (let i = 1; i <= units.length; i++) {
        if (i < units.length && units[i].at === units[i - 1].at + 1 && units[i].h === units[start].h) continue;
        const [from, to, h] = [units[start].at, units[i - 1].at + 1, units[start].h];
        walls.push(dir === "h" ? { x0: from, z0: line, x1: to, z1: line, h } : { x0: line, z0: from, x1: line, z1: to, h });
        start = i;
      }
    }
  }
  return walls;
}
