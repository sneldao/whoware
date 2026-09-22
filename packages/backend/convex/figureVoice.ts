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
  // First-person verbs, no leading "I" — the pattern adds the "I".
  instrument: ["learned on", "used to chart", "built with", "calibrated against the stars with"],
  weapon: ["carried", "wielded", "held", "fought with"],
  document: ["drafted", "read until I knew it by heart", "signed", "kept with me"],
  garment: ["wore", "was dressed in", "was buried in", "carried into"],
  building: ["built", "lived in", "prayed in", "raised"],
  portrait: ["sat for", "painted", "kept hidden", "refused to look at"],
  letter: ["wrote", "received", "carried across", "answered"],
  jewelry: ["wore", "was given", "never removed", "inherited"],
  tool: ["worked with", "learned my craft on", "made my living with", "used"],
  food: ["ate", "shared with the household", "was sustained by", "traded for"],
  plant: ["grew", "cultivated", "learned the uses of", "gathered"],
  animal: ["kept", "rode", "trained", "lived beside"],
  book: ["read", "wrote", "carried with me", "learned from"],
  vessel: ["drank from", "poured from", "kept my ink in", "broke the day"],
  music: ["played", "learned on", "composed for", "heard first on"],
  generic: ["held", "kept", "found", "remember"],
};

const KIND_FOLLOW: Record<ObjectKind, string[]> = {
  // Follow phrases never lead with "and" — the patterns supply that connector
  // when they want one.
  instrument: ["what my teacher built before me", "what the stars spoke to me through", "what measured my life's work", "what no one else could read"],
  weapon: ["when the field was lost", "when I knew it was over", "until the day I fell", "when I learned what I was for"],
  document: ["I believe every word", "though I changed my mind about some of it", "which they would not let me publish", "which outlived me"],
  garment: ["I never took it off again", "until the day I was taken", "the day I came into my own", "for every public thing I did"],
  building: ["I saw it finished", "I lived there until they came for me", "with nothing but my own hands", "until the last of us was gone"],
  portrait: ["I tried not to blink", "they painted me tired", "the painter knew more than I did", "which I never looked at directly"],
  letter: ["I burned the draft three times first", "I sent it anyway", "I waited years for the answer", "which I rewrote twice"],
  jewelry: ["I never told anyone where I kept it", "for the rest of my life", "until they took it from me", "from the day they gave it to me"],
  tool: ["until my hands gave out", "every day for years", "I had nothing else", "until I learned to do without"],
  food: ["when there was nothing else", "I thought of home", "through the worst winter I knew", "I was grateful for it"],
  plant: ["in the only patch of earth I owned", "it survived me", "which I tended every morning", "that the birds never touched"],
  animal: ["it understood me better than most", "until we were separated", "for as long as I lived", "it never left my side"],
  book: ["until I could recite it", "I disagreed with half of it", "which I still keep", "I still reach for it"],
  vessel: ["I thought of who had used it before me", "the taste stayed with me", "which I never washed", "the wine was better than the company"],
  music: ["the room fell silent", "until I could play it in my sleep", "for the only audience that mattered", "which I never played the same way twice"],
  generic: ["I have not let it go since", "they would not let me forget", "I think of it still", "the world has never been the same"],
};

const MEM_PHRASES: Record<EraBucket, string[]> = {
  ancient: ["the time of the first emperor", "the days when the city still stood", "before the fire", "my father's time", "when the gods were still speaking"],
  classical: ["when the city was at its height", "before the plague", "the days of the old law", "when the borders were open", "my grandfather's time"],
  renaissance: ["the new learning", "before the schism", "the time of the great voyages", "when the printing house first opened", "my father's house"],
  "early-modern": ["when the railways were new", "before the revolution", "the year of the great comet", "when the colonies were still ours", "when my mother was alive"],
  modern: ["when I was young", "before the war", "the year everything changed", "when the old world was still here", "my first job"],
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
      `${capitalize(I)} ${relation} ${thing} — ${follow}. The rest of it — what people made of it — was never mine.`,
  ],
  ruler: [
    ({ I, thing, relation, follow, place }) =>
      `${capitalize(I)} ${relation} ${thing}; ${follow}. ${capitalize(place)} was my office, not my home.`,
    ({ I, thing, relation, place }) =>
      `${capitalize(I)} ${relation} ${thing} because the office demanded it. ${capitalize(place)} saw more of me than my family did.`,
    ({ I, thing, relation, follow }) =>
      `${capitalize(I)} ${relation} ${thing} — ${follow}. People remember the office; I remember the work.`,
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
    // Strip trailing commas, periods. Cap length so a long-form region
    // ("Roman Empire", "the Kingdom of France") doesn't dominate the quote.
    const trimmed = c.replace(/[,.]\s*$/, "").trim();
    if (trimmed.length > 0 && trimmed.length <= 24) return trimmed;
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
  /**
   * v0.4 — the absent figure (puzzle target) when the room-figure is
   * someone else. When present, the engine switches to relational mode:
   * the room-figure speaks *about* the target, never naming them
   * directly. Pronouns derived from `targetFigure.canonicalName`.
   */
  targetFigure?: {
    canonicalName: string;
    era?: string;
    region?: string;
    tags?: string[];
  };
}

// ── v0.4 — pronoun bank + relational role labels ────────────

const FEMALE_FIRST_NAMES = new Set([
  "ada", "agnes", "alexandra", "alice", "anne", "aretha", "artemisia",
  "audrey", "aung", "aurelia", "beatrice", "benazir", "bridget",
  "catherine", "caterina", "cecilia", "charlotte", "claire", "claude",
  "cleopatra", "cristina", "dolores", "dorothy", "edith", "eleanor",
  "elena", "elizabeth", "ellen", "elsie", "emily", "emma", "fatima",
  "florence", "frida", "georgia", "gertrude", "golda", "grazia",
  "harriet", "hatshepsut", "hedy", "helen", "hildegard", "hypatia",
  "isabel", "jane", "jeanne", "jenny", "jesse", "joan", "johanna", "juliana",
  "julie", "katrina", "lavinia", "lise", "louisa", "louise", "ludmila",
  "margaret", "marguerite", "maria", "marian", "marie", "martha",
  "mary", "matilda", "maura", "meave", "murasaki", "nancy", "nasrin",
  "nawal", "nettie", "nikki", "olympe", "paula", "pocahontas",
  "portia", "queen", "rachael", "rachel", "ramabai", "rebecca",
  "renata", "rosalind", "rosalyn", "rosie", "roxelana", "saint",
  "sarah", "serena", "shirley", "simone", "sojourner", "sonia",
  "sophia", "sophie", "susan", "tamara", "teresa", "tessa", "valentina",
  "vera", "victoria", "virginia", "wilhelmina", "willa", "winifred",
  "xochitl", "yv",
]);

const MALE_FIRST_NAMES = new Set([
  "abraham", "achilles", "adolf", "alan", "albert", "alexander",
  "alexis", "alfred", "alphonsus", "ambrose", "amos", "andrew", "anne",
  "anthony", "anton", "antonio", "archimedes", "aristotle", "arnold",
  "arthur", "august", "augustine", "augustus", "aurelius", "austin",
  "barnaby", "barry", "bartolommeo", "ben", "benjamin", "bernard",
  "bill", "bob", "bobby", "bram", "byron", "caesar", "carl", "charles",
  "chen", "chester", "christopher", "claude", "clemens", "confucius",
  "cornelius", "curie", "dale", "dante", "darwin", "david", "democritus",
  "dennis", "diogenes", "donald", "donatello", "duke", "earl", "edgar",
  "edison", "edmund", "eduardo", "edward", "eli", "elias", "elijah",
  "emerson", "emile", "emmanuel", "epictetus", "erasmus", "eric",
  "ernest", "ettore", "euclid", "ezra", "fidel", "firdaus", "francis",
  "frank", "franklin", "frederick", "friedrich", "gabriel", "gandhi",
  "garrick", "george", "gerald", "gilbert", "giordano", "giorgio",
  "giuseppe", "glenn", "gottfried", "goethe", "gregor", "gregory",
  "guillaume", "gustav", "guy", "hamilton", "hannibal", "harold",
  "harry", "heinrich", "helmut", "henri", "henry", "herbert", "herman",
  "hermann", "hieronymus", "hirohito", "homer", "honore", "howard",
  "hugh", "humphrey", "ibn", "ignaz", "immanuel", "isaac", "isaiah",
  "ishihara", "ivan", "jack", "jacob", "jacques", "james", "james",
  "jared", "jasper", "jean", "jefferson", "jerome", "jesse", "jesus",
  "jimi", "jimmy", "joaquin", "johann", "john", "jonathan", "joseph",
  "joshua", "juan", "julius", "karl", "keith", "ken", "kenneth",
  "kurt", "kyle", "langston", "lars", "laurent", "lawrence", "leon",
  "leonard", "leonardo", "leopold", "lewis", "liam", "lloyd", "logan",
  "louis", "luca", "lucas", "ludwig", "luigi", "luther", "madison",
  "magnus", "mahatma", "malcolm", "marc", "marcel", "marco", "marcus",
  "mark", "marquis", "martin", "marvin", "mason", "matt", "matthew",
  "maurice", "max", "maximilian", "mendel", "michelangelo", "michel",
  "mike", "miles", "milton", "moliere", "morris", "muhammad", "napoleon",
  "nathan", "nathaniel", "neil", "nicholas", "nicolaus", "niels",
  "nikita", "nikola", "noah", "nobel", "noel", "oliver", "omar",
  "orhan", "orville", "oscar", "osman", "otto", "owen", "pablo",
  "pascal", "patrick", "paul", "pavel", "peter", "philip", "philipp",
  "plato", "pollock", "pope", "pyrrhus", "rainer", "ralph", "raphael",
  "raymond", "rene", "richard", "robert", "roberto", "roger", "roland",
  "roman", "romeo", "ronald", "rudolf", "russell", "samuel", "santi",
  "santiago", "scipio", "scott", "seneca", "sergei", "sigmund",
  "silvester", "simon", "solomon", "spinoza", "stanley", "stephen",
  "steve", "stevens", "stuart", "sundiata", "sven", "tchaikovsky",
  "terrence", "theodore", "theseus", "thomas", "tiberius", "timothy",
  "tolstoy", "tomas", "tony", "travis", "trotsky", "truman",
  "ulysses", "valentin", "vance", "vasco", "victor", "vincent",
  "virgil", "vladimir", "voltaire", "wagner", "wallace", "walt",
  "walter", "warren", "washington", "wayne", "wernher", "werner",
  "wesley", "wilbur", "wiley", "will", "william", "winston", "wolfe",
  "woods", "wright", "xavier", "yves", "zachary", "zeno", "zhuang",
]);

export type Pronoun = "she" | "he" | "they";

export function pickPronoun(canonicalName: string): Pronoun {
  // First-name extraction: drop titles ("Saint", "Queen", "Pope", "King"),
  // drop suffixes ("of Alexandria", "the Great"), take the first word.
  const cleaned = canonicalName
    .replace(/^(Saint|Sister|Brother|Pope|Queen|King|Emperor|Empress|Lord|Lady|Sir|Dame|Duke|Duchess|Prince|Princess|Pharaoh|Baron|Baroness|Count|Countess)\s+/i, "")
    .trim();
  const firstName = cleaned.split(/\s+/)[0]?.toLowerCase() ?? "";
  if (FEMALE_FIRST_NAMES.has(firstName)) return "she";
  if (MALE_FIRST_NAMES.has(firstName)) return "he";
  return "they";
}

export type RelationalLabel =
  | "my teacher"
  | "my mentor"
  | "my master"
  | "my rival"
  | "the one I followed"
  | "the one who taught me"
  | "the person I learned from"
  | "the one I worked beside";

const STUDENTISH_TAGS = ["student", "follower", "disciple", "apprentice", "protege"];
const MENTOR_TAGS = ["teacher", "tutor", "mentor", "professor", "rhetorician", "instructor"];
const RIVAL_TAGS = ["rival", "opponent", "antagonist", "adversary"];

export function pickRelationalLabel(roomFigureTags: string[]): RelationalLabel {
  const bank: RelationalLabel[] = [];
  // Speaker tags determine how they refer to the target.
  // If speaker is the mentor, target is "my student".
  if (roomFigureTags.some((t) => MENTOR_TAGS.includes(t))) {
    bank.push("my student", "the one I taught", "the one I trained");
  }
  // If speaker is the student, target is "my teacher".
  if (roomFigureTags.some((t) => STUDENTISH_TAGS.includes(t))) {
    bank.push("my teacher", "my mentor", "the one who taught me");
  }
  if (roomFigureTags.some((t) => RIVAL_TAGS.includes(t))) {
    bank.push("my rival");
  }
  if (bank.length === 0) {
    bank.push("the one I worked beside", "the person I learned from", "the one I followed", "the one I kept company with");
  }
  return bank[0];
}

// ── v0.4 — relational verbs (target is the subject) ──────────

const RELATIONAL_KIND_VERB: Record<ObjectKind, string[]> = {
  instrument: ["gave me", "taught me on", "left to me", "left me to study"],
  weapon: ["gave me", "asked me to carry", "fought beside me with", "taught me to wield"],
  document: ["wrote for me", "left with me", "asked me to keep", "signed and gave me"],
  garment: ["gave me", "left me", "made for me", "stitched for me"],
  building: ["built", "lived in", "worked in", "prayed in"],
  portrait: ["sat for", "refused to sit for", "painted of", "kept hidden after"],
  letter: ["wrote me", "sent me", "left for me", "dictated to me"],
  jewelry: ["gave me", "wore always", "gave me to wear", "left to me"],
  tool: ["taught me to use", "lent me", "worked beside me with", "showed me how to use"],
  food: ["shared with me", "brought to my table", "taught me to cook", "ate with me"],
  plant: ["grew beside me", "planted for me", "cultivated in the garden", "tended"],
  animal: ["gave me to keep", "trained with me", "kept beside me", "brought home"],
  book: ["made me read", "gave me", "wrote about", "lent me"],
  vessel: ["gave me", "shared with me", "poured for me", "kept beside me"],
  music: ["played for me", "taught me", "composed for", "played when I came in"],
  generic: ["gave me", "left behind", "trusted me with", "set down beside me"],
};

// Relational follows use placeholders for the target's pronouns so they
// can be substituted at composition time. {S} = subject ("she"/"he"/"they"),
// {O} = object ("her"/"him"/"them"), {P} = possessive ("her"/"his"/"their").
const RELATIONAL_KIND_FOLLOW: Record<ObjectKind, string[]> = {
  instrument: [
    "I still don't know all it taught {O}",
    "I never saw it leave {P} side",
    "{S} said it had answers I hadn't earned yet",
    "the work it did outlived {O}",
  ],
  weapon: [
    "until the day {S} fell",
    "before the cause was lost",
    "and I learned what {S} meant",
    "until {S} trusted me with it",
  ],
  document: [
    "and I keep it still",
    "though the words have aged",
    "and reread it when I'm uncertain",
    "which I copied twice in my own hand",
  ],
  garment: [
    "the day I knew I had to follow {O}",
    "and I never forgot the smell of the cloth",
    "and I think of {O} every time I wear it",
    "the day everything changed for me",
  ],
  building: [
    "and worked there until the end",
    "and I was there the night it fell quiet",
    "and the rooms still hold {P} name",
    "and I learned what {S} meant by work",
  ],
  portrait: [
    "and tried to be patient with the painter",
    "and the painter caught something I hadn't yet seen",
    "which {S} kept on the wall facing {P} desk",
    "and I never saw {O} look at it directly",
  ],
  letter: [
    "and I kept it for years before I read it twice",
    "and I answered three days later",
    "which I read aloud to myself the night it arrived",
    "which I carry folded in the same place {S} did",
  ],
  jewelry: [
    "and I never took it off",
    "from the day {S} gave it me",
    "until the day {S} came back for it",
    "which I sleep in still",
  ],
  tool: [
    "and I use it the way {S} showed me",
    "every day, until I could do without watching my hands",
    "until I forgot which of us taught the other",
    "and the work kept its own memory of {O}",
  ],
  food: [
    "and we spoke about everything that mattered",
    "and I never ate so well as at {P} table",
    "which I learned to make from {O}",
    "and I was glad of the company more than the dish",
  ],
  plant: [
    "and watched it grow for years after",
    "and I water it still",
    "and the garden remembers {O}",
    "and I learned what {S} meant by patience",
  ],
  animal: [
    "and it learned to trust me the way it trusted {O}",
    "and I rode beside {O} when I could",
    "and the creature never let me out of sight",
    "and I was the only one who could calm it after {S} left",
  ],
  book: [
    "and I disagreed with half of it then, more later",
    "which I still reach for in the same hour of trouble",
    "and the margins are full of {P} handwriting",
    "and I keep my own copy on the same shelf {S} did",
  ],
  vessel: [
    "and the taste is the same",
    "and I washed it the way {S} showed me",
    "and I broke my own cup trying to pour like {O}",
    "which I keep beside the one I use every day",
  ],
  music: [
    "and the room fell silent when {S} finished",
    "until I could play {P} pieces from memory",
    "and the audience never knew what {S} had shown them",
    "and I played {P} song for years afterward",
  ],
  generic: [
    "and I think of {O} when I see it",
    "and I have not let it go since",
    "and I keep it where {S} would have left it",
    "and I am still learning what {S} meant to teach me",
  ],
};

/** Substitute pronoun placeholders in a relational follow phrase. */
function substituteRelationalFollow(phrase: string, pronoun: Pronoun): string {
  const subj = pronoun;
  const obj = pronoun === "she" ? "her" : pronoun === "he" ? "him" : "them";
  const poss = pronoun === "she" ? "her" : pronoun === "he" ? "his" : "their";
  return phrase
    .replace(/\{S\}/g, subj)
    .replace(/\{O\}/g, obj)
    .replace(/\{P\}/g, poss);
}

/**
  Sweep the rendered quote to replace stray neutral pronouns ("they" /
  "them" / "their") with the target's actual pronoun. Patterns
  occasionally hardcode "they" when they mean the target; this
  normalization rescues those mismatches.
  */
function normalizePronouns(text: string, pronoun: Pronoun): string {
  if (pronoun === "they") return text; // already neutral
  const obj = pronoun === "she" ? "her" : "him";
  const poss = pronoun === "she" ? "her" : "his";
  return text
    .replace(/\bthey\b/gi, pronoun)
    .replace(/\bthem\b/gi, obj)
    .replace(/\btheir\b/gi, poss);
}

// ── v0.4 — relational patterns ────────────────────────────────

const RELATIONAL_PATTERNS: Record<VoiceRole, Array<(slots: RelationalSlots) => string>> = {
  scholar: [
    ({ subj, thing, verb, follow, memEra, place }) =>
      `${capitalize(subj)} ${verb} ${thing}, ${follow}. That was ${memEra}, in ${place}.`,
    ({ subj, thing, verb, follow, memEra, place }) =>
      `${capitalize(subj)} ${verb} ${thing}; ${follow}. I came back to it later, when I could read what they meant.`,
    ({ subj, thing, verb, memEra, place }) =>
      `${capitalize(subj)} ${verb} ${thing} — ${memEra}, in ${place}. The work was the point; the person only showed me where to start.`,
  ],
  warrior: [
    ({ subj, thing, verb, follow, place }) =>
      `${capitalize(subj)} ${verb} ${thing}, ${follow}. ${capitalize(place)} was where I learned what they meant.`,
    ({ subj, thing, verb, follow }) =>
      `${capitalize(subj)} ${verb} ${thing}, ${follow}. I never said it back to them.`,
    ({ subj, thing, verb }) =>
      `${capitalize(subj)} ${verb} ${thing}. That's all there is to say about it.`,
  ],
  artist: [
    ({ subj, thing, verb, follow, place }) =>
      `${capitalize(subj)} ${verb} ${thing}, ${follow}. I worked in ${place} because they had.`,
    ({ subj, thing, verb, follow }) =>
      `${capitalize(subj)} ${verb} ${thing}, ${follow}. The work kept me; they had shown me what the work was for.`,
    ({ subj, thing, verb, memEra, place }) =>
      `${capitalize(subj)} ${verb} ${thing} ${memEra}, in ${place}. I think of them every time I touch the medium.`,
  ],
  ruler: [
    ({ subj, thing, verb, follow, place }) =>
      `${capitalize(subj)} ${verb} ${thing}; ${follow}. ${capitalize(place)} was their office before it was mine.`,
    ({ subj, thing, verb, follow }) =>
      `${capitalize(subj)} ${verb} ${thing}, ${follow}. The office remembers them longer than people do.`,
    ({ subj, thing, verb, place }) =>
      `${capitalize(subj)} ${verb} ${thing} when ${place} was theirs. I learned the room before I learned the work.`,
  ],
  religious: [
    ({ subj, thing, verb, follow, place }) =>
      `${capitalize(subj)} ${verb} ${thing}, ${follow}. The work in ${place} was the vocation before it was mine.`,
    ({ subj, thing, verb, memEra, place }) =>
      `${capitalize(subj)} ${verb} ${thing} ${memEra}, in ${place}. I do not separate the calling from the days they showed me.`,
    ({ subj, thing, verb, follow }) =>
      `${capitalize(subj)} ${verb} ${thing}; ${follow}. The instrument is small; the work they began is not.`,
  ],
  commoner: [
    ({ subj, thing, verb, follow, place }) =>
      `${capitalize(subj)} ${verb} ${thing}, ${follow}. I was nobody from ${place}; they noticed me anyway.`,
    ({ subj, thing, verb, memEra, place }) =>
      `${capitalize(subj)} ${verb} ${thing} ${memEra}, in ${place}. I didn't know it would be the work of my life.`,
    ({ subj, thing, verb, follow }) =>
      `${capitalize(subj)} ${verb} ${thing}, ${follow}. That was my life. I made it from what they left me.`,
  ],
  explorer: [
    ({ subj, thing, verb, follow, place }) =>
      `${capitalize(subj)} ${verb} ${thing} when ${place} was still unknown to us. ${capitalize(follow.charAt(0))}${follow.slice(1)}.`,
    ({ subj, thing, verb, memEra, place }) =>
      `${capitalize(subj)} ${verb} ${thing} ${memEra}. ${capitalize(place)} was the destination; ${thing} was the proof they had been there.`,
    ({ subj, thing, verb, follow, place }) =>
      `${capitalize(subj)} ${verb} ${thing}, ${follow}. The map of ${place} was their real work; everything else was the journey.`,
  ],
  writer: [
    ({ subj, thing, verb, follow, place }) =>
      `${capitalize(subj)} ${verb} ${thing}, ${follow}. I kept the desk in ${place}; they had kept it before me.`,
    ({ subj, thing, verb, memEra, place }) =>
      `${capitalize(subj)} ${verb} ${thing} ${memEra}, in ${place}. The page was the only honest thing in the house when they were alive.`,
    ({ subj, thing, verb, follow }) =>
      `${capitalize(subj)} ${verb} ${thing}, ${follow}. Readers will make of it what they made of them.`,
  ],
};

interface RelationalSlots {
  subj: Pronoun;       // "she" / "he" / "they"
  thing: string;       // kind-specific noun
  verb: string;        // relational verb phrase
  follow: string;      // relational follow
  memEra: string;
  place: string;
}

export function quoteForClue(input: FigureVoiceInput): string {
  const { figure, scene, clue, targetFigure } = input;
  const role = pickRole(figure.tags);
  const objectKind = pickObjectKind(clue.label);
  const eraBucket = bucketEra(figure.era || scene.era);
  const place = pickPlaceRef(figure.region, scene.location);
  const memEra = pick(MEM_PHRASES[eraBucket]);
  const thing = pick(KIND_NOUN[objectKind]);

  // v0.4 — relational mode when a targetFigure is supplied AND it's
  // different from the speaking figure. Otherwise, self-voice mode
  // (v0.3 behavior).
  const isRelational =
    !!targetFigure &&
    targetFigure.canonicalName.trim().toLowerCase() !== figure.canonicalName.trim().toLowerCase();

  const patterns = isRelational ? RELATIONAL_PATTERNS[role] : PATTERNS[role];
  const hash = simpleHash(clue.label);
  const pattern = patterns[hash % patterns.length];

  if (isRelational) {
    const pronoun = pickPronoun(targetFigure!.canonicalName);
    const verb = pick(RELATIONAL_KIND_VERB[objectKind]);
    const followRaw = pick(RELATIONAL_KIND_FOLLOW[objectKind]);
    const follow = substituteRelationalFollow(followRaw, pronoun);
    const quote = pattern({
      subj: pronoun,
      thing,
      verb,
      follow,
      memEra,
      place,
    });
    return normalizePronouns(quote.trim(), pronoun);
  }

  const relation = pick(KIND_RELATION[objectKind]);
  const follow = pick(KIND_FOLLOW[objectKind]);
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