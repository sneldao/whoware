/**
 * Live score projection — the client-side mirror of the server's
 * `computeScore` (packages/backend/convex/scoring.ts).
 *
 * The server only materializes a score when a run is *solved*. During play
 * the HUD therefore showed "—", which hid the game's central tension:
 * every memory, clue, hint, and wrong accusation lowers the ceiling.
 *
 * `projectScore` answers "if I named them correctly right now, what would
 * I score?" — same inputs, same constants, so the number the player
 * watches bleed is exactly the number the server will compute on solve.
 */

// Relative import (not the @/convex alias) so the root vitest runner can
// resolve this module too — same convention as lib/scoring-tooltip.test.ts.
import {
  BASE_SCORE,
  GUESS_PENALTY,
  HINT_PENALTY,
  HOTSPOT_PENALTY,
  MEMORY_PENALTY,
  TIME_BUCKET_MS,
  TIME_BUCKET_PENALTY,
} from "../../../packages/backend/convex/scoring";

export interface ScoreProjectionInput {
  memoriesViewed: number;
  hotspotsOpened: number;
  /** Hint units — scene whisper = 1, identity nudge = 2 (mirrors runs.useHint). */
  hintsUsed: number;
  /** Guesses spent so far, all wrong (a correct guess ends the run). */
  wrongGuesses: number;
  /** run.startedAt — the clock the server's elapsedMs measures from. */
  startedAt: number;
  /** Current time in ms. */
  now: number;
}

/**
 * Score the player would receive for a correct accusation *this instant*.
 * Equivalent to computeScore with guessesUsed = wrongGuesses + 1 (the
 * hypothetical solving guess is free, exactly as on the server).
 */
export function projectScore(input: ScoreProjectionInput): number {
  const elapsedMs = Math.max(0, input.now - input.startedAt);
  const timePenalty = Math.floor(elapsedMs / TIME_BUCKET_MS) * TIME_BUCKET_PENALTY;
  const raw =
    BASE_SCORE -
    input.memoriesViewed * MEMORY_PENALTY -
    input.hotspotsOpened * HOTSPOT_PENALTY -
    input.hintsUsed * HINT_PENALTY -
    input.wrongGuesses * GUESS_PENALTY -
    timePenalty;
  return Math.max(0, raw);
}

/* ── Detective grade ──────────────────────────────────────────────── */

export type DetectiveGrade = "S" | "A" | "B" | "C" | "D";

export interface GradeInfo {
  grade: DetectiveGrade;
  /** Case-file rank title, e.g. "Master Detective". */
  title: string;
  /** One-line flavor for the result surface. */
  blurb: string;
}

/**
 * Grade a final score as a shareable rank. Thresholds are tuned against
 * the scoring constants: an unassisted instant solve is ~9,900; opening
 * every memory and several clues lands mid-B; brute force floors at D.
 */
export function gradeForScore(score: number): GradeInfo {
  if (score >= 8_500) {
    return { grade: "S", title: "Master Detective", blurb: "Near-total restraint. The room barely had to speak." };
  }
  if (score >= 7_000) {
    return { grade: "A", title: "Sharp Investigator", blurb: "Few memories, fewer doubts. Clean work." };
  }
  if (score >= 5_500) {
    return { grade: "B", title: "Case Cracker", blurb: "A steady narrowing of the circle." };
  }
  if (score >= 4_000) {
    return { grade: "C", title: "Truth Seeker", blurb: "The room gave up its name, eventually." };
  }
  return { grade: "D", title: "History's Apprentice", blurb: "Solved by persistence. Tomorrow, by instinct." };
}

/** Accent color per grade, for badges and share cards. */
export const GRADE_COLORS: Record<DetectiveGrade, string> = {
  S: "#FBBF24",
  A: "#86EFAC",
  B: "#93C5FD",
  C: "#C4B5FD",
  D: "#94A3B8",
};
