/**
 * Prop registry — single source of truth for what 3D props WhoWare
 * supports. The AI emits `kind` strings from the closed vocabulary
 * defined in `SCENE_BRIEF_SYSTEM_PROMPT`; this module owns the
 * metadata that maps each kind to its render representation.
 *
 * Per CONSOLIDATION we keep this on the server side (where the
 * schema is enforced) and expose the type-only metadata to the
 * client via the existing scene briefs. Phase 3 (Tripo) will
 * augment this with hero-prop GLB URLs; for now we use procedural
 * primitives on the client.
 */

export type PropKind =
  // room
  | "floor" | "wall" | "ceiling" | "doorway" | "window" | "fireplace"
  // furniture
  | "desk" | "chair" | "bed" | "table" | "shelf" | "cabinet" | "sofa"
  // era objects
  | "candle" | "lantern" | "oil_lamp" | "gramophone" | "typewriter"
  | "telegraph" | "vintage_radio" | "rotary_phone" | "ledger"
  | "parchment" | "scroll" | "globe" | "telescope" | "sextant"
  | "hourglass" | "pocket_watch" | "compass"
  // documents
  | "book" | "newspaper" | "telegram" | "map" | "photograph"
  | "letter" | "journal"
  // objects
  | "bottle" | "vase" | "painting" | "mirror" | "curtain" | "rug"
  | "statue" | "bust" | "weapon" | "chalice" | "weapon_rack"
  | "bookshelf";

export type PropCategory = "room" | "furniture" | "era" | "doc" | "object";

export interface PropMeta {
  kind: PropKind;
  category: PropCategory;
  /** Short label used in dev tools / logs. */
  label: string;
}

const PROP_TABLE: Record<PropKind, PropMeta> = {
  // room
  floor: { kind: "floor", category: "room", label: "Floor" },
  wall: { kind: "wall", category: "room", label: "Wall" },
  ceiling: { kind: "ceiling", category: "room", label: "Ceiling" },
  doorway: { kind: "doorway", category: "room", label: "Doorway" },
  window: { kind: "window", category: "room", label: "Window" },
  fireplace: { kind: "fireplace", category: "room", label: "Fireplace" },
  // furniture
  desk: { kind: "desk", category: "furniture", label: "Desk" },
  chair: { kind: "chair", category: "furniture", label: "Chair" },
  bed: { kind: "bed", category: "furniture", label: "Bed" },
  table: { kind: "table", category: "furniture", label: "Table" },
  shelf: { kind: "shelf", category: "furniture", label: "Shelf" },
  cabinet: { kind: "cabinet", category: "furniture", label: "Cabinet" },
  sofa: { kind: "sofa", category: "furniture", label: "Sofa" },
  // era objects
  candle: { kind: "candle", category: "era", label: "Candle" },
  lantern: { kind: "lantern", category: "era", label: "Lantern" },
  oil_lamp: { kind: "oil_lamp", category: "era", label: "Oil lamp" },
  gramophone: { kind: "gramophone", category: "era", label: "Gramophone" },
  typewriter: { kind: "typewriter", category: "era", label: "Typewriter" },
  telegraph: { kind: "telegraph", category: "era", label: "Telegraph" },
  vintage_radio: { kind: "vintage_radio", category: "era", label: "Vintage radio" },
  rotary_phone: { kind: "rotary_phone", category: "era", label: "Rotary phone" },
  ledger: { kind: "ledger", category: "era", label: "Ledger" },
  parchment: { kind: "parchment", category: "era", label: "Parchment" },
  scroll: { kind: "scroll", category: "era", label: "Scroll" },
  globe: { kind: "globe", category: "era", label: "Globe" },
  telescope: { kind: "telescope", category: "era", label: "Telescope" },
  sextant: { kind: "sextant", category: "era", label: "Sextant" },
  hourglass: { kind: "hourglass", category: "era", label: "Hourglass" },
  pocket_watch: { kind: "pocket_watch", category: "era", label: "Pocket watch" },
  compass: { kind: "compass", category: "era", label: "Compass" },
  // documents
  book: { kind: "book", category: "doc", label: "Book" },
  newspaper: { kind: "newspaper", category: "doc", label: "Newspaper" },
  telegram: { kind: "telegram", category: "doc", label: "Telegram" },
  map: { kind: "map", category: "doc", label: "Map" },
  photograph: { kind: "photograph", category: "doc", label: "Photograph" },
  letter: { kind: "letter", category: "doc", label: "Letter" },
  journal: { kind: "journal", category: "doc", label: "Journal" },
  // objects
  bottle: { kind: "bottle", category: "object", label: "Bottle" },
  vase: { kind: "vase", category: "object", label: "Vase" },
  painting: { kind: "painting", category: "object", label: "Painting" },
  mirror: { kind: "mirror", category: "object", label: "Mirror" },
  curtain: { kind: "curtain", category: "object", label: "Curtain" },
  rug: { kind: "rug", category: "object", label: "Rug" },
  statue: { kind: "statue", category: "object", label: "Statue" },
  bust: { kind: "bust", category: "object", label: "Bust" },
  weapon: { kind: "weapon", category: "object", label: "Weapon" },
  chalice: { kind: "chalice", category: "object", label: "Chalice" },
  weapon_rack: { kind: "weapon_rack", category: "object", label: "Weapon rack" },
  bookshelf: { kind: "bookshelf", category: "object", label: "Bookshelf" },
};

export const ALL_PROP_KINDS = Object.keys(PROP_TABLE) as PropKind[];

/** Returns metadata for a known kind, or null for an unknown kind. */
export function lookupProp(kind: string): PropMeta | null {
  if (kind in PROP_TABLE) return PROP_TABLE[kind as PropKind];
  return null;
}

/** True when the AI emitted a `kind` we recognise. */
export function isKnownPropKind(kind: string): kind is PropKind {
  return kind in PROP_TABLE;
}