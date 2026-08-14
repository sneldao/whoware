export const BASE_SCORE = 10_000;
export const MEMORY_PENALTY = 1200;
export const HOTSPOT_PENALTY = 250;
export const HINT_PENALTY = 150;
/** Identity nudges cost double a scene hint — they narrow the figure directly. */
export const IDENTITY_HINT_PENALTY = HINT_PENALTY * 2;
export const GUESS_PENALTY = 600;
export const TIME_BUCKET_MS = 30_000;
export const TIME_BUCKET_PENALTY = 5;
export const MAX_GUESSES_PER_RUN = 5;

export interface ScoringInput {
  memoriesViewed: number;
  hotspotsOpened: number;
  hintsUsed: number;
  guessesUsed: number;
  elapsedMs: number;
}

export function computeScore(input: ScoringInput): number {
  const timePenalty = Math.floor(input.elapsedMs / TIME_BUCKET_MS) * TIME_BUCKET_PENALTY;
  const raw =
    BASE_SCORE -
    input.memoriesViewed * MEMORY_PENALTY -
    input.hotspotsOpened * HOTSPOT_PENALTY -
    input.hintsUsed * HINT_PENALTY -
    (input.guessesUsed - 1) * GUESS_PENALTY -
    timePenalty;
  return Math.max(0, raw);
}

export interface RankableEntry {
  score: number;
  scenesRevealed: number;
  hotspotsOpened: number;
  guessesUsed: number;
  elapsedMs: number;
  guessedAt: number;
}

export function compareRankedEntries<L extends RankableEntry, R extends RankableEntry>(left: L, right: R): number {
  return (
    right.score - left.score ||
    left.scenesRevealed - right.scenesRevealed ||
    left.hotspotsOpened - right.hotspotsOpened ||
    left.guessesUsed - right.guessesUsed ||
    left.elapsedMs - right.elapsedMs ||
    left.guessedAt - right.guessedAt
  );
}

export function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(Math.floor(value), min), max);
}

/* ── Guess proximity ──────────────────────────────────────────────── */

export type GuessProximity =
  | "correct"
  | "same_era"
  | "same_region"
  | "same_era_and_region"
  | "same_century"
  | "off";

export interface ProximityInput {
  guessed: { era: string; region: string; tags: string[] };
  correct: { era: string; region: string; tags: string[] };
}

/**
 * Compare the guessed figure against the correct one and return a
 * proximity tier. Tiers are ordered from most-specific to least:
 *
 * 1. correct        — exact match
 * 2. same_era_and_region — right era AND right region (a contemporary)
 * 3. same_era       — right era, wrong region
 * 4. same_region    — right region, wrong era
 * 5. same_century   — neither era nor region match, but the century overlaps
 * 6. off            — completely different
 */
export interface DetailedProximity {
  proximity: GuessProximity;
  eraMatch: boolean;
  regionMatch: boolean;
  fieldMatch: boolean;
  sameCentury: boolean;
  message: string;
}

export function computeDetailedProximity(input: ProximityInput, guessedName: string): DetailedProximity {
  const sameEra = erasOverlap(input.guessed.era, input.correct.era);
  const sameRegion = regionsOverlap(input.guessed.region, input.correct.region);
  const sameField = fieldsOverlap(input.guessed.tags, input.correct.tags);

  const guessCenturies = extractCenturies(input.guessed.era);
  const correctCenturies = extractCenturies(input.correct.era);
  const sameCentury = guessCenturies.length > 0 && correctCenturies.length > 0 &&
    guessCenturies.some((gc) => correctCenturies.some((cc) => Math.abs(gc - cc) <= 1));

  let proximity: GuessProximity = "off";
  if (sameEra && sameRegion) proximity = "same_era_and_region";
  else if (sameEra) proximity = "same_era";
  else if (sameRegion) proximity = "same_region";
  else if (sameCentury) proximity = "same_century";

  const message = proximityMessage(proximity, guessedName);

  return {
    proximity,
    eraMatch: sameEra,
    regionMatch: sameRegion,
    fieldMatch: sameField,
    sameCentury,
    message,
  };
}

/**
 * Tier-only proximity. Delegates to computeDetailedProximity so the
 * tier and the Era/Region/Field booleans can never diverge.
 */
export function computeProximity(input: ProximityInput): GuessProximity {
  return computeDetailedProximity(input, "").proximity;
}

function fieldsOverlap(aTags: string[], bTags: string[]): boolean {
  if (!aTags || !bTags || aTags.length === 0 || bTags.length === 0) return false;
  const aSet = new Set(aTags.map((t) => t.toLowerCase().trim()));
  return bTags.some((t) => aSet.has(t.toLowerCase().trim()));
}

/** Human-readable message for each proximity tier. */
export function proximityMessage(proximity: GuessProximity, guessedName: string): string {
  switch (proximity) {
    case "correct":
      return `${guessedName} — identity anchored.`;
    case "same_era_and_region":
      return `${guessedName} is a contemporary — right era and region, but not the one who changed history from this room.`;
    case "same_era":
      return `${guessedName} lived in the right era, but in a different part of the world.`;
    case "same_region":
      return `${guessedName} is from the right region, but the wrong time.`;
    case "same_century":
      return `${guessedName} lived around the same century — close, but not the one.`;
    case "off":
      return `${guessedName} is not the one. The room holds a different memory.`;
  }
}

// ── Era / region helpers ───────────────────────────────────────────

/** Extract century numbers from era strings like "15th century", "19th–20th century", "1st century BCE". */
function extractCenturies(era: string): number[] {
  const matches = [...era.matchAll(/(\d{1,2})(?:st|nd|rd|th)?\s*(?:century|c\.?\s)/gi)];
  const centuries: number[] = [];
  for (const m of matches) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n)) centuries.push(n);
  }
  return centuries;
}

/** Check if two era strings refer to overlapping time periods. */
function erasOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  // Check for shared era keywords (renaissance, medieval, modern, etc.)
  const eraKeywords = [
    "renaissance", "medieval", "ancient", "modern", "colonial",
    "victorian", "edwardian", "industrial", "enlightenment",
    "romantic", "baroque", "classical", "hellenistic",
  ];
  for (const keyword of eraKeywords) {
    if (aLower.includes(keyword) && bLower.includes(keyword)) return true;
  }

  // Check for shared century
  const aCenturies = extractCenturies(a);
  const bCenturies = extractCenturies(b);
  if (aCenturies.length > 0 && bCenturies.length > 0) {
    if (aCenturies.some((ac) => bCenturies.some((bc) => Math.abs(ac - bc) <= 1))) {
      return true;
    }
  }

  return false;
}

/** Check if two region strings refer to overlapping areas. */
function regionsOverlap(a: string, b: string): boolean {
  if (a === b) return true;
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  // Handle compound regions like "Germany / USA" or "Poland / France"
  const aParts = aLower.split(/[/,]/).map((s) => s.trim()).filter(Boolean);
  const bParts = bLower.split(/[/,]/).map((s) => s.trim()).filter(Boolean);

  for (const ap of aParts) {
    for (const bp of bParts) {
      if (ap === bp) return true;
      if (ap.includes(bp) || bp.includes(ap)) return true;
      // Partial match for common short forms
      if (ap.length >= 3 && bp.length >= 3 && (ap.includes(bp.slice(0, 4)) || bp.includes(ap.slice(0, 4)))) {
        return true;
      }
    }
  }

  return false;
}
