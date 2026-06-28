import { describe, expect, it } from "vitest";
import {
  BASE_SCORE,
  GUESS_PENALTY,
  HOTSPOT_PENALTY,
  MAX_GUESSES_PER_RUN,
  MEMORY_PENALTY,
  TIME_BUCKET_MS,
  TIME_BUCKET_PENALTY,
  computeScore,
} from "../../../packages/backend/convex/scoring";

/**
 * The scoring tooltip is rendered from these constants — this test
 * pins the values so a future rename or refactor can't silently
 * make the player-facing copy drift from the actual scoring code.
 */
describe("scoring constants — player-facing contract", () => {
  it("base score is 10,000 points", () => {
    expect(BASE_SCORE).toBe(10_000);
  });

  it("memory penalty is 1,200 points", () => {
    expect(MEMORY_PENALTY).toBe(1200);
  });

  it("hotspot penalty is 250 points", () => {
    expect(HOTSPOT_PENALTY).toBe(250);
  });

  it("wrong-guess penalty is 600 points", () => {
    expect(GUESS_PENALTY).toBe(600);
  });

  it("time bucket is 10 seconds", () => {
    expect(TIME_BUCKET_MS).toBe(10_000);
  });

  it("time penalty is 10 points per 10-second bucket", () => {
    expect(TIME_BUCKET_PENALTY).toBe(10);
  });

  it("max guesses per run is 5", () => {
    expect(MAX_GUESSES_PER_RUN).toBe(5);
  });
});

describe("computeScore", () => {
  it("returns the base score for an untouched, instant solve", () => {
    expect(computeScore({ memoriesViewed: 0, hotspotsOpened: 0, guessesUsed: 1, elapsedMs: 0 })).toBe(10_000);
  });

  it("subtracts per-memory, per-hotspot, per-wrong-guess, and per-time-bucket penalties", () => {
    // 2 memories * 1200 + 3 hotspots * 250 + (3-1) * 600 wrong-guesses + 30s = 3 buckets
    // 10_000 - 2400 - 750 - 1200 - 30 = 5_620
    const score = computeScore({ memoriesViewed: 2, hotspotsOpened: 3, guessesUsed: 3, elapsedMs: 30_000 });
    expect(score).toBe(10_000 - 2_400 - 750 - 1_200 - 30);
  });

  it("floors the result at zero (no negative scores)", () => {
    const score = computeScore({ memoriesViewed: 50, hotspotsOpened: 50, guessesUsed: 5, elapsedMs: 600_000 });
    expect(score).toBe(0);
  });

  it("does not penalize the first guess (only guesses 2+ cost)", () => {
    // Same elapsed and one guess, two paths differ only in guessesUsed.
    const base = computeScore({ memoriesViewed: 0, hotspotsOpened: 0, guessesUsed: 1, elapsedMs: 0 });
    const second = computeScore({ memoriesViewed: 0, hotspotsOpened: 0, guessesUsed: 2, elapsedMs: 0 });
    expect(base - second).toBe(GUESS_PENALTY);
  });
});
