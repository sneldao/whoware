import * as THREE from "three";

/**
 * Procedural prop shapes.
 *
 * Phase 2: each prop kind maps to a primitive composition (boxes,
 * cylinders, spheres) so we can render real 3D objects in the
 * scene without any GLB assets. Phase 3 will replace hero props
 * with Tripo-generated GLBs and fall back to these shapes for
 * anything Tripo can't or shouldn't model.
 *
 * Per CONSOLIDATION: this is a pure-function module. The SceneCanvas
 * owns the Three.js scene graph; we just hand back a Group.
 */

export type PropKind = string;

export interface PropShapeInput {
  kind: PropKind;
  scale?: number;
}

export interface PropShape {
  group: THREE.Group;
  /** Bounding-box half-extents used for click hit-testing. */
  halfExtents: THREE.Vector3;
}

const ROOM = new Set([
  "floor", "wall", "ceiling", "doorway", "window", "fireplace",
]);
const FURNITURE = new Set([
  "desk", "chair", "bed", "table", "shelf", "cabinet", "sofa",
]);
const ERA = new Set([
  "candle", "lantern", "oil_lamp", "gramophone", "typewriter",
  "telegraph", "vintage_radio", "rotary_phone", "ledger",
  "parchment", "scroll", "globe", "telescope", "sextant",
  "hourglass", "pocket_watch", "compass",
]);
const DOC = new Set([
  "book", "newspaper", "telegram", "map", "photograph",
  "letter", "journal",
]);
const OBJECT = new Set([
  "bottle", "vase", "painting", "mirror", "curtain", "rug",
  "statue", "bust", "weapon", "chalice", "weapon_rack", "bookshelf",
]);

const WOOD = 0x6b3a1d;
const DARK_WOOD = 0x3a1f0e;
const METAL = 0x6b6b6b;
const BRASS = 0xc9a227;
const PAPER = 0xe8d6a8;
const CLOTH = 0x6a5a3a;
const STONE = 0x8a8a8a;

const DEFAULT_MATERIAL = (color: number) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 });

function makeBox(w: number, h: number, d: number, color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    DEFAULT_MATERIAL(color),
  );
  return mesh;
}

function makeCylinder(rTop: number, rBottom: number, h: number, color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(rTop, rBottom, h, 16),
    DEFAULT_MATERIAL(color),
  );
  return mesh;
}

function makeSphere(r: number, color: number): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(r, 12, 8),
    DEFAULT_MATERIAL(color),
  );
  return mesh;
}

/**
 * Build a primitive composition for a given prop kind. The returned
 * Group is centered at its origin; the caller is responsible for
 * positioning, rotating, and scaling it.
 */
export function buildPropShape(input: PropShapeInput): PropShape {
  const s = input.scale ?? 1;
  const group = new THREE.Group();
  group.name = `Prop:${input.kind}`;

  const add = (mesh: THREE.Mesh, offset: [number, number, number] = [0, 0, 0]) => {
    mesh.position.set(offset[0], offset[1], offset[2]);
    group.add(mesh);
  };

  let halfExtents = new THREE.Vector3(0.5, 0.5, 0.5);

  if (input.kind === "floor") {
    add(makeBox(40 * s, 0.1, 40 * s, STONE), [0, -1.5 * s, 0]);
    halfExtents = new THREE.Vector3(20, 0.05, 20);
  } else if (input.kind === "wall") {
    add(makeBox(20 * s, 8 * s, 0.2 * s, DARK_WOOD), [0, 2 * s, -5 * s]);
    halfExtents = new THREE.Vector3(10, 4, 0.1);
  } else if (input.kind === "ceiling") {
    add(makeBox(40 * s, 0.1, 40 * s, DARK_WOOD), [0, 5 * s, 0]);
    halfExtents = new THREE.Vector3(20, 0.05, 20);
  } else if (input.kind === "doorway") {
    add(makeBox(2 * s, 4 * s, 0.2 * s, DARK_WOOD), [0, 0, -5 * s]);
    halfExtents = new THREE.Vector3(1, 2, 0.1);
  } else if (input.kind === "window") {
    add(makeBox(1.6 * s, 2 * s, 0.2 * s, METAL), [0, 1.5 * s, -5 * s]);
    halfExtents = new THREE.Vector3(0.8, 1, 0.1);
  } else if (input.kind === "fireplace") {
    add(makeBox(3 * s, 2.5 * s, 1.2 * s, STONE), [0, -0.25 * s, -5 * s]);
    halfExtents = new THREE.Vector3(1.5, 1.25, 0.6);
  } else if (input.kind === "desk") {
    add(makeBox(2 * s, 0.1 * s, 1 * s, WOOD), [0, 0, 0]);
    add(makeBox(0.1 * s, 0.9 * s, 1 * s, WOOD), [-0.9 * s, -0.5 * s, 0]);
    add(makeBox(0.1 * s, 0.9 * s, 1 * s, WOOD), [0.9 * s, -0.5 * s, 0]);
    add(makeBox(0.1 * s, 0.9 * s, 1 * s, WOOD), [0, -0.5 * s, -0.45 * s]);
    add(makeBox(0.1 * s, 0.9 * s, 1 * s, WOOD), [0, -0.5 * s, 0.45 * s]);
    halfExtents = new THREE.Vector3(1, 0.5, 0.5);
  } else if (input.kind === "chair") {
    add(makeBox(0.7 * s, 0.1 * s, 0.7 * s, WOOD), [0, 0, 0]);
    add(makeBox(0.7 * s, 1 * s, 0.1 * s, WOOD), [0, 0.5 * s, -0.3 * s]);
    add(makeBox(0.08 * s, 0.5 * s, 0.08 * s, WOOD), [-0.3 * s, -0.3 * s, -0.3 * s]);
    add(makeBox(0.08 * s, 0.5 * s, 0.08 * s, WOOD), [0.3 * s, -0.3 * s, -0.3 * s]);
    add(makeBox(0.08 * s, 0.5 * s, 0.08 * s, WOOD), [-0.3 * s, -0.3 * s, 0.3 * s]);
    add(makeBox(0.08 * s, 0.5 * s, 0.08 * s, WOOD), [0.3 * s, -0.3 * s, 0.3 * s]);
    halfExtents = new THREE.Vector3(0.35, 0.55, 0.35);
  } else if (input.kind === "bed") {
    add(makeBox(2.2 * s, 0.4 * s, 1.4 * s, WOOD), [0, 0, 0]);
    add(makeBox(2.2 * s, 0.7 * s, 0.1 * s, WOOD), [0, 0.5 * s, -0.7 * s]);
    add(makeBox(0.15 * s, 0.2 * s, 1.4 * s, WOOD), [-1.1 * s, 0.2 * s, 0]);
    add(makeBox(0.15 * s, 0.2 * s, 1.4 * s, WOOD), [1.1 * s, 0.2 * s, 0]);
    halfExtents = new THREE.Vector3(1.1, 0.4, 0.7);
  } else if (input.kind === "table") {
    add(makeBox(2 * s, 0.1 * s, 1 * s, WOOD), [0, 0, 0]);
    add(makeBox(0.1 * s, 0.9 * s, 0.1 * s, WOOD), [-0.9 * s, -0.5 * s, -0.4 * s]);
    add(makeBox(0.1 * s, 0.9 * s, 0.1 * s, WOOD), [0.9 * s, -0.5 * s, -0.4 * s]);
    add(makeBox(0.1 * s, 0.9 * s, 0.1 * s, WOOD), [-0.9 * s, -0.5 * s, 0.4 * s]);
    add(makeBox(0.1 * s, 0.9 * s, 0.1 * s, WOOD), [0.9 * s, -0.5 * s, 0.4 * s]);
    halfExtents = new THREE.Vector3(1, 0.5, 0.5);
  } else if (input.kind === "shelf") {
    add(makeBox(1.5 * s, 0.1 * s, 0.4 * s, WOOD), [0, 0.5 * s, 0]);
    add(makeBox(1.5 * s, 0.1 * s, 0.4 * s, WOOD), [0, 0 * s, 0]);
    add(makeBox(0.05 * s, 0.6 * s, 0.4 * s, WOOD), [-0.7 * s, 0.25 * s, 0]);
    add(makeBox(0.05 * s, 0.6 * s, 0.4 * s, WOOD), [0.7 * s, 0.25 * s, 0]);
    halfExtents = new THREE.Vector3(0.75, 0.5, 0.2);
  } else if (input.kind === "cabinet") {
    add(makeBox(1.2 * s, 1.6 * s, 0.5 * s, WOOD), [0, 0, 0]);
    halfExtents = new THREE.Vector3(0.6, 0.8, 0.25);
  } else if (input.kind === "sofa") {
    add(makeBox(2.4 * s, 0.5 * s, 1 * s, CLOTH), [0, 0, 0]);
    add(makeBox(2.4 * s, 0.6 * s, 0.1 * s, CLOTH), [0, 0.5 * s, -0.45 * s]);
    add(makeBox(0.15 * s, 0.4 * s, 1 * s, CLOTH), [-1.2 * s, 0.3 * s, 0]);
    add(makeBox(0.15 * s, 0.4 * s, 1 * s, CLOTH), [1.2 * s, 0.3 * s, 0]);
    halfExtents = new THREE.Vector3(1.2, 0.4, 0.5);
  } else if (input.kind === "candle") {
    add(makeCylinder(0.06 * s, 0.08 * s, 0.3 * s, PAPER), [0, 0, 0]);
    add(makeSphere(0.04 * s, 0xffd66b), [0, 0.18 * s, 0]);
    halfExtents = new THREE.Vector3(0.08, 0.2, 0.08);
  } else if (input.kind === "lantern") {
    add(makeBox(0.3 * s, 0.4 * s, 0.3 * s, METAL), [0, 0, 0]);
    add(makeCylinder(0.1 * s, 0.1 * s, 0.15 * s, BRASS), [0, 0.25 * s, 0]);
    halfExtents = new THREE.Vector3(0.15, 0.25, 0.15);
  } else if (input.kind === "oil_lamp") {
    add(makeSphere(0.18 * s, BRASS), [0, 0, 0]);
    add(makeCylinder(0.05 * s, 0.05 * s, 0.15 * s, BRASS), [0, 0.2 * s, 0]);
    halfExtents = new THREE.Vector3(0.18, 0.2, 0.18);
  } else if (input.kind === "gramophone") {
    add(makeCylinder(0.3 * s, 0.3 * s, 0.1 * s, DARK_WOOD), [0, 0, 0]);
    add(makeCylinder(0.05 * s, 0.05 * s, 0.2 * s, BRASS), [0.2 * s, 0.15 * s, 0]);
    add(makeCylinder(0.25 * s, 0.25 * s, 0.02 * s, 0x111111), [0, 0.06 * s, 0]);
    halfExtents = new THREE.Vector3(0.3, 0.2, 0.3);
  } else if (input.kind === "typewriter") {
    add(makeBox(0.6 * s, 0.2 * s, 0.5 * s, METAL), [0, 0, 0]);
    add(makeCylinder(0.25 * s, 0.25 * s, 0.25 * s, 0x111111), [0, 0.2 * s, 0.05 * s]);
    halfExtents = new THREE.Vector3(0.3, 0.2, 0.25);
  } else if (input.kind === "telegraph") {
    add(makeBox(0.4 * s, 0.3 * s, 0.3 * s, DARK_WOOD), [0, 0, 0]);
    add(makeCylinder(0.05 * s, 0.05 * s, 0.2 * s, BRASS), [0, 0.2 * s, 0]);
    halfExtents = new THREE.Vector3(0.2, 0.2, 0.15);
  } else if (input.kind === "vintage_radio") {
    add(makeBox(0.6 * s, 0.4 * s, 0.3 * s, WOOD), [0, 0, 0]);
    add(makeCylinder(0.05 * s, 0.05 * s, 0.1 * s, BRASS), [-0.2 * s, 0.2 * s, 0.16 * s]);
    add(makeCylinder(0.05 * s, 0.05 * s, 0.1 * s, BRASS), [0, 0.2 * s, 0.16 * s]);
    add(makeCylinder(0.05 * s, 0.05 * s, 0.1 * s, BRASS), [0.2 * s, 0.2 * s, 0.16 * s]);
    halfExtents = new THREE.Vector3(0.3, 0.2, 0.15);
  } else if (input.kind === "rotary_phone") {
    add(makeBox(0.3 * s, 0.15 * s, 0.4 * s, 0x222222), [0, 0, 0]);
    add(makeCylinder(0.1 * s, 0.1 * s, 0.04 * s, 0x111111), [0, 0.1 * s, 0.1 * s]);
    halfExtents = new THREE.Vector3(0.15, 0.1, 0.2);
  } else if (input.kind === "ledger") {
    add(makeBox(0.4 * s, 0.05 * s, 0.6 * s, DARK_WOOD), [0, 0, 0]);
    halfExtents = new THREE.Vector3(0.2, 0.03, 0.3);
  } else if (input.kind === "parchment") {
    add(makeBox(0.4 * s, 0.01 * s, 0.6 * s, PAPER), [0, 0, 0]);
    halfExtents = new THREE.Vector3(0.2, 0.005, 0.3);
  } else if (input.kind === "scroll") {
    add(makeCylinder(0.05 * s, 0.05 * s, 0.5 * s, PAPER), [0, 0, 0]);
    halfExtents = new THREE.Vector3(0.05, 0.05, 0.25);
  } else if (input.kind === "globe") {
    add(makeSphere(0.3 * s, 0x3366cc), [0, 0.3 * s, 0]);
    add(makeCylinder(0.05 * s, 0.05 * s, 0.3 * s, WOOD), [0, 0, 0]);
    halfExtents = new THREE.Vector3(0.3, 0.45, 0.3);
  } else if (input.kind === "telescope") {
    add(makeCylinder(0.1 * s, 0.05 * s, 1 * s, BRASS), [0, 0, 0]);
    add(makeCylinder(0.05 * s, 0.05 * s, 0.3 * s, WOOD), [0, -0.5 * s, 0.3 * s]);
    halfExtents = new THREE.Vector3(0.1, 0.5, 0.5);
  } else if (input.kind === "sextant") {
    add(makeCylinder(0.3 * s, 0.3 * s, 0.05 * s, BRASS), [0, 0, 0]);
    halfExtents = new THREE.Vector3(0.3, 0.3, 0.05);
  } else if (input.kind === "hourglass") {
    add(makeCylinder(0.15 * s, 0.15 * s, 0.4 * s, WOOD), [0, 0, 0]);
    add(makeCylinder(0.15 * s, 0.15 * s, 0.4 * s, WOOD), [0, 0, 0]);
    halfExtents = new THREE.Vector3(0.15, 0.2, 0.15);
  } else if (input.kind === "pocket_watch") {
    add(makeCylinder(0.1 * s, 0.1 * s, 0.05 * s, BRASS), [0, 0, 0]);
    halfExtents = new THREE.Vector3(0.1, 0.05, 0.1);
  } else if (input.kind === "compass") {
    add(makeCylinder(0.1 * s, 0.1 * s, 0.05 * s, BRASS), [0, 0, 0]);
    halfExtents = new THREE.Vector3(0.1, 0.05, 0.1);
  } else if (input.kind === "book") {
    add(makeBox(0.3 * s, 0.1 * s, 0.4 * s, 0x4a2c17), [0, 0, 0]);
    halfExtents = new THREE.Vector3(0.15, 0.05, 0.2);
  } else if (input.kind === "newspaper") {
    add(makeBox(0.4 * s, 0.01 * s, 0.6 * s, PAPER), [0, 0, 0]);
    halfExtents = new THREE.Vector3(0.2, 0.005, 0.3);
  } else if (input.kind === "telegram") {
    add(makeBox(0.3 * s, 0.01 * s, 0.2 * s, PAPER), [0, 0, 0]);
    halfExtents = new THREE.Vector3(0.15, 0.005, 0.1);
  } else if (input.kind === "map") {
    add(makeBox(0.5 * s, 0.01 * s, 0.7 * s, 0xc7b377), [0, 0, 0]);
    halfExtents = new THREE.Vector3(0.25, 0.005, 0.35);
  } else if (input.kind === "photograph") {
    add(makeBox(0.3 * s, 0.02 * s, 0.4 * s, 0xd4c4a8), [0, 0, 0]);
    halfExtents = new THREE.Vector3(0.15, 0.01, 0.2);
  } else if (input.kind === "letter") {
    add(makeBox(0.3 * s, 0.01 * s, 0.4 * s, PAPER), [0, 0, 0]);
    halfExtents = new THREE.Vector3(0.15, 0.005, 0.2);
  } else if (input.kind === "journal") {
    add(makeBox(0.3 * s, 0.1 * s, 0.4 * s, DARK_WOOD), [0, 0, 0]);
    halfExtents = new THREE.Vector3(0.15, 0.05, 0.2);
  } else if (input.kind === "bottle") {
    add(makeCylinder(0.05 * s, 0.1 * s, 0.4 * s, 0x3a4a2a), [0, 0, 0]);
    halfExtents = new THREE.Vector3(0.1, 0.2, 0.1);
  } else if (input.kind === "vase") {
    add(makeCylinder(0.05 * s, 0.15 * s, 0.5 * s, 0x8a4a3a), [0, 0, 0]);
    halfExtents = new THREE.Vector3(0.15, 0.25, 0.15);
  } else if (input.kind === "painting") {
    add(makeBox(1.5 * s, 1 * s, 0.05 * s, 0x7a5a3a), [0, 1 * s, 0]);
    halfExtents = new THREE.Vector3(0.75, 0.5, 0.025);
  } else if (input.kind === "mirror") {
    add(makeBox(0.8 * s, 1.2 * s, 0.05 * s, 0xaab8c0), [0, 1 * s, 0]);
    halfExtents = new THREE.Vector3(0.4, 0.6, 0.025);
  } else if (input.kind === "curtain") {
    add(makeBox(1.5 * s, 2.5 * s, 0.05 * s, 0x6a3a4a), [0, 1 * s, 0]);
    halfExtents = new THREE.Vector3(0.75, 1.25, 0.025);
  } else if (input.kind === "rug") {
    add(makeBox(2 * s, 0.02 * s, 3 * s, 0x8a4a2a), [0, -1.4 * s, 0]);
    halfExtents = new THREE.Vector3(1, 0.01, 1.5);
  } else if (input.kind === "statue") {
    add(makeCylinder(0.2 * s, 0.3 * s, 1.5 * s, STONE), [0, 0, 0]);
    add(makeSphere(0.2 * s, STONE), [0, 0.85 * s, 0]);
    halfExtents = new THREE.Vector3(0.3, 1, 0.3);
  } else if (input.kind === "bust") {
    add(makeCylinder(0.2 * s, 0.25 * s, 0.4 * s, STONE), [0, 0, 0]);
    add(makeSphere(0.2 * s, STONE), [0, 0.4 * s, 0]);
    halfExtents = new THREE.Vector3(0.25, 0.5, 0.25);
  } else if (input.kind === "weapon") {
    add(makeCylinder(0.02 * s, 0.02 * s, 1 * s, METAL), [0, 0, 0]);
    add(makeBox(0.1 * s, 0.1 * s, 0.05 * s, WOOD), [0, 0.5 * s, 0]);
    halfExtents = new THREE.Vector3(0.1, 0.5, 0.05);
  } else if (input.kind === "chalice") {
    add(makeCylinder(0.1 * s, 0.05 * s, 0.3 * s, BRASS), [0, 0, 0]);
    add(makeCylinder(0.05 * s, 0.05 * s, 0.05 * s, BRASS), [0, -0.15 * s, 0]);
    halfExtents = new THREE.Vector3(0.1, 0.2, 0.1);
  } else if (input.kind === "weapon_rack") {
    add(makeBox(1 * s, 1.5 * s, 0.1 * s, DARK_WOOD), [0, 0, 0]);
    add(makeCylinder(0.02 * s, 0.02 * s, 0.8 * s, METAL), [0, 0, 0]);
    add(makeCylinder(0.02 * s, 0.02 * s, 0.8 * s, METAL), [-0.3 * s, 0, 0]);
    add(makeCylinder(0.02 * s, 0.02 * s, 0.8 * s, METAL), [0.3 * s, 0, 0]);
    halfExtents = new THREE.Vector3(0.5, 0.8, 0.05);
  } else if (input.kind === "bookshelf") {
    add(makeBox(2 * s, 3 * s, 0.4 * s, DARK_WOOD), [0, 1 * s, 0]);
    add(makeBox(1.8 * s, 0.05 * s, 0.4 * s, WOOD), [0, 0.5 * s, 0]);
    add(makeBox(1.8 * s, 0.05 * s, 0.4 * s, WOOD), [0, 1.5 * s, 0]);
    add(makeBox(1.8 * s, 0.05 * s, 0.4 * s, WOOD), [0, 2.5 * s, 0]);
    halfExtents = new THREE.Vector3(1, 1.5, 0.2);
  } else {
    // Unknown prop — small grey cube so the scene still composes.
    add(makeBox(0.4 * s, 0.4 * s, 0.4 * s, METAL), [0, 0, 0]);
    halfExtents = new THREE.Vector3(0.2, 0.2, 0.2);
  }

  return { group, halfExtents };
}

export function isRoomProp(kind: string): boolean {
  return ROOM.has(kind);
}

export function isFurnitureProp(kind: string): boolean {
  return FURNITURE.has(kind);
}

export function isEraProp(kind: string): boolean {
  return ERA.has(kind);
}

export function isDocProp(kind: string): boolean {
  return DOC.has(kind);
}

export function isObjectProp(kind: string): boolean {
  return OBJECT.has(kind);
}