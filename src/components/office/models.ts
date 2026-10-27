import * as THREE from "three";
import type { Kit } from "./kit";
import { hash, type Look } from "./look";

// People and robots, built from boxes around pivot groups so they can move. Every model faces -z with
// its feet at the origin. Animations are pure functions of time, so a paused scene resumes seamlessly.

/** A pivot group at `pos` inside `parent`, so a limb can rotate about its joint. */
function joint(parent: THREE.Object3D, [x, y, z]: number[]) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

// ---------- People ----------

export type Person = {
  root: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  seed: number;
};

/** A person sitting (feet forward under a desk) or standing, dressed in their look. */
export function person(kit: Kit, id: string, { skin, hair, pants, shirt, style, extra, cap }: Look, seated: boolean): Person {
  const root = new THREE.Group();
  const hip = seated ? 0.55 : 0.92;

  if (seated) {
    kit.box(pants, [0.42, 0.14, 0.46], [0, hip, -0.14], root);
    for (const x of [-0.11, 0.11]) {
      kit.box(pants, [0.14, 0.5, 0.14], [x, 0.3, -0.34], root);
      kit.box("#2a2a2a", [0.14, 0.08, 0.22], [x, 0.04, -0.4], root);
    }
  } else {
    for (const x of [-0.11, 0.11]) {
      kit.box(pants, [0.15, 0.86, 0.16], [x, 0.47, 0], root);
      kit.box("#2a2a2a", [0.15, 0.08, 0.24], [x, 0.04, -0.04], root);
    }
  }
  kit.box(shirt, [0.46, 0.56, 0.28], [0, hip + 0.33, 0.04], root);

  const head = joint(root, [0, hip + 0.78, 0.03]);
  kit.box(skin, [0.3, 0.32, 0.3], [0, 0, 0], head);
  hairAndExtras(kit, head, { hair, style, extra, cap });

  const arm = (side: number) => {
    const shoulder = joint(root, [side * 0.29, hip + 0.55, 0.04]);
    kit.box(shirt, [0.13, 0.32, 0.14], [0, -0.15, 0], shoulder);
    const elbow = joint(shoulder, [0, -0.3, 0]);
    kit.box(shirt, [0.12, 0.12, 0.34], [0, 0, -0.16], elbow);
    kit.box(skin, [0.11, 0.1, 0.1], [0, 0, -0.37], elbow);
    return { shoulder, elbow };
  };
  const l = arm(-1);
  const r = arm(1);
  if (!seated) {
    // Standing: arms hang down by the sides.
    l.elbow.rotation.x = r.elbow.rotation.x = Math.PI / 2 - 0.2;
  }
  return { root, head, armL: l.shoulder, armR: r.shoulder, elbowL: l.elbow, elbowR: r.elbow, seed: hash(id, 3) % 1000 };
}

/** Hair in its style, plus glasses, headphones, a beard or a cap, on a head facing -z. */
function hairAndExtras(kit: Kit, head: THREE.Group, { hair, style, extra, cap }: Pick<Look, "hair" | "style" | "extra" | "cap">) {
  const b = (color: string, size: number[], pos: number[]) => kit.box(color, size, pos, head);
  if (extra !== "cap") {
    if (style === "short" || style === "bun") b(hair, [0.33, 0.1, 0.33], [0, 0.18, 0.01]);
    if (style === "short" || style === "bun") b(hair, [0.33, 0.24, 0.08], [0, 0.06, 0.15]);
    if (style === "bun") b(hair, [0.14, 0.12, 0.14], [0, 0.28, 0.09]);
    if (style === "buzz") b(hair, [0.31, 0.05, 0.31], [0, 0.17, 0.005]);
    if (style === "buzz") b(hair, [0.31, 0.18, 0.03], [0, 0.07, 0.155]);
    if (style === "long") {
      b(hair, [0.33, 0.1, 0.33], [0, 0.18, 0.01]);
      b(hair, [0.34, 0.44, 0.09], [0, -0.04, 0.15]);
      for (const x of [-0.165, 0.165]) b(hair, [0.04, 0.32, 0.26], [x, 0.0, 0.04]);
    }
    if (style === "curly") {
      b(hair, [0.38, 0.16, 0.38], [0, 0.2, 0.02]);
      b(hair, [0.38, 0.26, 0.1], [0, 0.04, 0.16]);
    }
    if (style === "bald") for (const x of [-0.155, 0.155]) b(hair, [0.03, 0.08, 0.2], [x, 0.0, 0.03]);
  } else {
    // A cap over the hair, brim forward.
    b(hair, [0.32, 0.16, 0.06], [0, 0.04, 0.15]);
    b(cap, [0.34, 0.1, 0.34], [0, 0.19, 0.01]);
    b(cap, [0.3, 0.03, 0.14], [0, 0.15, -0.2]);
  }
  if (extra === "glasses") b("#1a1a1a", [0.3, 0.05, 0.02], [0, 0.02, -0.16]);
  if (extra === "headphones") {
    b("#26292c", [0.36, 0.04, 0.06], [0, 0.21, 0]);
    for (const x of [-0.17, 0.17]) b("#26292c", [0.05, 0.13, 0.12], [x, 0.0, 0]);
  }
  if (extra === "beard") b(hair, [0.26, 0.12, 0.05], [0, -0.11, -0.15]);
}

export type PersonMode = "typing" | "idle" | "lounge" | "vr";

/**
 * Arm pose of the VR teleoperator at time t, as shoulder pitch (left, right) and elbow bend. The X2 at
 * the welding table copies the same pose, so it visibly mirrors its operator.
 */
export function teleopPose(t: number) {
  return {
    left: -1.1 + Math.sin(t * 0.9) * 0.35,
    right: -1.2 + Math.sin(t * 0.9 + 1.3) * 0.45,
    elbow: 0.4 + Math.sin(t * 1.4) * 0.25,
    turn: Math.sin(t * 0.45) * 0.3,
  };
}

export function animatePerson(p: Person, t: number, mode: PersonMode) {
  const s = p.seed;
  if (mode === "typing") {
    // Hands patter on the keyboard; now and then a glance at the screen.
    p.elbowL.rotation.x = Math.sin(t * 14 + s) * 0.08;
    p.elbowR.rotation.x = Math.sin(t * 14 + s + 1.7) * 0.08;
    p.head.rotation.x = Math.sin(t * 0.7 + s) * 0.05 - 0.05;
    p.head.rotation.y = Math.sin(t * 0.4 + s) * 0.08;
  } else if (mode === "vr") {
    // Arms out in front, moving the robot's hands; head turning with the headset.
    const pose = teleopPose(t);
    p.armL.rotation.x = pose.left;
    p.armR.rotation.x = pose.right;
    p.elbowL.rotation.x = p.elbowR.rotation.x = -pose.elbow;
    p.head.rotation.y = pose.turn;
    p.head.rotation.x = 0.15;
  } else if (mode === "lounge") {
    // Watching TV, laughing now and then.
    p.armL.rotation.x = p.armR.rotation.x = 0.35;
    p.elbowL.rotation.x = p.elbowR.rotation.x = 0.6;
    p.head.rotation.y = Math.sin(t * 0.3 + s) * 0.25;
    p.head.rotation.x = Math.max(0, Math.sin(t * 2.2 + s)) * 0.08 * (Math.sin(t * 0.35 + s) > 0.6 ? 1 : 0);
  } else {
    p.head.rotation.y = Math.sin(t * 0.5 + s) * 0.3;
    p.root.position.y = Math.sin(t * 1.6 + s) * 0.006;
  }
}

// ---------- AgiBot X2 humanoid ----------

export type Humanoid = {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  hipL: THREE.Group;
  hipR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  shoulderL: THREE.Group;
  shoulderR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  seed: number;
};

/**
 * AgiBot X2: a 1.3 m white humanoid with dark joints, a black face screen with two cyan eyes and a
 * chest light.
 */
export function humanoid(kit: Kit, id: string, eyes: THREE.Material): Humanoid {
  const white = "#f2f3f0";
  const grey = "#2e3236";
  const root = new THREE.Group();
  const body = joint(root, [0, 0, 0]);

  const leg = (side: number) => {
    const hip = joint(body, [side * 0.09, 0.66, 0]);
    kit.box(grey, [0.1, 0.08, 0.1], [0, 0, 0], hip);
    kit.box(white, [0.11, 0.28, 0.13], [0, -0.17, 0], hip);
    const knee = joint(hip, [0, -0.32, 0]);
    kit.box(grey, [0.09, 0.07, 0.09], [0, 0, 0], knee);
    kit.box(white, [0.1, 0.27, 0.11], [0, -0.16, 0.01], knee);
    kit.box(grey, [0.11, 0.05, 0.2], [0, -0.31, -0.03], knee);
    return { hip, knee };
  };
  const l = leg(-1);
  const r = leg(1);

  kit.box(grey, [0.24, 0.1, 0.15], [0, 0.69, 0], body); // pelvis
  kit.box(white, [0.3, 0.34, 0.18], [0, 0.92, 0], body); // torso
  kit.box(grey, [0.2, 0.16, 0.02], [0, 0.94, -0.095], body); // chest panel
  kit.box(eyes, [0.04, 0.04, 0.02], [0, 0.94, -0.105], body); // status light

  const head = joint(body, [0, 1.12, 0]);
  kit.box(grey, [0.07, 0.06, 0.07], [0, -0.02, 0], head); // neck
  kit.box(white, [0.22, 0.2, 0.2], [0, 0.1, 0], head);
  kit.box("#0c0d10", [0.18, 0.12, 0.02], [0, 0.1, -0.1], head); // face screen
  for (const x of [-0.04, 0.04]) kit.box(eyes, [0.03, 0.03, 0.01], [x, 0.11, -0.112], head);

  const arm = (side: number) => {
    const shoulder = joint(body, [side * 0.2, 1.03, 0]);
    kit.box(grey, [0.08, 0.08, 0.08], [0, 0, 0], shoulder);
    kit.box(white, [0.08, 0.22, 0.09], [0, -0.13, 0], shoulder);
    const elbow = joint(shoulder, [0, -0.26, 0]);
    kit.box(grey, [0.07, 0.06, 0.07], [0, 0, 0], elbow);
    kit.box(white, [0.07, 0.2, 0.08], [0, -0.11, 0], elbow);
    kit.box(grey, [0.06, 0.06, 0.06], [0, -0.24, 0], elbow);
    return { shoulder, elbow };
  };
  const al = arm(-1);
  const ar = arm(1);
  kit.shadow(0.3, 0.25, [0, 0], root);

  return {
    root,
    body,
    head,
    hipL: l.hip,
    hipR: r.hip,
    kneeL: l.knee,
    kneeR: r.knee,
    shoulderL: al.shoulder,
    shoulderR: ar.shoulder,
    elbowL: al.elbow,
    elbowR: ar.elbow,
    seed: hash(id, 5) % 1000,
  };
}

/** inspect: scanning weld seams on its own; teleop: mirroring the VR operator. */
export type RobotMode = "dance" | "walk" | "idle" | "greet" | "inspect" | "teleop" | "off";

export function animateHumanoid(h: Humanoid, t: number, mode: RobotMode) {
  const s = h.seed;
  const reset = () => {
    for (const j of [h.hipL, h.hipR, h.kneeL, h.kneeR, h.shoulderL, h.shoulderR, h.elbowL, h.elbowR, h.head]) j.rotation.set(0, 0, 0);
    h.body.position.y = 0;
    h.body.rotation.set(0, 0, 0);
  };
  reset();
  if (mode === "dance") {
    const beat = t * 4 + s;
    const bounce = (1 - Math.cos(beat * 2)) / 2;
    h.body.position.y = -bounce * 0.05;
    h.hipL.rotation.x = h.hipR.rotation.x = -bounce * 0.35;
    h.kneeL.rotation.x = h.kneeR.rotation.x = bounce * 0.7;
    h.body.rotation.y = Math.sin(beat) * 0.35;
    h.shoulderL.rotation.z = -1.6 - Math.sin(beat) * 0.9;
    h.shoulderR.rotation.z = 1.6 - Math.sin(beat + Math.PI) * 0.9;
    h.elbowL.rotation.z = -0.6;
    h.elbowR.rotation.z = 0.6;
    h.head.rotation.z = Math.sin(beat) * 0.2;
  } else if (mode === "walk") {
    const step = t * 6 + s;
    h.hipL.rotation.x = Math.sin(step) * 0.45;
    h.hipR.rotation.x = -Math.sin(step) * 0.45;
    h.kneeL.rotation.x = Math.max(0, -Math.sin(step)) * 0.6;
    h.kneeR.rotation.x = Math.max(0, Math.sin(step)) * 0.6;
    h.shoulderL.rotation.x = -Math.sin(step) * 0.4;
    h.shoulderR.rotation.x = Math.sin(step) * 0.4;
    h.body.position.y = Math.abs(Math.cos(step)) * 0.025;
  } else if (mode === "teleop") {
    const pose = teleopPose(t);
    h.shoulderL.rotation.x = pose.left;
    h.shoulderR.rotation.x = pose.right;
    h.elbowL.rotation.x = h.elbowR.rotation.x = -pose.elbow;
    h.head.rotation.y = pose.turn;
    h.head.rotation.x = 0.35;
  } else if (mode === "inspect") {
    // Leaning over the table, sweeping a camera hand slowly along the seams.
    const sweep = Math.sin(t * 0.6 + s);
    h.body.rotation.x = 0.12;
    h.body.rotation.y = sweep * 0.35;
    h.shoulderR.rotation.x = -1.3;
    h.elbowR.rotation.x = -0.3;
    h.head.rotation.x = 0.5;
    h.head.rotation.y = sweep * 0.2;
  } else if (mode === "greet" || mode === "idle") {
    h.body.rotation.y = Math.sin(t * 0.6 + s) * 0.08;
    h.head.rotation.y = Math.sin(t * 0.45 + s) * 0.35;
    // Wave for two seconds out of every seven (the greeter waves twice as often).
    const cycle = (t + s) % (mode === "greet" ? 3.5 : 7);
    if (cycle < 2) {
      h.shoulderR.rotation.z = 2.6;
      h.elbowR.rotation.z = 0.4 + Math.sin(t * 10) * 0.35;
    }
  } else {
    // Powered off: head down, arms slack.
    h.head.rotation.x = 0.45;
    h.kneeL.rotation.x = h.kneeR.rotation.x = 0.08;
    h.body.position.y = -0.01;
  }
}

// ---------- AgiBot robodog ----------

export type Dog = { root: THREE.Group; body: THREE.Group; head: THREE.Group; legs: { hip: THREE.Group; knee: THREE.Group; phase: number }[]; seed: number };

/** AgiBot quadruped: dark grey body with a sensor head, lidar puck and four jointed legs. */
export function dog(kit: Kit, id: string, eyes: THREE.Material): Dog {
  const dark = "#33373c";
  const light = "#c9ccd0";
  const root = new THREE.Group();
  const body = joint(root, [0, 0.4, 0]);
  kit.box(dark, [0.3, 0.16, 0.66], [0, 0, 0], body);
  kit.box(light, [0.24, 0.03, 0.5], [0, 0.095, 0.02], body);
  kit.box("#1a1c1f", [0.26, 0.05, 0.2], [0, -0.08, 0.05], body); // battery
  const head = joint(body, [0, 0.02, -0.35]);
  kit.box(dark, [0.24, 0.13, 0.12], [0, 0, 0], head);
  kit.box("#0c0d10", [0.2, 0.07, 0.02], [0, 0, -0.065], head);
  for (const x of [-0.05, 0.05]) kit.box(eyes, [0.03, 0.025, 0.01], [x, 0.005, -0.077], head);
  kit.box(dark, [0.09, 0.05, 0.09], [0, 0.1, 0.12], body); // lidar puck
  kit.box(light, [0.07, 0.03, 0.07], [0, 0.135, 0.12], body);

  // Trot gait: diagonal pairs move together.
  const corners: [number, number, number][] = [
    [-1, -1, 0],
    [1, -1, Math.PI],
    [-1, 1, Math.PI],
    [1, 1, 0],
  ];
  const legs = corners.map(([sx, sz, phase]) => {
    const hip = joint(body, [sx * 0.19, -0.02, sz * 0.25]);
    kit.box(dark, [0.07, 0.08, 0.1], [0, 0, 0], hip);
    kit.box(light, [0.06, 0.2, 0.07], [0, -0.1, 0.02], hip);
    const knee = joint(hip, [0, -0.2, 0.03]);
    kit.box(dark, [0.045, 0.2, 0.05], [0, -0.1, -0.02], knee);
    kit.box("#16181a", [0.06, 0.04, 0.06], [0, -0.2, -0.03], knee);
    return { hip, knee, phase };
  });
  kit.shadow(0.3, 0.45, [0, 0], root);
  return { root, body, head, legs, seed: hash(id, 11) % 1000 };
}

export function animateDog(d: Dog, t: number, mode: RobotMode) {
  const s = d.seed;
  d.body.position.y = 0.4;
  d.body.rotation.set(0, 0, 0);
  d.head.rotation.set(0, 0, 0);
  if (mode === "walk") {
    const step = t * 9 + s;
    for (const leg of d.legs) {
      leg.hip.rotation.x = Math.sin(step + leg.phase) * 0.45;
      leg.knee.rotation.x = -0.35 - Math.max(0, Math.cos(step + leg.phase)) * 0.45;
    }
    d.body.position.y = 0.4 + Math.abs(Math.sin(step)) * 0.015;
    d.head.rotation.y = Math.sin(t * 0.8 + s) * 0.15;
  } else if (mode === "off") {
    // Lying down with folded legs.
    d.body.position.y = 0.17;
    for (const leg of d.legs) {
      leg.hip.rotation.x = -1.1;
      leg.knee.rotation.x = 2.2;
    }
  } else {
    // Sitting by its person, looking around.
    d.body.rotation.x = -0.35;
    d.body.position.y = 0.33;
    d.legs.forEach((leg, i) => {
      const rear = i >= 2;
      leg.hip.rotation.x = rear ? -1.3 : 0.35;
      leg.knee.rotation.x = rear ? 2.1 : -0.35;
    });
    d.head.rotation.x = 0.3;
    d.head.rotation.y = Math.sin(t * 0.5 + s) * 0.5;
    d.body.scale.y = 1 + Math.sin(t * 2 + s) * 0.01;
  }
}
