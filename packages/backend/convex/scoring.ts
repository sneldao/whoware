export const BASE_SCORE = 10_000;
export const MEMORY_PENALTY = 1200;
export const HOTSPOT_PENALTY = 250;
export const GUESS_PENALTY = 600;
export const TIME_BUCKET_MS = 10_000;
export const TIME_BUCKET_PENALTY = 10;
export const MAX_GUESSES_PER_RUN = 5;

export interface ScoringInput {
  memoriesViewed: number;
  hotspotsOpened: number;
  guessesUsed: number;
  elapsedMs: number;
}

export function computeScore(input: ScoringInput): number {
  const timePenalty = Math.floor(input.elapsedMs / TIME_BUCKET_MS) * TIME_BUCKET_PENALTY;
  const raw =
    BASE_SCORE -
    input.memoriesViewed * MEMORY_PENALTY -
    input.hotspotsOpened * HOTSPOT_PENALTY -
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
