import * as THREE from "three";
import { CHAIRS, PAL, type Kit } from "./kit";
import { buildWalls, FLOOR_D, FLOOR_W, ROOMS, type Floor, type Seat } from "./layout";

// The building and everything that never moves, in a startup-house style: plank floors, exposed
// brick on the outer walls, wooden desks with mismatched chairs, plants everywhere, neon signs and
// sticky notes. All of it goes into the kit's static layer and is merged before the first frame.

/** A group placed and turned like a seat, so furniture can be laid out in the seat's own frame. */
function frame(kit: Kit, x: number, z: number, rot: number) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = rot;
  kit.staticRoot.add(g);
  return g;
}

/** A plane whose texture repeats every `tile` units instead of stretching across it. */
function tiled(kit: Kit, material: THREE.Material, w: number, h: number, tile: [number, number]) {
  const geo = kit.own(new THREE.PlaneGeometry(w, h));
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / tile[0], (uv.getY(i) * h) / tile[1]);
  return new THREE.Mesh(geo, material);
}

function repeating(kit: Kit, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const tex = kit.texture(w, h, draw);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return kit.own(new THREE.MeshLambertMaterial({ map: tex }));
}

function floorMaterials(kit: Kit): Record<Floor, THREE.Material> {
  const planks = (light: string, dark: string, seam: string) =>
    repeating(kit, 256, 256, (g) => {
      for (let row = 0; row < 8; row++) {
        g.fillStyle = row % 2 ? light : dark;
        g.fillRect(0, row * 32, 256, 32);
        g.fillStyle = seam;
        g.fillRect(0, row * 32, 256, 2);
        g.fillRect(((row * 97) % 200) + 20, row * 32, 2, 32); // plank ends
        g.fillRect(((row * 53 + 120) % 230) + 10, row * 32, 2, 32);
      }
    });
  return {
    wood: planks("#d7b384", "#cfaa7a", "#b48d5e"),
    oak: planks("#a8754a", "#9e6c42", "#835631"),
    concrete: repeating(kit, 128, 128, (g) => {
      g.fillStyle = "#b9b5ad";
      g.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 160; i++) {
        g.fillStyle = i % 2 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.06)";
        g.fillRect((i * 37) % 128, (i * 71) % 128, 3, 3);
      }
      g.fillStyle = "rgba(0,0,0,0.12)";
      g.fillRect(0, 0, 128, 1);
      g.fillRect(0, 0, 1, 128);
    }),
    dark: kit.mat(PAL.stage),
  };
}

export function buildShell(kit: Kit) {
  const floors = floorMaterials(kit);
  for (const room of ROOMS) {
    const [x0, z0, x1, z1] = room.rect;
    // Slab under each room, so the cutaway shows some thickness like the reference.
    kit.box("#15120f", [x1 - x0 + 0.4, 0.4, z1 - z0 + 0.4], [(x0 + x1) / 2, -0.21, (z0 + z1) / 2]);
    const mesh = tiled(kit, floors[room.floor], x1 - x0, z1 - z0, [2.5, 2.5]);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    kit.staticRoot.add(mesh);
  }
  for (const w of buildWalls()) {
    const t = 0.2;
    const along = w.z0 === w.z1;
    const len = (along ? w.x1 - w.x0 : w.z1 - w.z0) + t;
    const cx = (w.x0 + w.x1) / 2;
    const cz = (w.z0 + w.z1) / 2;
    kit.box(PAL.wall, along ? [len, w.h, t] : [t, w.h, len], [cx, w.h / 2, cz]);
    kit.box(PAL.cap, along ? [len + 0.04, 0.07, t + 0.06] : [t + 0.06, 0.07, len + 0.04], [cx, w.h + 0.035, cz]);
  }
  // Exposed brick on the inside of the two outer back walls.
  const brick = repeating(kit, 128, 64, (g) => {
    g.fillStyle = "#d9cfc2";
    g.fillRect(0, 0, 128, 64);
    for (let row = 0; row < 4; row++)
      for (let col = -1; col < 4; col++) {
        const x = col * 32 + (row % 2 ? 16 : 0) + 1;
        g.fillStyle = ["#b8603f", "#a9553a", "#c46b48", "#9e4f35"][(row * 3 + col + 4) % 4];
        g.fillRect(x, row * 16 + 1, 30, 14);
      }
  });
  const h = 2.3;
  const back = tiled(kit, brick, FLOOR_W, h, [1.6, 0.8]);
  back.position.set(FLOOR_W / 2, h / 2, 0.105);
  kit.staticRoot.add(back);
  const side = tiled(kit, brick, FLOOR_D, h, [1.6, 0.8]);
  side.rotation.y = Math.PI / 2;
  side.position.set(0.105, h / 2, FLOOR_D / 2);
  kit.staticRoot.add(side);
}

/**
 * A workplace in the seat's frame (the person faces -z): a wooden desk on white trestle legs with a
 * monitor, a desk lamp and some clutter, plus a colourful chair. Returns the material shared by the
 * screen and the lamp, so both glow with the person's status.
 */
export function buildStation(kit: Kit, seat: Seat, screens: THREE.Group, index: number): THREE.MeshBasicMaterial | null {
  if (seat.kind === "couch" || seat.kind === "stand") return null;
  const f = frame(kit, seat.x, seat.z, seat.rot);
  const status = kit.own(new THREE.MeshBasicMaterial({ color: PAL.screenOff }));
  const glow = new THREE.Group();
  glow.position.set(seat.x, 0, seat.z);
  glow.rotation.y = seat.rot;
  screens.add(glow);

  if (seat.kind === "vr") {
    // Tracked play area: a mat whose border glows with the operator's status, and two base stations.
    kit.box("#3d5a80", [1.8, 0.02, 1.8], [0, 0.01, 0], f);
    for (const [w, d, x, z] of [[1.8, 0.06, 0, -0.9], [1.8, 0.06, 0, 0.9], [0.06, 1.8, -0.9, 0], [0.06, 1.8, 0.9, 0]])
      kit.box(status, [w, 0.025, d], [x, 0.015, z], glow);
    for (const [x, z] of [[-1.05, -1.05], [1.05, 1.05]]) {
      for (const [dx, dz] of [[-0.12, 0], [0.08, 0.1], [0.08, -0.1]]) kit.box(PAL.metalDark, [0.03, 1.9, 0.03], [x + dx, 0.95, z + dz], f);
      kit.box("#151515", [0.14, 0.14, 0.1], [x, 1.95, z], f);
      kit.box(kit.own(new THREE.MeshBasicMaterial({ color: "#5ff2ff" })), [0.06, 0.06, 0.01], [x, 1.95, z - Math.sign(z) * 0.055], f);
    }
    return status;
  }

  kit.box(PAL.deskTop, [1.5, 0.06, 0.8], [0, 0.76, -0.78], f);
  for (const x of [-0.66, 0.66]) {
    kit.box(PAL.deskLeg, [0.05, 0.74, 0.05], [x, 0.37, -0.45], f);
    kit.box(PAL.deskLeg, [0.05, 0.74, 0.05], [x, 0.37, -1.1], f);
    kit.box(PAL.deskLeg, [0.05, 0.05, 0.7], [x, 0.1, -0.78], f);
  }
  kit.box("#26292c", [0.56, 0.34, 0.04], [0.05, 1.07, -1.02], f); // monitor
  kit.box("#26292c", [0.05, 0.22, 0.05], [0.05, 0.88, -1.06], f);
  kit.plane(status, [0.5, 0.28], [0.05, 1.07, -0.995], 0, 0, glow);
  kit.box(PAL.paper, [0.44, 0.02, 0.15], [0.05, 0.8, -0.6], f); // keyboard
  // Desk lamp: the screen faces away from the camera, so the lamp shows the same status colour to us.
  kit.box(PAL.metalDark, [0.04, 0.34, 0.04], [-0.6, 0.96, -1.02], f);
  kit.box(status, [0.18, 0.1, 0.18], [-0.6, 1.16, -1.02], glow);
  // A little clutter, different on every desk.
  const clutter = index % 4;
  if (clutter === 0) {
    kit.box(PAL.pot, [0.14, 0.12, 0.14], [0.55, 0.85, -1.0], f);
    kit.box(PAL.plant, [0.2, 0.16, 0.2], [0.55, 0.99, -1.0], f);
  } else if (clutter === 1) {
    kit.box("#f2f2f2", [0.08, 0.1, 0.08], [0.55, 0.84, -0.55], f); // mug
  } else if (clutter === 2) {
    kit.box("#ffe066", [0.1, 0.01, 0.1], [0.45, 0.795, -0.6], f); // sticky notes
    kit.box("#ff8fab", [0.1, 0.01, 0.1], [0.58, 0.795, -0.7], f);
  } else {
    kit.box("#3a3f44", [0.36, 0.02, 0.26], [-0.25, 0.8, -0.6], f); // laptop
  }
  // Chair in one of the mismatched colours.
  const chair = CHAIRS[index % CHAIRS.length];
  kit.box(chair, [0.46, 0.08, 0.46], [0, 0.48, 0.02], f);
  kit.box(chair, [0.46, 0.46, 0.07], [0, 0.76, 0.26], f);
  kit.box(PAL.metalDark, [0.05, 0.4, 0.05], [0, 0.25, 0.02], f);
  kit.box(PAL.metalDark, [0.46, 0.04, 0.05], [0, 0.04, 0.02], f);
  kit.box(PAL.metalDark, [0.05, 0.04, 0.46], [0, 0.04, 0.02], f);
  kit.shadow(0.95, 0.75, [0, -0.5], f);
  return status;
}

function plant(kit: Kit, x: number, z: number, scale = 1) {
  kit.box(PAL.pot, [0.38 * scale, 0.36 * scale, 0.38 * scale], [x, 0.18 * scale, z]);
  kit.box(PAL.plantDark, [0.55 * scale, 0.4 * scale, 0.55 * scale], [x, 0.55 * scale, z]);
  kit.box(PAL.plant, [0.4 * scale, 0.35 * scale, 0.4 * scale], [x + 0.06, 0.82 * scale, z - 0.05]);
  kit.shadow(0.35 * scale, 0.35 * scale, [x, z]);
}

/** Tall fiddle-leaf plant: the startup-office staple. */
function tallPlant(kit: Kit, x: number, z: number) {
  kit.cyl("#f5f2ec", 0.24, 0.5, [x, 0, z]);
  kit.box(PAL.wood, [0.06, 1.2, 0.06], [x, 1, z]);
  for (const [dx, y, dz, s] of [[0, 1.75, 0, 0.5], [0.15, 1.4, 0.1, 0.38], [-0.14, 1.2, -0.08, 0.34], [0.05, 2.05, -0.05, 0.3]] as const)
    kit.box(y > 1.6 ? PAL.plant : PAL.plantDark, [s, s * 0.8, s], [x + dx, y, z + dz]);
  kit.shadow(0.4, 0.4, [x, z]);
}

/** Metal rack of cardboard boxes, back against a wall, facing -z in its frame. */
function rack(kit: Kit, x: number, z: number, rot: number, seed: number) {
  const f = frame(kit, x, z, rot);
  for (const sx of [-0.85, 0.85]) for (const sz of [-0.25, 0.25]) kit.box(PAL.metalDark, [0.05, 2, 0.05], [sx, 1, sz], f);
  [0.1, 0.75, 1.4, 1.95].forEach((y, level) => {
    kit.box(PAL.metal, [1.75, 0.04, 0.55], [0, y, 0], f);
    if (level === 3) return;
    for (let i = 0; i < 3; i++) {
      if ((seed + level * 3 + i) % 5 === 0) continue;
      const w = 0.36 + ((seed + i * 7 + level) % 3) * 0.08;
      kit.box((seed + i + level) % 2 ? PAL.box : PAL.boxDark, [w, 0.38, 0.42], [-0.55 + i * 0.55, y + 0.21, 0], f);
    }
  });
  kit.shadow(1, 0.4, [0, 0], f);
}

function robotCrate(kit: Kit, x: number, z: number) {
  kit.box(PAL.woodLight, [1, 0.8, 0.7], [x, 0.4, z]);
  kit.box(PAL.wood, [1.02, 0.08, 0.72], [x, 0.2, z]);
  kit.box(PAL.wood, [1.02, 0.08, 0.72], [x, 0.62, z]);
  kit.shadow(0.6, 0.45, [x, z]);
}

function stool(kit: Kit, x: number, z: number, color: string) {
  kit.cyl(color, 0.18, 0.06, [x, 0.66, z]);
  kit.box(PAL.metalDark, [0.04, 0.66, 0.04], [x, 0.33, z]);
  kit.cyl(PAL.metalDark, 0.15, 0.02, [x, 0, z]);
}

export function furnish(kit: Kit) {
  const basic = (map: THREE.Texture, transparent = false) => kit.own(new THREE.MeshBasicMaterial({ map, transparent }));
  const lambert = (map: THREE.Texture) => kit.own(new THREE.MeshLambertMaterial({ map }));
  /** Glowing neon lettering on a dark backing. */
  const neon = (text: string, color: string, w = 256) =>
    basic(
      kit.texture(w, 64, (g) => {
        g.fillStyle = "#1a1716";
        g.fillRect(0, 0, w, 64);
        g.shadowColor = color;
        g.shadowBlur = 12;
        g.fillStyle = color;
        g.font = "italic bold 36px sans-serif";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillText(text, w / 2, 34);
      }),
    );
  const sticky = lambert(
    kit.texture(256, 128, (g) => {
      g.fillStyle = "#f7f5ef";
      g.fillRect(0, 0, 256, 128);
      const colors = ["#ffe066", "#ff8fab", "#8ce99a", "#74c0fc", "#ffa94d"];
      for (let i = 0; i < 26; i++) {
        g.fillStyle = colors[(i * 7) % colors.length];
        g.fillRect(8 + (i % 9) * 27, 8 + Math.floor(i / 9) * 38 + ((i * 5) % 7), 22, 22);
      }
      g.fillStyle = "#333";
      for (const x of [86, 170]) g.fillRect(x, 4, 2, 120); // columns: todo / doing / done
    }),
  );

  // ---------- Inventory ----------
  rack(kit, 1.4, 0.45, 0, 1);
  rack(kit, 3.4, 0.45, 0, 4);
  rack(kit, 5.4, 0.45, 0, 7);
  rack(kit, 0.45, 2.6, Math.PI / 2, 2);
  robotCrate(kit, 7, 1.6);
  robotCrate(kit, 7, 2.5);
  kit.box(PAL.boxDark, [0.5, 0.4, 0.5], [6.6, 0.2, 3.4]);
  kit.box(PAL.box, [0.4, 0.3, 0.4], [6.6, 0.55, 3.4]);
  kit.shadow(0.4, 0.4, [6.6, 3.4]);

  // ---------- Welding defect detection ----------
  // Steel welding table with sample plates; the X2 stands in front of it scanning seams (see INSPECT).
  kit.box(PAL.metal, [4, 0.08, 1.2], [12, 0.9, 1.3]);
  for (const x of [10.2, 13.8]) for (const z of [0.85, 1.75]) kit.box(PAL.metalDark, [0.08, 0.86, 0.08], [x, 0.43, z]);
  kit.shadow(2.2, 0.8, [12, 1.3]);
  const hot = kit.own(new THREE.MeshBasicMaterial({ color: "#ff9a3c" }));
  [10.8, 12, 13.2].forEach((x, i) => {
    kit.box("#a3a9ae", [0.9, 0.04, 0.7], [x, 0.96, 1.3]);
    kit.box("#5a4636", [0.05, 0.03, 0.66], [x, 0.99, 1.3]); // weld seam
    kit.box(hot, [0.06, 0.035, 0.08], [x, 0.995, 1.05 + i * 0.18]); // a fresh (or faulty) spot
  });
  // Welding screen curtain.
  const curtain = kit.own(new THREE.MeshBasicMaterial({ color: "#ff8a2a", transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
  kit.plane(curtain, [2.8, 1.7], [15.2, 1.0, 1.7], Math.PI / 2);
  kit.box(PAL.metalDark, [0.05, 1.9, 0.05], [15.2, 0.95, 0.3]);
  kit.box(PAL.metalDark, [0.05, 1.9, 0.05], [15.2, 0.95, 3.1]);
  kit.box(PAL.metalDark, [0.05, 0.05, 2.85], [15.2, 1.88, 1.7]);
  // Gas cylinders and a welder.
  kit.cyl("#2f7a4a", 0.14, 1.3, [17.4, 0, 0.6]);
  kit.box(PAL.metalDark, [0.5, 0.75, 0.4], [17.3, 0.38, 2.6]); // teleop PC under the VR area
  kit.box(kit.own(new THREE.MeshBasicMaterial({ color: "#5ff2ff" })), [0.02, 0.05, 0.25], [17.04, 0.6, 2.6]);
  kit.cyl("#8a8f94", 0.14, 1.3, [17.4, 0, 1.0]);
  kit.box("#2a6ab0", [0.5, 0.45, 0.4], [16.4, 0.23, 0.6]);
  // Screen on a stand showing the detector's output: a weld with defects boxed in red.
  const defects = basic(
    kit.texture(192, 108, (g) => {
      g.fillStyle = "#3a3f44";
      g.fillRect(0, 0, 192, 108);
      g.fillStyle = "#8a8f94";
      g.fillRect(0, 44, 192, 20);
      g.fillStyle = "#5a4636";
      for (let x = 0; x < 192; x += 8) g.fillRect(x, 48 + ((x / 8) % 2) * 2, 7, 12);
      g.strokeStyle = "#ff3b3b";
      g.lineWidth = 3;
      g.strokeRect(40, 38, 26, 32);
      g.strokeRect(128, 40, 22, 28);
      g.fillStyle = "#ff3b3b";
      g.font = "bold 11px sans-serif";
      g.fillText("porosity 0.94", 30, 32);
      g.fillText("crack 0.88", 118, 34);
      g.fillStyle = "#7fe0a0";
      g.fillText("X2 · weld-inspect v0.3", 8, 100);
    }),
  );
  kit.box(PAL.metalDark, [0.06, 1.2, 0.06], [8.7, 0.6, 3.6]);
  kit.box(PAL.metalDark, [0.6, 0.04, 0.6], [8.7, 0.02, 3.6]);
  kit.box("#26292c", [0.08, 0.8, 1.35], [8.7, 1.5, 3.6]);
  kit.plane(defects, [1.25, 0.7], [8.75, 1.5, 3.6], Math.PI / 2);
  kit.plane(sticky, [2.2, 1.1], [12, 1.85, 0.12]); // experiment board above the table
  plant(kit, 9.2, 0.6);

  // ---------- Surveillance ----------
  const cams = basic(
    kit.texture(256, 128, (g) => {
      g.fillStyle = "#0e1a1f";
      g.fillRect(0, 0, 256, 128);
      for (let i = 0; i < 8; i++) {
        const x = (i % 4) * 64;
        const y = Math.floor(i / 4) * 64;
        g.fillStyle = ["#24434d", "#2e4f3d", "#3b3d55", "#2c4a5c"][i % 4];
        g.fillRect(x + 3, y + 3, 58, 58);
        g.fillStyle = "rgba(255,255,255,0.35)";
        g.fillRect(x + 8 + ((i * 9) % 30), y + 20 + ((i * 7) % 24), 12, 18); // someone on camera
        g.fillStyle = "#e04b4b";
        g.fillRect(x + 52, y + 7, 5, 5); // REC
      }
    }),
  );
  kit.box("#2a2f33", [7.4, 1.5, 0.1], [23, 1.45, 0.16]);
  kit.plane(cams, [7.2, 1.35], [23, 1.45, 0.22]);
  kit.box(PAL.couch, [0.8, 0.4, 0.8], [27, 0.2, 6.9]); // beanbag for long shifts
  plant(kit, 27.3, 4.5);

  // ---------- Navigation test floor ----------
  const tapeTex = kit.texture(128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    g.strokeStyle = PAL.tape;
    g.lineWidth = 3;
    for (let i = 0; i <= 128; i += 32) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, 128);
      g.moveTo(0, i);
      g.lineTo(128, i);
      g.stroke();
    }
  });
  tapeTex.wrapS = tapeTex.wrapT = THREE.RepeatWrapping;
  tapeTex.repeat.set(1.5, 1.4);
  const tape = kit.own(new THREE.MeshBasicMaterial({ map: tapeTex, transparent: true, depthWrite: false }));
  kit.plane(tape, [6, 5.6], [32.25, 0.015, 4.05], 0, -Math.PI / 2);
  for (const [x, z] of [[30.5, 2.6], [33.8, 2.8], [32, 5.4], [30.6, 5.6], [34, 5.3]]) {
    kit.box(PAL.cone, [0.22, 0.32, 0.22], [x, 0.16, z]);
    kit.box("#fff", [0.23, 0.05, 0.23], [x, 0.2, z]);
    kit.shadow(0.18, 0.18, [x, z]);
  }
  kit.box(PAL.metalDark, [0.8, 0.4, 0.6], [35.3, 0.2, 0.7]); // charging station
  kit.box("#7fe0a0", [0.1, 0.1, 0.02], [35.3, 0.3, 1.01]);

  // ---------- Robot receptionist project ----------
  // Mock hotel front desk on the far wall; the X2 under test stands behind it (see GREETER).
  const lobby = basic(
    kit.texture(256, 64, (g) => {
      g.fillStyle = "#1d3132";
      g.fillRect(0, 0, 256, 64);
      g.fillStyle = "#e8eee8";
      g.font = "bold 34px sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText("HOTEL LOBBY", 128, 26);
      g.font = "16px sans-serif";
      g.fillStyle = "#e7c33a";
      g.fillText("ROBOT RECEPTIONIST TEST SET", 128, 50);
    }),
  );
  kit.plane(lobby, [3.2, 0.8], [0.12, 1.75, 12.5], Math.PI / 2);
  kit.box(PAL.wood, [0.5, 1.05, 3.4], [1.65, 0.525, 12.5]);
  kit.box(PAL.deskTop, [0.7, 0.06, 3.6], [1.6, 1.08, 12.5]);
  kit.shadow(0.5, 1.9, [1.65, 12.5]);
  kit.box("#d9b25a", [0.12, 0.06, 0.12], [1.75, 1.14, 13.6]); // service bell
  // Passport scanner kiosk at the end of the desk.
  kit.box(PAL.metalDark, [0.4, 1.1, 0.4], [1.6, 0.55, 14.6]);
  kit.box("#2a2f33", [0.06, 0.4, 0.34], [1.82, 1.25, 14.6]);
  kit.plane(kit.own(new THREE.MeshBasicMaterial({ color: "#7fd0a0" })), [0.3, 0.34], [1.86, 1.25, 14.6], Math.PI / 2);
  // Test guest's spot: floor marker, suitcase and luggage cart.
  kit.plane(kit.own(new THREE.MeshBasicMaterial({ color: PAL.tape, transparent: true, opacity: 0.85, depthWrite: false })), [0.8, 0.8], [3, 0.016, 12.5], 0, -Math.PI / 2);
  kit.box("#8e2b2b", [0.45, 0.6, 0.25], [3.2, 0.32, 13.4]);
  kit.box(PAL.metalDark, [0.05, 0.25, 0.05], [3.2, 0.74, 13.4]);
  kit.box("#c9a23a", [0.9, 0.06, 0.6], [3.3, 0.18, 10.4]);
  for (const z of [10.15, 10.65]) kit.box("#c9a23a", [0.05, 1.3, 0.05], [3.7, 0.83, z]);
  kit.box("#c9a23a", [0.05, 0.05, 0.6], [3.7, 1.47, 10.4]);
  kit.box(PAL.couchDark, [0.6, 0.4, 0.4], [3.3, 0.41, 10.4]);
  kit.shadow(0.55, 0.4, [3.3, 10.4]);
  // Camera on a tripod recording the test.
  kit.box("#1a1a1e", [0.25, 0.18, 0.15], [4.6, 1.45, 12]);
  for (const [dx, dz] of [[-0.18, 0], [0.12, 0.15], [0.12, -0.15]]) kit.box(PAL.metalDark, [0.03, 1.4, 0.03], [4.6 + dx, 0.7, 12 + dz]);
  kit.box("#d24a3a", [0.04, 0.04, 0.02], [4.5, 1.5, 11.92]);
  tallPlant(kit, 0.6, 8.6);
  plant(kit, 0.6, 16.4);

  // ---------- Hall: communal table, kitchen island, ping-pong ----------
  kit.box(PAL.woodLight, [6.4, 0.1, 1.7], [18.5, 0.78, 13.2]);
  for (const x of [15.6, 21.4]) {
    kit.box(PAL.metalDark, [0.06, 0.74, 1.4], [x, 0.37, 13.2]);
  }
  kit.shadow(3.6, 1.2, [18.5, 13.2]);
  for (const z of [12, 14.4]) {
    kit.box(PAL.wood, [5.8, 0.08, 0.36], [18.5, 0.46, z]); // benches
    for (const x of [16, 21]) kit.box(PAL.metalDark, [0.05, 0.44, 0.3], [x, 0.22, z]);
  }
  // Laptops and pizza on the table.
  kit.box("#3a3f44", [0.36, 0.02, 0.26], [17, 0.84, 12.8]);
  kit.box("#3a3f44", [0.36, 0.02, 0.26], [20.2, 0.84, 13.6]);
  kit.box("#e8d2a6", [0.5, 0.05, 0.5], [18.6, 0.855, 13.2]);
  kit.box("#d24a3a", [0.36, 0.01, 0.36], [18.6, 0.885, 13.2]);
  // Sticky-note wall where the lab and surveillance doors meet the hall.
  kit.plane(sticky, [4, 1.2], [18.5, 0.95, 8.13]);
  // Kitchen island with stools, a fridge and a coffee machine.
  kit.box("#f5f2ec", [2.6, 0.92, 0.9], [12.6, 0.46, 16.8]);
  kit.box(PAL.woodLight, [2.8, 0.06, 1.05], [12.6, 0.95, 16.8]);
  kit.box("#2a2a2a", [0.35, 0.4, 0.3], [11.8, 1.18, 16.8]);
  kit.box(PAL.paper, [0.1, 0.12, 0.1], [12.4, 1.04, 16.6]);
  kit.box("#f2b134", [0.3, 0.3, 0.3], [13.4, 1.13, 16.9]); // fruit bowl
  for (const x of [11.8, 12.6, 13.4]) stool(kit, x, 16.05, CHAIRS[(x * 10) % 5 | 0]);
  kit.shadow(1.6, 0.6, [12.6, 16.8]);
  kit.box("#d8dde0", [0.8, 1.9, 0.75], [9.55, 0.95, 15.6]); // fridge
  kit.box(PAL.metalDark, [0.03, 0.5, 0.05], [9.97, 1.3, 15.35]);
  // Ping-pong table.
  kit.box("#2f6e5a", [2.6, 0.06, 1.5], [24.3, 0.76, 16.4]);
  kit.box("#ffffff", [2.6, 0.065, 0.03], [24.3, 0.765, 16.4]);
  kit.box("#ffffff", [0.03, 0.16, 1.55], [24.3, 0.87, 16.4]); // net
  for (const x of [23.2, 25.4]) kit.box(PAL.metalDark, [0.06, 0.74, 1.2], [x, 0.37, 16.4]);
  kit.box("#d24a3a", [0.16, 0.02, 0.14], [23.4, 0.8, 16]);
  kit.shadow(1.5, 0.9, [24.3, 16.4]);
  // Neon on the wall by the entertainment door.
  kit.plane(neon("SHIP IT", "#ff5ec4"), [2, 0.5], [27.88, 1.1, 11.5], -Math.PI / 2);
  tallPlant(kit, 9.7, 8.7);
  tallPlant(kit, 27.3, 18.3);
  plant(kit, 27.3, 9.6, 1.2);
  plant(kit, 21.8, 18.4);

  // ---------- Entertainment stage ----------
  kit.box(PAL.stage, [6.4, 0.3, 3], [32.4, 0.15, 12]);
  kit.box("#d84aa8", [6.4, 0.04, 0.06], [32.4, 0.31, 13.5]);
  for (const x of [29.5, 35.3]) {
    kit.box("#1a1a1e", [0.6, 1.3, 0.6], [x, 0.95, 11.2]);
    kit.box("#3a3a44", [0.34, 0.34, 0.02], [x, 1.2, 11.51]);
  }
  kit.box(PAL.metalDark, [6.6, 0.1, 0.1], [32.4, 2.4, 10.6]); // light truss
  for (const [x, c] of [[30.4, "#ff6ad5"], [32.4, "#6ad5ff"], [34.4, "#ffd36a"]] as const) {
    kit.box(PAL.metalDark, [0.2, 0.25, 0.2], [x, 2.25, 10.65]);
    kit.box(kit.own(new THREE.MeshBasicMaterial({ color: c })), [0.14, 0.04, 0.14], [x, 2.12, 10.65]);
  }
  kit.box("#e8c8f0", [5, 0.02, 1.8], [32.4, 0.01, 15]); // dance floor rug
  plant(kit, 35.4, 18.4);

  // ---------- Lounge ----------
  kit.box(PAL.rug, [4.2, 0.02, 5.2], [3, 0.01, 22.5]);
  kit.box(PAL.teal, [3.2, 0.021, 4.2], [3, 0.012, 22.5]);
  // Couch along x = 4.6, facing the TV on the far wall (-x).
  kit.box(PAL.couch, [0.9, 0.42, 3.4], [4.35, 0.21, 22.5]);
  kit.box(PAL.couchDark, [0.25, 0.75, 3.4], [4.85, 0.5, 22.5]);
  for (const z of [20.7, 24.3]) kit.box(PAL.couchDark, [0.9, 0.55, 0.22], [4.35, 0.32, z]);
  for (const [z, c] of [[21.6, "#f2b134"], [23.4, "#4a6fa5"]] as const) kit.box(c, [0.18, 0.32, 0.32], [4.62, 0.56, z]); // cushions
  kit.shadow(0.7, 1.9, [4.4, 22.5]);
  // Couch along z = 19, facing +z.
  kit.box(PAL.teal, [2.6, 0.42, 0.9], [2.35, 0.21, 19.05]);
  kit.box("#2f8a84", [2.6, 0.75, 0.25], [2.35, 0.5, 18.55]);
  kit.shadow(1.5, 0.6, [2.35, 19.1]);
  // Beanbags.
  for (const [x, c] of [[1.7, "#e2574c"], [3.2, "#8e6bb8"]] as const) {
    kit.box(c, [0.75, 0.38, 0.75], [x, 0.19, 25.8]);
    kit.shadow(0.5, 0.5, [x, 25.8]);
  }
  kit.box(PAL.woodLight, [1.4, 0.35, 0.8], [2.7, 0.18, 22.5]); // coffee table
  kit.box(PAL.paper, [0.3, 0.02, 0.22], [2.5, 0.37, 22.4]);
  kit.box("#2a2a2a", [0.5, 0.04, 0.3], [2.95, 0.37, 22.6]); // game controller pad
  // TV on a low stand against the far wall, with a neon logo above.
  const tv = basic(
    kit.texture(128, 72, (g) => {
      const grad = g.createLinearGradient(0, 0, 0, 72);
      grad.addColorStop(0, "#6fb3e0");
      grad.addColorStop(1, "#3f8a4a");
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 72);
      g.fillStyle = "#f2e6c8";
      g.fillRect(40, 30, 14, 26);
      g.fillStyle = "#fff";
      g.beginPath();
      g.arc(90, 46, 6, 0, Math.PI * 2);
      g.fill();
    }),
  );
  kit.box(PAL.wood, [0.5, 0.5, 2.2], [0.4, 0.25, 22.5]);
  kit.box("#151515", [0.08, 1.05, 1.8], [0.25, 1.15, 22.5]);
  kit.plane(tv, [1.7, 0.95], [0.3, 1.15, 22.5], Math.PI / 2);
  kit.plane(neon("QAZBOT", "#5ff2ff"), [1.8, 0.45], [0.13, 2.0, 22.5], Math.PI / 2);
  // Arcade cabinet and a coffee corner.
  kit.box("#4a2a7a", [0.7, 1.7, 0.6], [7.9, 0.85, 27.3]);
  kit.box("#151515", [0.5, 0.4, 0.02], [7.9, 1.25, 26.99]);
  kit.box(kit.own(new THREE.MeshBasicMaterial({ color: "#ff5ec4" })), [0.44, 0.34, 0.01], [7.9, 1.25, 26.98]);
  kit.box(PAL.woodLight, [2, 0.9, 0.6], [7.7, 0.45, 17.45]);
  kit.box("#2a2a2a", [0.4, 0.5, 0.35], [7.2, 1.15, 17.45]);
  kit.box("#d24a3a", [0.12, 0.12, 0.02], [7.2, 1.2, 17.64]);
  kit.box(PAL.paper, [0.12, 0.14, 0.12], [8, 0.97, 17.5]);
  tallPlant(kit, 0.6, 27.3);
  plant(kit, 0.6, 17.7);

  // ---------- Back office ----------
  // Sticky-note sprint board on the wall facing the desks, and a rolling whiteboard.
  kit.plane(sticky, [3.2, 1.1], [22, 0.85, 19.13]);
  kit.box("#f7f5ef", [0.06, 1.1, 1.6], [23.3, 1.2, 22.6]);
  kit.box(PAL.metalDark, [0.4, 0.06, 0.06], [23.3, 0.1, 21.9]);
  kit.box(PAL.metalDark, [0.4, 0.06, 0.06], [23.3, 0.1, 23.3]);
  for (const z of [21.9, 23.3]) kit.box(PAL.metalDark, [0.04, 0.6, 0.04], [23.3, 0.4, z]);
  // Plant shelf instead of filing cabinets.
  kit.box(PAL.woodLight, [0.4, 1.6, 2.2], [9.4, 0.8, 26.2]);
  for (let i = 0; i < 3; i++) plant(kit, 9.4, 25.4 + i * 0.8, 0.55);
  tallPlant(kit, 23.4, 27.4);
  tallPlant(kit, 23.4, 19.6);
  plant(kit, 9.6, 19.6);
}
