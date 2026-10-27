"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { useT } from "@/components/I18nProvider";
import { buildShell, buildStation, furnish } from "@/components/office/furniture";
import { Kit, PAL } from "@/components/office/kit";
import { PROJECT_COLORS, STATUS_COLORS } from "@/components/office/palette";
import {
  FLOOR_D,
  FLOOR_W,
  GREETER,
  INSPECT,
  PATROLS,
  ROOMS,
  roomById,
  SEATS,
  SPOTS,
  STAGE,
  type RoomId,
  type Seat,
} from "@/components/office/layout";
import {
  animateDog,
  animateHumanoid,
  animatePerson,
  dog,
  humanoid,
  person,
  type Dog,
  type Humanoid,
  type Person,
  type PersonMode,
  type RobotMode,
} from "@/components/office/models";
import { lookOf } from "@/components/office/look";
import { PersonIcon } from "@/components/PersonIcon";
import { staleness, type Staleness } from "@/lib/staleness";
import { displayName } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { Robot, Worker } from "@/lib/workers";

// The office floor: project rooms, a meeting hall, a robotics lab, inventory and a lounge, with every
// person at a seat in the room of their current card's project (the lounge when idle) and every robot
// next to its person, or doing its job in its project's room. Animation runs at most 30 fps and only
// while the tab is visible and the view is on screen; people's speech bubbles are HTML on top.

const FPS = 30;
/** Width the team panel takes on the right of wide screens, in px. */
const TEAM_PANEL = 290;

type LabelKind = "worker" | "robot" | "room";
type Patrol = {
  path: [number, number][];
  length: number;
  offset: number;
  speed: number;
};
type Actor =
  | { kind: "person"; model: Person; mode: PersonMode }
  | { kind: "x2"; model: Humanoid; mode: RobotMode; patrol?: Patrol }
  | { kind: "dog"; model: Dog; mode: RobotMode; patrol?: Patrol };

/** Turn a point in a seat's own frame (person facing -z) into world x/z. */
const fromSeat = (seat: Seat, lx: number, lz: number): [number, number] => {
  const c = Math.cos(seat.rot);
  const s = Math.sin(seat.rot);
  return [seat.x + lx * c + lz * s, seat.z - lx * s + lz * c];
};

function patrol(path: [number, number][], offset: number, speed: number): Patrol {
  let length = 0;
  for (let i = 0; i < path.length; i++) {
    const [ax, az] = path[i];
    const [bx, bz] = path[(i + 1) % path.length];
    length += Math.hypot(bx - ax, bz - az);
  }
  return { path, length, offset, speed };
}

/** Position and heading along a closed patrol loop at time t. */
function walk(p: Patrol, t: number): { x: number; z: number; rot: number } {
  let d = (((t * p.speed + p.offset * p.length) % p.length) + p.length) % p.length;
  for (let i = 0; i < p.path.length; i++) {
    const [ax, az] = p.path[i];
    const [bx, bz] = p.path[(i + 1) % p.path.length];
    const seg = Math.hypot(bx - ax, bz - az);
    if (d <= seg) {
      const k = d / seg;
      return {
        x: ax + (bx - ax) * k,
        z: az + (bz - az) * k,
        rot: Math.atan2(-(bx - ax), -(bz - az)),
      };
    }
    d -= seg;
  }
  return { x: p.path[0][0], z: p.path[0][1], rot: 0 };
}

type PlacedLabel = {
  obj: CSS2DObject;
  div: HTMLDivElement;
  kind: LabelKind;
  priority: number;
  state: string;
};

// Approximate on-screen label sizes in px, for overlap tests (status pills are max-w-40 and one line).
const SIZE: Record<LabelKind, [number, number]> = {
  worker: [150, 26],
  robot: [44, 14],
  room: [150, 20],
};
const CHIP = 28;
const projected = new THREE.Vector3();

/**
 * Keep labels readable: walk them by priority (rooms, busy people, idle people, robots) and nearest first;
 * a bubble that would overlap one already shown shrinks to an avatar chip, a robot tag hides. Zooming in
 * spreads people apart and brings the full bubbles back. Only changed labels touch the DOM.
 */
function declutter(labels: PlacedLabel[], camera: THREE.Camera, w: number, h: number) {
  const items = labels.map((l) => {
    l.obj.getWorldPosition(projected).project(camera);
    return { l, x: ((projected.x + 1) / 2) * w, y: ((1 - projected.y) / 2) * h };
  });
  items.sort((a, b) => b.l.priority - a.l.priority || b.y - a.y);
  const kept: [number, number, number, number][] = [];
  const hits = (r: [number, number, number, number]) => kept.some((k) => r[0] < k[2] && r[2] > k[0] && r[1] < k[3] && r[3] > k[1]);
  for (const { l, x, y } of items) {
    const [bw, bh] = SIZE[l.kind];
    // Rooms anchor at their top-left corner; bubbles and tags at their bottom middle (plus the tail).
    const full: [number, number, number, number] = l.kind === "room" ? [x, y, x + bw, y + bh] : [x - bw / 2, y - bh - 8, x + bw / 2, y - 8];
    let state = "";
    if (l.kind !== "room" && hits(full)) {
      state = l.kind === "worker" ? "compact" : "hidden";
      if (state === "compact") kept.push([x - CHIP / 2, y - CHIP - 8, x + CHIP / 2, y - 8]);
    } else kept.push(full);
    if (state !== l.state) {
      l.state = state;
      l.div.dataset.compact = String(state === "compact");
      l.div.style.visibility = state === "hidden" ? "hidden" : "";
    }
  }
}

const roomCenter = (room: RoomId): [number, number] => {
  const [x0, z0, x1, z1] = roomById.get(room)!.rect;
  return [(x0 + x1) / 2, (z0 + z1) / 2];
};

export default function WorkersScene({
  workers,
  robots,
  now,
  onSelect,
}: {
  workers: Worker[];
  robots: Robot[];
  now: number;
  /** Someone was clicked: their bubble or their figure. */
  onSelect: (workerId: string) => void;
}) {
  const t = useT();
  const mount = useRef<HTMLDivElement>(null);
  const select = useRef(onSelect);
  useEffect(() => {
    select.current = onSelect;
  }, [onSelect]);
  const [labels, setLabels] = useState<Map<string, HTMLDivElement>>(new Map());
  const [failed, setFailed] = useState(false);
  // Set once the scene exists: recolours screens for the current time and draws a frame.
  const repaint = useRef<(now: number) => void>(() => {});

  useEffect(() => {
    const el = mount.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(PAL.bg);
    renderer.domElement.style.display = "block";
    el.appendChild(renderer.domElement);
    const labelRenderer = new CSS2DRenderer();
    Object.assign(labelRenderer.domElement.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
    });
    el.appendChild(labelRenderer.domElement);

    const scene = new THREE.Scene();
    const kit = new Kit();
    scene.add(kit.staticRoot);
    buildShell(kit);
    furnish(kit);

    // Every desk gets built, occupied or not; a screen lights up only for the person sitting there.
    const screensLayer = new THREE.Group();
    scene.add(screensLayer);
    const seatScreens = new Map<Seat, THREE.MeshBasicMaterial>();
    let desks = 0;
    for (const seats of Object.values(SEATS))
      for (const seat of seats) {
        const screen = buildStation(kit, seat, screensLayer, desks++);
        if (screen) seatScreens.set(seat, screen);
      }

    const labelDivs = new Map<string, HTMLDivElement>();
    const placedLabels: PlacedLabel[] = [];
    const addLabel = (parent: THREE.Object3D, key: string, [x, y, z]: number[], center: [number, number], priority = 0) => {
      const div = document.createElement("div");
      const obj = new CSS2DObject(div);
      obj.position.set(x, y, z);
      obj.center.set(...center);
      parent.add(obj);
      labelDivs.set(key, div);
      placedLabels.push({
        obj,
        div,
        kind: key.split(":")[0] as LabelKind,
        priority,
        state: "",
      });
      return obj;
    };
    for (const room of ROOMS) addLabel(scene, `room:${room.id}`, [room.rect[0] + 0.35, 0.05, room.rect[1] + 0.35], [0, 0], 3);

    // ---------- People ----------
    const actors: { root: THREE.Object3D; actor: Actor }[] = [];
    const bubbles: { obj: CSS2DObject; base: number; seed: number }[] = [];
    const pickable: THREE.Object3D[] = [];
    const placed = new Map<string, Seat>();
    const workerScreens = new Map<string, THREE.MeshBasicMaterial>();
    const byRoom = new Map<RoomId, Worker[]>();
    for (const w of workers) byRoom.set(w.room, [...(byRoom.get(w.room) ?? []), w]);

    /** Seat n in a room: its seats first, then open spots standing, then a grid around the room's middle. */
    const seatFor = (room: RoomId, n: number): Seat => {
      const seats = SEATS[room] ?? [];
      if (n < seats.length) return seats[n];
      const spots = SPOTS[room] ?? [];
      const k = n - seats.length;
      if (k < spots.length)
        return {
          x: spots[k][0],
          z: spots[k][1],
          rot: Math.PI / 4,
          kind: "stand",
        };
      const [cx, cz] = roomCenter(room);
      const m = k - spots.length;
      return {
        x: cx + ((m % 4) - 1.5) * 0.9,
        z: cz + Math.floor(m / 4) * 0.9,
        rot: Math.PI / 4,
        kind: "stand",
      };
    };

    let teleoperated = false; // someone is on the VR teleoperation mat
    for (const [room, list] of byRoom) {
      list.forEach((w, n) => {
        const seat = seatFor(room, n);
        placed.set(w.id, seat);
        const seated = seat.kind === "desk" || seat.kind === "couch";
        const p = person(kit, w.id, lookOf(w), seated);
        p.root.position.set(seat.x, 0, seat.z);
        p.root.rotation.y = seat.rot;
        p.root.userData.id = w.id;
        if (!seated) kit.shadow(0.3, 0.25, [0, 0], p.root);
        if (seat.kind === "vr") {
          kit.box("#151515", [0.34, 0.14, 0.14], [0, 0.02, -0.15], p.head); // headset
          kit.box("#151515", [0.34, 0.04, 0.3], [0, 0.12, 0], p.head);
          kit.box("#5ff2ff", [0.2, 0.03, 0.01], [0, 0.02, -0.225], p.head);
          teleoperated = true;
        }
        scene.add(p.root);
        pickable.push(p.root);
        const mode: PersonMode = room === "lounge" ? "lounge" : seat.kind === "vr" ? "vr" : seated ? "typing" : "idle";
        actors.push({
          root: p.root,
          actor: { kind: "person", model: p, mode },
        });
        const screen = seatScreens.get(seat);
        if (screen) workerScreens.set(w.id, screen);
        const head = seated ? 1.75 : 2.12;
        // Busy people's bubbles win over idle ones when they overlap.
        bubbles.push({
          obj: addLabel(p.root, `worker:${w.id}`, [0, head, 0], [0.5, 1], w.current ? 2 : 1),
          base: head,
          seed: p.seed,
        });
      });
    }

    // ---------- Robots ----------
    const eyes = kit.own(new THREE.MeshBasicMaterial({ color: "#5ff2ff" }));
    const used = new Map<string, number>(); // robots already placed per spot list or person
    const next = (key: string) => {
      const n = used.get(key) ?? 0;
      used.set(key, n + 1);
      return n;
    };
    const spotIn = (room: RoomId): [number, number] => {
      const spots = SPOTS[room] ?? [roomCenter(room)];
      const n = next(`spot:${room}`);
      const [sx, sz] = spots[n % spots.length];
      return [sx + Math.floor(n / spots.length) * 0.7, sz];
    };
    for (const r of robots) {
      let [x, z] = [0, 0];
      let rot = Math.PI / 4;
      let y = 0;
      let mode: RobotMode = "idle";
      let path: Patrol | undefined;
      const owner = r.profileId ? placed.get(r.profileId) : undefined;
      if (owner) {
        // Beside its person: right side first, then left, then behind.
        const [lx, lz] = [
          [1.05, 0.15],
          [-1.05, 0.15],
          [0, 1.1],
        ][next(`owner:${r.profileId}`) % 3];
        [x, z] = fromSeat(owner, lx, lz);
        rot = owner.rot;
      } else if (r.project === "entertainment") {
        const n = next("stage");
        if (n < STAGE.length) {
          [x, z] = STAGE[n];
          y = 0.3; // on the stage
          rot = -Math.PI / 4;
        } else [x, z] = spotIn("entertainment");
        mode = "dance";
      } else if (r.project === "surveillance" || r.project === "navigation") {
        path = patrol(PATROLS[r.project]!, next(`patrol:${r.project}`) * 0.29, r.model === "agibot_dog" ? 0.9 : 0.5);
        mode = "walk";
      } else if (r.project === "welding" && r.model === "agibot_x2" && next("inspector") === 0) {
        // At the welding table: mirroring the VR operator when there is one, scanning on its own otherwise.
        [x, z] = INSPECT;
        rot = 0;
        mode = teleoperated ? "teleop" : "inspect";
      } else if (r.project === "receptionist" && r.model === "agibot_x2" && next("greeter") === 0) {
        [x, z] = GREETER;
        rot = -Math.PI / 2;
        mode = "greet";
      } else if (r.project) {
        [x, z] = spotIn(r.project);
      } else {
        // No project and nobody: parked in the inventory room, switched off.
        [x, z] = spotIn("inventory");
        mode = "off";
      }
      const actor: Actor =
        r.model === "agibot_dog"
          ? { kind: "dog", model: dog(kit, r.id, eyes), mode, patrol: path }
          : {
              kind: "x2",
              model: humanoid(kit, r.id, eyes),
              mode,
              patrol: path,
            };
      const root = actor.model.root;
      root.position.set(x, y, z);
      root.rotation.y = rot;
      scene.add(root);
      actors.push({ root, actor });
      addLabel(root, `robot:${r.id}`, [0, r.model === "agibot_dog" ? 0.78 : 1.5, 0], [0.5, 1]);
    }

    kit.mergeStatic();
    setLabels(labelDivs);

    // ---------- Light and camera ----------
    scene.add(new THREE.HemisphereLight("#ffffff", "#47615c", 1.7));
    const sun = new THREE.DirectionalLight("#fff4e2", 1.4);
    sun.position.set(-8, 30, 18);
    scene.add(sun);

    const center = new THREE.Vector3(FLOOR_W / 2, 0, FLOOR_D / 2);
    const camera = new THREE.OrthographicCamera();
    camera.position.copy(center).add(new THREE.Vector3(30, 27, 30));
    camera.lookAt(center);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(center);
    controls.enableRotate = false;
    controls.screenSpacePanning = true;
    controls.minZoom = 0.8;
    controls.maxZoom = 5;
    controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.PAN,
    };
    controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_PAN };
    // The constructor aimed the camera at the origin; re-aim it at the new target.
    controls.update();

    const draw = () => {
      renderer.render(scene, camera);
      labelRenderer.render(scene, camera);
      declutter(placedLabels, camera, el.clientWidth, el.clientHeight);
    };
    controls.addEventListener("change", draw);

    // Fit the floor: from this camera it is (W + D) / √2 wide and roughly 0.6 of that tall.
    const span = (FLOOR_W + FLOOR_D) / Math.SQRT2;
    const resize = () => {
      const { clientWidth: w, clientHeight: h } = el;
      if (!w || !h) return;
      // Centre the floor in the part of the view the docked team panel leaves free.
      const usable = w > 900 ? w - TEAM_PANEL : w;
      const half = Math.max(span * 0.31, (span * 0.52 * h) / usable);
      const perPx = (2 * half) / h;
      Object.assign(camera, { left: (-usable / 2) * perPx, right: (w - usable / 2) * perPx, top: half, bottom: -half, near: -200, far: 400 });
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
      draw();
    };

    // ---------- Animation ----------
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clock = new THREE.Clock();
    let time = 0;
    const step = (dt: number) => {
      time += dt;
      for (const { root, actor } of actors) {
        if (actor.kind === "person") {
          animatePerson(actor.model, time, actor.mode);
          continue;
        }
        if (actor.patrol) {
          const at = walk(actor.patrol, time);
          root.position.set(at.x, 0, at.z);
          root.rotation.y = at.rot;
        }
        if (actor.kind === "x2") animateHumanoid(actor.model, time, actor.mode);
        else animateDog(actor.model, time, actor.mode);
      }
      for (const b of bubbles) b.obj.position.y = b.base + Math.sin(time * 1.8 + b.seed) * 0.03;
    };

    let visible = true;
    const io = new IntersectionObserver(([entry]) => (visible = entry.isIntersecting));
    io.observe(el);
    let raf = 0;
    let acc = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.1);
      if (reduceMotion || document.hidden || !visible) return;
      acc += dt;
      if (acc < 1 / FPS) return;
      step(acc);
      acc = 0;
      draw();
    };

    repaint.current = (at: number) => {
      for (const w of workers) {
        const screen = workerScreens.get(w.id);
        if (!screen) continue;
        const s = staleness(w.lastUpdate, !w.current, at);
        screen.color.set(s === "fresh" ? PAL.screenFresh : s === "dim" ? PAL.screenDim : PAL.screenOff);
      }
      draw();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(el);
    step(0);
    resize();
    repaint.current(now);
    loop();

    // Click (not drag) on a person opens their page.
    const raycaster = new THREE.Raycaster();
    let downAt: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => (downAt = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 4) return;
      const rect = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      let hit: THREE.Object3D | null = raycaster.intersectObjects(pickable, true)[0]?.object ?? null;
      while (hit && !hit.userData.id) hit = hit.parent;
      if (hit) select.current(hit.userData.id);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    return () => {
      cancelAnimationFrame(raf);
      repaint.current = () => {};
      observer.disconnect();
      io.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      kit.dispose();
      renderer.dispose();
      el.replaceChildren();
      setLabels(new Map());
    };
    // `now` only seeds the first paint; later ticks go through repaint below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workers, robots]);

  useEffect(() => repaint.current(now), [now]);

  if (failed) return <p className="px-4 py-16 text-center text-sm text-muted-foreground">{t.workers.noWebgl}</p>;

  const workerById = new Map(workers.map((w) => [w.id, w]));
  const robotById = new Map(robots.map((r) => [r.id, r]));
  return (
    <div ref={mount} className="absolute inset-0 isolate touch-none overflow-hidden">
      {[...labels].map(([key, div]) => {
        const [kind, id] = key.split(":") as [LabelKind, string];
        const worker = workerById.get(id);
        const robot = robotById.get(id);
        const node =
          kind === "worker" && worker ? (
            <Bubble worker={worker} now={now} onOpen={() => select.current(worker.id)} />
          ) : kind === "robot" && robot ? (
            <span className="block rounded-sm bg-black/55 px-1 text-[9px] leading-tight whitespace-nowrap text-white/90">{robot.name}</span>
          ) : kind === "room" ? (
            <RoomTag room={id as RoomId} count={workers.filter((w) => w.room === id).length} />
          ) : null;
        return node ? createPortal(node, div, key) : null;
      })}
    </div>
  );
}

function RoomTag({ room, count }: { room: RoomId; count: number }) {
  const t = useT();
  const name = room in t.projects ? t.projects[room as keyof typeof t.projects] : t.rooms[room as keyof typeof t.rooms];
  return (
    <span className="block rounded-sm bg-[#24201c]/80 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide whitespace-nowrap text-[#f1ebe1] uppercase">
      {name}
      {count > 0 && <span className="ml-1 font-normal text-[#c9bfb2]">{count}</span>}
    </span>
  );
}

/**
 * Status over a person's head: a pill in their current project's colour (grey when idle) with their
 * avatar, a freshness dot and their name. Hover unfolds the task, when, project and next queued cards.
 * Shrinks to just the avatar when it would cover another one (see declutter).
 */
function Bubble({ worker, now, onOpen: open }: { worker: Worker; now: number; onOpen: () => void }) {
  const t = useT();
  const task = worker.current;
  const s: Staleness = staleness(worker.lastUpdate, !task, now);
  const accent = task ? PROJECT_COLORS[task.project] : STATUS_COLORS.stale;
  const ago = worker.lastUpdate ? t.fmt.ago(worker.lastUpdate, now) : t.workers.neverUpdated;
  return (
    <>
      <button
        type="button"
        onClick={open}
        title={`${displayName(worker)}: ${task ? task.title : t.workers.idle}`}
        className="pointer-events-auto relative mb-2 hidden cursor-pointer rounded-full shadow-[0_2px_6px_rgba(0,0,0,0.35)] outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [[data-compact=true]_&]:block"
        style={{ boxShadow: `0 0 0 2px ${task ? accent : "#f7f3ec"}, 0 2px 6px rgba(0,0,0,0.35)` }}
      >
        <PersonIcon member={worker} size={24} className={cn(!task && "opacity-80 grayscale-[40%]")} />
        <span aria-hidden className="absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-[#f7f3ec]" style={{ background: STATUS_COLORS[s] }} />
      </button>
      {/* A small pill in the project's colour with the person's name. Hover or focus unfolds task, when and queue. */}
      <button
        type="button"
        onClick={open}
        className={cn(
          "group pointer-events-auto relative mb-2 block max-w-40 cursor-pointer rounded-full py-0.5 pr-2.5 pl-1 text-left leading-tight text-white shadow-[0_2px_10px_rgba(0,0,0,0.45)] ring-2 ring-white/90 outline-none transition-[border-radius] hover:max-w-56 hover:rounded-xl focus-visible:max-w-56 focus-visible:rounded-xl focus-visible:ring-ring [[data-compact=true]_&]:hidden",
          s === "stale" && task && "saturate-[0.65]",
        )}
        style={{ background: task ? accent : "#7d746b" }}
      >
        <span className="flex items-center gap-1.5">
          <span className="relative shrink-0">
            <PersonIcon member={worker} size={18} className="ring-1 ring-white/70" />
            <span
              aria-hidden
              className={cn("absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-[1.5px] ring-white", s === "fresh" && "animate-pulse")}
              style={{ background: STATUS_COLORS[s] }}
            />
          </span>
          <span className="truncate text-[11px] font-semibold drop-shadow-[0_1px_0_rgba(0,0,0,0.25)]">{displayName(worker)}</span>
        </span>
        <span className="hidden pt-1 pb-1 pl-1 text-[10px] text-white/90 group-hover:block group-focus-visible:block">
          <span className="block truncate text-[11px] font-semibold text-white">{task ? task.title : t.workers.idle}</span>
          <span className="mt-0.5 flex items-center gap-1">
            {task && <span className="truncate">{t.projects[task.project]}</span>}
            <span className="ml-auto shrink-0 pl-1">{ago}</span>
          </span>
          {worker.queue.length > 0 && (
            <span className="mt-1 block border-t border-white/25 pt-1">
              <span className="block font-medium">{t.workers.queued(worker.queue.length)}</span>
              {worker.queue.slice(0, 3).map((q, i) => (
                <span key={q.id} className="block truncate">
                  {i + 1}. {q.title}
                </span>
              ))}
            </span>
          )}
        </span>
      </button>
    </>
  );
}
