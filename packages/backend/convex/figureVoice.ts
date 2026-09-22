/**
 * figureVoice — deterministic quote generator for clues.
 *
 * v0.3 of WhoWare: every clue, when opened, pairs an artifact description
 * with a first-person quote from the figure reacting to that object. The
 * quote is composed at runtime from the figure's metadata (tags, era,
 * region) and the clue's metadata (label, detail). No LLM calls.
 *
 * The engine is intentionally a *swap point*. If/when we upgrade to
 * LLM-generated quotes, only this module changes — schema, UI, callers,
 * and downstream code stay put.
 *
 * Composition pipeline:
 *   1. Pick a voice role from `figure.tags` (scholar / warrior / artist /
 *      ruler / religious / commoner / explorer / writer).
 *   2. Pick an object kind from keywords in `clue.label` (instrument /
 *      weapon / document / garment / building / portrait / letter /
 *      jewelry / tool / food / plant / animal / book).
 *   3. Pick a voice pattern by role — each pattern is a small template
 *      with slots filled by object-kind phrasing, era vocabulary, and
 *      region references.
 *   4. Substitute era-bucketed vocabulary (ancient vs modern terms).
 *   5. Render the quote.
 *
 * Determinism: `quoteForClue` is a pure function — no randomness. The
 * voice comes from the metadata, not from chance.
 */

export type VoiceRole =
  | "scholar"
  | "warrior"
  | "artist"
  | "ruler"
  | "religious"
  | "commoner"
  | "explorer"
  | "writer";

export type ObjectKind =
  | "instrument"
  | "weapon"
  | "document"
  | "garment"
  | "building"
  | "portrait"
  | "letter"
  | "jewelry"
  | "tool"
  | "food"
  | "plant"
  | "animal"
  | "book"
  | "vessel"
  | "music"
  | "generic";

export type EraBucket =
  | "ancient"      // before 500 CE
  | "classical"    // 500–1500 CE
  | "renaissance"  // 1500–1700
  | "early-modern" // 1700–1900
  | "modern";      // 1900+

// ── Role selection ────────────────────────────────────────────────

const SCHOLAR_TAGS = [
  "mathematician", "scientist", "astronomer", "physicist", "chemist",
  "biologist", "philosopher", "theologian", "scholar", "naturalist",
  "doctor", "physician", "engineer", "inventor",
];

const WARRIOR_TAGS = [
  "warrior", "soldier", "general", "military", "knight", "samurai",
  "mercenary", "commander", "monarch-warrior", "pirate", "spy",
];

const ARTIST_TAGS = [
  "artist", "painter", "sculptor", "composer", "musician",
  "architect", "poet", "playwright", "performer", "dancer",
];

const RULER_TAGS = [
  "monarch", "ruler", "emperor", "empress", "king", "queen",
  "pharaoh", "sultan", "shogun", "statesman", "diplomat",
  "politician", "consul", "president",
];

const RELIGIOUS_TAGS = [
  "religious", "saint", "priest", "nun", "monk", "imam", "rabbi",
  "bishop", "pope", "prophet", "mystic", "reformer",
];

const EXPLORER_TAGS = [
  "explorer", "navigator", "cartographer", "traveller", "voyager",
  "naturalist", "ethnographer",
];

const WRITER_TAGS = [
  "writer", "novelist", "essayist", "historian", "journalist",
  "translator", "poet", "playwright", "diarist",
];

export function pickRole(tags: string[]): VoiceRole {
  if (tags.some((t) => SCHOLAR_TAGS.includes(t))) return "scholar";
  if (tags.some((t) => WARRIOR_TAGS.includes(t))) return "warrior";
  if (tags.some((t) => ARTIST_TAGS.includes(t))) return "artist";
  if (tags.some((t) => RULER_TAGS.includes(t))) return "ruler";
  if (tags.some((t) => RELIGIOUS_TAGS.includes(t))) return "religious";
  if (tags.some((t) => EXPLORER_TAGS.includes(t))) return "explorer";
  if (tags.some((t) => WRITER_TAGS.includes(t))) return "writer";
  return "commoner";
}

// ── Object kind selection ─────────────────────────────────────────

const KIND_RULES: Array<[RegExp, ObjectKind]> = [
  [/astrolabe|telescope|microscope|lens|prism|compass|sextant|clock|orrey|sundial|calculator|abacus/i, "instrument"],
  [/sword|blade|dagger|spear|bow|glaive|pistol|gun|musket|rifle|cannon|saber|halberd|scimitar/i, "weapon"],
  [/map|chart|scroll|parchment|deed|will|testament|manifest|ledger|dispatch|treaty|codex/i, "document"],
  [/robe|cloak|gown|garment|dress|sash|tunic|armor|armour|helmet|crown|shawl|coat|veil/i, "garment"],
  [/temple|mosque|cathedral|church|chapel|palace|castle|monastery|pyramid|tower|walls/i, "building"],
  [/portrait|painting|self-portrait|likeness|sketch|drawing|statue|bust/i, "portrait"],
  [/letter|note|epistle|missive|message|dispatch/i, "letter"],
  [/ring|amulet|pendant|necklace|bracelet|cameo|brooch|tiara|crown|gem/i, "jewelry"],
  [/hammer|chisel|awl|loom|press|kiln|potters|forge|anvil|spindle/i, "tool"],
  [/bread|wine|grain|spice|tea|coffee|meal|feast|harvest/i, "food"],
  [/flower|herb|tree|seed|root|leaf|plant|moss/i, "plant"],
  [/horse|dog|cat|bird|eagle|hawk|fish|snake|beast|hound/i, "animal"],
  [/book|novel|journal|diary|memoir|anthology|manuscript|volume|tome/i, "book"],
  [/bowl|cup|chalice|goblet|vessel|urn|vase|amphora|jars|jug/i, "vessel"],
  [/violin|lute|lyre|harp|flute|pipe|drum|organ|cymbal/i, "music"],
];

export function pickObjectKind(label: string): ObjectKind {
  for (const [regex, kind] of KIND_RULES) {
    if (regex.test(label)) return kind;
  }
  return "generic";
}

// ── Era bucketing ─────────────────────────────────────────────────

export function bucketEra(era: string): EraBucket {
  const lower = era.toLowerCase();
  // Look for century markers first.
  const centuryMatch = lower.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(?:century|c\.|centur)/);
  if (centuryMatch) {
    const n = parseInt(centuryMatch[1], 10);
    if (n < 5) return "ancient";
    if (n < 15) return "classical";
    if (n < 17) return "renaissance";
    if (n < 19) return "early-modern";
    return "modern";
  }
  // Year-based fallback.
  const yearMatch = lower.match(/(\d{3,4})/);
  if (yearMatch) {
    const y = parseInt(yearMatch[1], 10);
    if (y < 500) return "ancient";
    if (y < 1500) return "classical";
    if (y < 1700) return "renaissance";
    if (y < 1900) return "early-modern";
    return "modern";
  }
  // BCE handling.
  if (/bce|bc\b/.test(lower)) return "ancient";
  return "early-modern";
}

// ── Voice patterns ────────────────────────────────────────────────
//
// Each role gets several patterns. Pattern slots:
//
//   {I}           — "I" (lowercase per era)
//   {this}        — "this" / "this object" / "the object"
//   {thing}       — kind-specific noun phrase for the object
//   {relation}    — kind-specific verb relating the figure to the object
//   {place}       — region/location reference
//   {memEra}      — era-bucketed memory phrase
//   {role}        — figure's discipline/profession word
//
// The patterns below are tuned to sound like voice, not Mad Libs.
// Sentence cadence varies by role: scholars are measured (often two
// sentences), warriors are terse, religious are present-tense.

const KIND_NOUN: Record<ObjectKind, string[]> = {
  instrument: ["this instrument", "this device", "this tool of measurement", "this apparatus"],
  weapon: ["this weapon", "this blade", "this", "it"],
  document: ["this document", "this paper", "this writing", "these words"],
  garment: ["this garment", "what I wore", "this cloth", "these robes"],
  building: ["this place", "this hall", "where I lived", "these walls"],
  portrait: ["this portrait", "this likeness", "how they painted me", "this face"],
  letter: ["this letter", "these words I wrote", "this message", "this paper"],
  jewelry: ["this", "this ornament", "this token", "what I wore at my throat"],
  tool: ["this tool", "this instrument of my trade", "what I worked with", "this"],
  food: ["this food", "what we ate", "this meal", "what sustained me"],
  plant: ["this plant", "what grew beside me", "this herb", "this"],
  animal: ["this creature", "this animal", "what kept me company", "this beast"],
  book: ["this book", "these pages", "what I read", "this volume"],
  vessel: ["this vessel", "this cup", "this", "what I drank from"],
  music: ["this instrument", "what I played", "this music", "this"],
  generic: ["this", "what you see", "this thing", "it"],
};

const KIND_RELATION: Record<ObjectKind, string[]> = {
  instrument: ["I learned on", "I used to chart", "I built with", "I calibrated against the stars with"],
  weapon: ["I carried", "I wielded", "I held", "I fought with"],
  document: ["I drafted", "I read until I knew it by heart", "I signed", "I kept with me"],
  garment: ["I wore", "they dressed me in", "I was buried in", "I carried into"],
  building: ["I built", "I lived in", "I prayed in", "I raised"],
  portrait: ["they made of me", "I sat for", "I painted", "I kept hidden"],
  letter: ["I wrote", "I received", "I carried across", "I answered"],
  jewelry: ["I wore", "they gave me", "I never removed", "I inherited"],
  tool: ["I worked with", "I learned my craft with", "I made my living with", "I used"],
  food: ["I ate", "we shared", "sustained me through", "I traded for"],
  plant: ["I grew", "I cultivated", "I learned the uses of", "I gathered"],
  animal: ["I kept", "I rode", "I trained", "I lived beside"],
  book: ["I read", "I wrote", "I carried with me", "I learned from"],
  vessel: ["I drank from", "I poured", "I kept my ink in", "I broke on the day"],
  music: ["I played", "I learned on", "I composed for", "I heard first on"],
  generic: ["I held", "I kept", "I found", "I remember"],
};

const KIND_FOLLOW: Record<ObjectKind, string[]> = {
  instrument: ["what my teacher built before me", "what the stars spoke to me through", "what measured my life's work", "what no one else could read"],
  weapon: ["when the field was lost", "when I knew it was over", "until the day I fell", "when I learned what I was for"],
  document: ["and I believe every word", "though I changed my mind about some of it", "which they would not let me publish", "which outlived me"],
  garment: ["and never took it off again", "until the day I was taken", "the day I came into my own", "for every public thing I did"],
  building: ["and saw it finished", "and lived there until they came for me", "with nothing but my own hands", "until the last of us was gone"],
  portrait: ["and tried not to blink", "and they painted me tired", "and the painter knew more than I did", "which I never looked at directly"],
  letter: ["and burned the draft three times first", "and sent it anyway", "and waited years for the answer", "which I rewrote twice"],
  jewelry: ["and never told anyone where I kept it", "for the rest of my life", "until they took it from me", "from the day they gave it to me"],
  tool: ["until my hands gave out", "every day for years", "when I had nothing else", "until I learned to do without"],
  food: ["when there was nothing else", "and thought of home", "through the worst winter I knew", "and was grateful for it"],
  plant: ["in the only patch of earth I owned", "and it survived me", "which I tended every morning", "that the birds never touched"],
  animal: ["and it understood me better than most", "until we were separated", "for as long as I lived", "and it never left my side"],
  book: ["until I could recite it", "and disagreed with half of it", "which I still keep", "and still reach for"],
  vessel: ["and thought of who had used it before me", "and the taste stayed with me", "which I never washed", "and the wine was better than the company"],
  music: ["and the room fell silent", "until I could play it in my sleep", "for the only audience that mattered", "which I never played the same way twice"],
  generic: ["and I have not let it go since", "which they would not let me forget", "and I think of it still", "and the world has never been the same"],
};

const MEM_PHRASES: Record<EraBucket, string[]> = {
  ancient: ["in the time of the first emperor", "when the city still stood", "before the fire", "in the days of my father", "when the gods were still speaking"],
  classical: ["when the city was at its height", "before the plague", "in the days of the old law", "when the borders were open", "in my grandfather's time"],
  renaissance: ["when the new learning came", "before the schism", "in the time of the great voyages", "when the printing house first opened", "in my father's house"],
  "early-modern": ["when the railways were new", "before the revolution", "in the year of the great comet", "when the colonies were still ours", "when my mother was alive"],
  modern: ["when I was young", "before the war", "in the year everything changed", "when the old world was still here", "in my first job"],
};

const ROLE_LABELS: Record<VoiceRole, string> = {
  scholar: "scholar",
  warrior: "warrior",
  artist: "artist",
  ruler: "ruler",
  religious: "servant",
  commoner: "I",
  explorer: "traveller",
  writer: "writer",
};

// Pattern templates per role. Each pattern reads as a complete thought
// — the kind-specific phrases slot into specific positions, never
// randomly. Cadence matches the role's voice.

const PATTERNS: Record<VoiceRole, Array<(slots: PatternSlots) => string>> = {
  scholar: [
    ({ I, thing, relation, follow, memEra, place }) =>
      `${capitalize(I)} ${relation} ${thing}, ${follow}. That was ${memEra}, in ${place}.`,
    ({ I, thing, follow, memEra, place }) =>
      `${capitalize(I)} came to ${thing} late — ${follow}. ${capitalize(memEra)}, in ${place}, the question was all that mattered.`,
    ({ I, thing, relation, place }) =>
      `${capitalize(I)} ${relation} ${thing} when I was working alone. The work was the point; ${place} just happened to be where I did it.`,
  ],
  warrior: [
    ({ I, thing, relation, follow, place }) =>
      `${capitalize(I)} ${relation} ${thing}, ${follow}. ${place} was where it ended.`,
    ({ I, thing, relation }) =>
      `${capitalize(I)} ${relation} ${thing}. That's all there is to say about it.`,
    ({ I, thing, relation, follow, place }) =>
      `${capitalize(I)} ${relation} ${thing} and ${follow}. They asked me about ${place} later; I never answered.`,
  ],
  artist: [
    ({ I, thing, relation, follow, place }) =>
      `${capitalize(I)} ${relation} ${thing}, ${follow}. I worked in ${place} because no one else did.`,
    ({ I, thing, relation, memEra, place }) =>
      `${capitalize(I)} ${relation} ${thing} ${memEra}, in ${place}. The work kept me.`,
    ({ I, thing, relation, follow }) =>
      `${capitalize(I)} ${relation} ${thing} and ${follow}. The rest of it — what people made of it — was never mine.`,
  ],
  ruler: [
    ({ I, thing, relation, follow, place }) =>
      `${capitalize(I)} ${relation} ${thing}; ${follow}. ${place} was my office, not my home.`,
    ({ I, thing, relation, place }) =>
      `${capitalize(I)} ${relation} ${thing} because the office demanded it. ${place} saw more of me than my family did.`,
    ({ I, thing, relation, follow }) =>
      `${capitalize(I)} ${relation} ${thing}, and ${follow}. People remember the office; I remember the work.`,
  ],
  religious: [
    ({ I, thing, relation, follow, place }) =>
      `${capitalize(I)} ${relation} ${thing}, ${follow}. The work in ${place} was the vocation; the rest was weather.`,
    ({ I, thing, relation, memEra, place }) =>
      `${capitalize(I)} ${relation} ${thing} ${memEra}, in ${place}. I do not separate the calling from the days.`,
    ({ I, thing, relation, follow }) =>
      `${capitalize(I)} ${relation} ${thing}; ${follow}. The instrument is small; the work is not.`,
  ],
  commoner: [
    ({ I, thing, relation, follow, place }) =>
      `${capitalize(I)} ${relation} ${thing}, ${follow}. I was nobody from ${place}; the work was the thing I had.`,
    ({ I, thing, relation, memEra, place }) =>
      `${capitalize(I)} ${relation} ${thing} ${memEra}, in ${place}. I didn't know it would be remembered.`,
    ({ I, thing, relation, follow }) =>
      `${capitalize(I)} ${relation} ${thing}, ${follow}. That was my life. I made it from what I could find.`,
  ],
  explorer: [
    ({ I, thing, relation, follow, place }) =>
      `${capitalize(I)} ${relation} ${thing} when ${place} was still unknown to us. ${capitalize(follow)}.`,
    ({ I, thing, relation, memEra, place }) =>
      `${capitalize(I)} ${relation} ${thing} ${memEra}. ${place} was the destination; ${thing} was the proof I came back.`,
    ({ I, thing, relation, follow, place }) =>
      `${capitalize(I)} ${relation} ${thing}, ${follow}. The map of ${place} was the real work; everything else was the journey.`,
  ],
  writer: [
    ({ I, thing, relation, follow, place }) =>
      `${capitalize(I)} ${relation} ${thing}, ${follow}. I kept the desk in ${place}; the rest of the life arranged itself around it.`,
    ({ I, thing, relation, memEra, place }) =>
      `${capitalize(I)} ${relation} ${thing} ${memEra}, in ${place}. The page was the only honest thing in the room.`,
    ({ I, thing, relation, follow }) =>
      `${capitalize(I)} ${relation} ${thing}, and ${follow}. Readers will make of it what they make of it.`,
  ],
};

interface PatternSlots {
  I: string;
  thing: string;
  relation: string;
  follow: string;
  memEra: string;
  place: string;
  role: string;
}

function capitalize(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function pick<T>(arr: T[]): T {
  // Deterministic — pick the first element. The voice comes from the
  // metadata, not from chance. (Randomization here would make quotes
  // unstable across renders; deterministic is also easier to debug.)
  return arr[0];
}

// ── Region / location reference ───────────────────────────────────

function pickPlaceRef(region: string, location: string): string {
  const candidates = [region, location].filter(Boolean);
  for (const c of candidates) {
    // Strip trailing commas, periods.
    const trimmed = c.replace(/[,.]\s*$/, "").trim();
    if (trimmed.length > 0 && trimmed.length < 60) return trimmed;
  }
  return "home";
}

// ── Public API ────────────────────────────────────────────────────

export interface FigureVoiceInput {
  figure: {
    canonicalName: string;
    era: string;
    region: string;
    tags: string[];
  };
  scene: {
    title: string;
    location: string;
    era: string;
  };
  clue: {
    label: string;
    detail: string;
  };
}

export function quoteForClue(input: FigureVoiceInput): string {
  const { figure, scene, clue } = input;
  const role = pickRole(figure.tags);
  const objectKind = pickObjectKind(clue.label);
  const eraBucket = bucketEra(figure.era || scene.era);
  const place = pickPlaceRef(figure.region, scene.location);
  const memEra = pick(MEM_PHRASES[eraBucket]);
  const thing = pick(KIND_NOUN[objectKind]);
  const relation = pick(KIND_RELATION[objectKind]);
  const follow = pick(KIND_FOLLOW[objectKind]);

  // Role-specific pattern choice — index by hash of clue label so the
  // same clue always gets the same pattern. Different patterns per
  // clue label = variation across the figure's voice across scenes.
  const patterns = PATTERNS[role];
  const hash = simpleHash(clue.label);
  const pattern = patterns[hash % patterns.length];

  const quote = pattern({
    I: "I",
    thing,
    relation,
    follow,
    memEra,
    place,
    role: ROLE_LABELS[role],
  });
  return quote.trim();
}

/** Cheap deterministic hash. Doesn't need to be cryptographic. */
function simpleHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}