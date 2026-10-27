import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PAL } from "./palette";

// Shared building blocks: cached materials, one unit box geometry every box reuses, and a static
// layer that is merged into one mesh per material at the end so hundreds of furniture boxes cost a
// handful of draw calls.

export { CHAIRS, PAL } from "./palette";

export class Kit {
  readonly unit = new THREE.BoxGeometry(1, 1, 1);
  readonly staticRoot = new THREE.Group();
  private mats = new Map<string, THREE.MeshLambertMaterial>();
  private owned: { dispose: () => void }[] = [this.unit];
  readonly shadowMat = new THREE.MeshBasicMaterial({ color: PAL.shadow, transparent: true, opacity: 0.2, depthWrite: false });
  private disc = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);

  constructor() {
    this.owned.push(this.shadowMat, this.disc);
  }

  mat(color: string) {
    let m = this.mats.get(color);
    if (!m) this.mats.set(color, (m = new THREE.MeshLambertMaterial({ color })));
    return m;
  }

  own<T extends { dispose: () => void }>(x: T) {
    this.owned.push(x);
    return x;
  }

  /** A box from its size and centre, added to `parent` (the static layer unless given). */
  box(color: string | THREE.Material, [w, h, d]: number[], [x, y, z]: number[], parent: THREE.Object3D = this.staticRoot) {
    const mesh = new THREE.Mesh(this.unit, typeof color === "string" ? this.mat(color) : color);
    mesh.scale.set(w, h, d);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  /** An upright cylinder from its radius, height and base centre. */
  cyl(color: string | THREE.Material, r: number, h: number, [x, y, z]: number[], parent: THREE.Object3D = this.staticRoot, segments = 12) {
    const mesh = new THREE.Mesh(this.own(new THREE.CylinderGeometry(r, r, h, segments)), typeof color === "string" ? this.mat(color) : color);
    mesh.position.set(x, y + h / 2, z);
    parent.add(mesh);
    return mesh;
  }

  /** Soft contact shadow on the floor: cheaper than real shadows and closer to the reference's look. */
  shadow(rx: number, rz: number, [x, z]: number[], parent: THREE.Object3D = this.staticRoot) {
    const mesh = new THREE.Mesh(this.disc, this.shadowMat);
    mesh.scale.set(rx, 1, rz);
    mesh.position.set(x, 0.012, z);
    mesh.renderOrder = 1;
    parent.add(mesh);
    return mesh;
  }

  /** Canvas texture drawn once; `smooth` keeps linear filtering for text-like detail. */
  texture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    draw(canvas.getContext("2d")!);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    return this.own(tex);
  }

  /** A flat picture on a wall or the floor. */
  plane(material: THREE.Material, [w, h]: number[], [x, y, z]: number[], rotY = 0, rotX = 0, parent: THREE.Object3D = this.staticRoot) {
    const mesh = new THREE.Mesh(this.own(new THREE.PlaneGeometry(w, h)), material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rotX, rotY, 0, "YXZ");
    parent.add(mesh);
    return mesh;
  }

  /** Replace the static layer's meshes with one merged mesh per material. */
  mergeStatic() {
    const root = this.staticRoot;
    root.updateMatrixWorld(true);
    const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
      let g = (o.geometry as THREE.BufferGeometry).clone().applyMatrix4(o.matrixWorld);
      if (g.index) g = g.toNonIndexed();
      for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
      byMat.set(o.material, [...(byMat.get(o.material) ?? []), g]);
    });
    root.clear();
    for (const [material, geos] of byMat) {
      const merged = mergeGeometries(geos);
      geos.forEach((g) => g.dispose());
      if (!merged) continue;
      const mesh = new THREE.Mesh(this.own(merged), material);
      if (material === this.shadowMat) mesh.renderOrder = 1;
      root.add(mesh);
    }
  }

  dispose() {
    this.owned.forEach((x) => x.dispose());
    this.mats.forEach((m) => m.dispose());
  }
}
