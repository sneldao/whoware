import { describe, expect, it } from "vitest";
import {
  BASE_SCORE,
  GUESS_PENALTY,
  HINT_PENALTY,
  HOTSPOT_PENALTY,
  MEMORY_PENALTY,
  TIME_BUCKET_MS,
  TIME_BUCKET_PENALTY,
  computeScore,
} from "../../../packages/backend/convex/scoring";
import { gradeForScore, projectScore } from "./score-projection";

const T0 = 1_700_000_000_000;

function serverScore(args: {
  memoriesViewed: number;
  hotspotsOpened: number;
  hintsUsed: number;
  /** Total guesses including the final correct one. */
  guessesUsed: number;
  elapsedMs: number;
}): number {
  return computeScore(args);
}

describe("projectScore — mirrors the server", () => {
  it("a fresh run projects a full ceiling", () => {
    const projected = projectScore({
      memoriesViewed: 1, // entering scene 0 is always counted
      hotspotsOpened: 0,
      hintsUsed: 0,
      wrongGuesses: 0,
      startedAt: T0,
      now: T0,
    });
    expect(projected).toBe(BASE_SCORE - MEMORY_PENALTY);
  });

  it("matches computeScore for a mid-game instant", () => {
    const state = { memoriesViewed: 3, hotspotsOpened: 4, hintsUsed: 2, wrongGuesses: 1 };
    const elapsedMs = 7 * TIME_BUCKET_MS + 123;
    const projected = projectScore({ ...state, startedAt: T0, now: T0 + elapsedMs });
    const server = serverScore({ ...state, guessesUsed: state.wrongGuesses + 1, elapsedMs });
    expect(projected).toBe(server);
  });

  it("matches computeScore at the moment of a 5th-slot solve", () => {
    const state = { memoriesViewed: 5, hotspotsOpened: 9, hintsUsed: 3, wrongGuesses: 4 };
    const elapsedMs = 31 * 60_000;
    const projected = projectScore({ ...state, startedAt: T0, now: T0 + elapsedMs });
    const server = serverScore({ ...state, guessesUsed: 5, elapsedMs });
    expect(projected).toBe(server);
  });

  it("ticks down exactly TIME_BUCKET_PENALTY per bucket boundary", () => {
    const base = { memoriesViewed: 1, hotspotsOpened: 0, hintsUsed: 0, wrongGuesses: 0, startedAt: T0 };
    const before = projectScore({ ...base, now: T0 + TIME_BUCKET_MS - 1 });
    const after = projectScore({ ...base, now: T0 + TIME_BUCKET_MS });
    expect(before - after).toBe(TIME_BUCKET_PENALTY);
  });

  it("each wrong accusation costs GUESS_PENALTY", () => {
    const base = { memoriesViewed: 1, hotspotsOpened: 0, hintsUsed: 0, startedAt: T0, now: T0 };
    const zero = projectScore({ ...base, wrongGuesses: 0 });
    const two = projectScore({ ...base, wrongGuesses: 2 });
    expect(zero - two).toBe(2 * GUESS_PENALTY);
  });

  it("an identity nudge (2 hint units) costs double a whisper", () => {
    const base = { memoriesViewed: 1, hotspotsOpened: 0, wrongGuesses: 0, startedAt: T0, now: T0 };
    const whisper = projectScore({ ...base, hintsUsed: 1 });
    const nudge = projectScore({ ...base, hintsUsed: 2 });
    expect(whisper - nudge).toBe(HINT_PENALTY);
  });

  it("never drops below zero", () => {
    const floor = projectScore({
      memoriesViewed: 99,
      hotspotsOpened: 99,
      hintsUsed: 99,
      wrongGuesses: 99,
      startedAt: T0,
      now: T0 + 999 * 60_000,
    });
    expect(floor).toBe(0);
  });

  it("ignores clock skew (now before startedAt)", () => {
    const projected = projectScore({
      memoriesViewed: 1, hotspotsOpened: 0, hintsUsed: 0, wrongGuesses: 0,
      startedAt: T0, now: T0 - 60_000,
    });
    expect(projected).toBe(BASE_SCORE - MEMORY_PENALTY);
  });
});

describe("gradeForScore", () => {
  it("grades the full range without gaps", () => {
    expect(gradeForScore(10_000).grade).toBe("S");
    expect(gradeForScore(8_500).grade).toBe("S");
    expect(gradeForScore(8_499).grade).toBe("A");
    expect(gradeForScore(7_000).grade).toBe("A");
    expect(gradeForScore(5_500).grade).toBe("B");
    expect(gradeForScore(4_000).grade).toBe("C");
    expect(gradeForScore(3_999).grade).toBe("D");
    expect(gradeForScore(0).grade).toBe("D");
  });

  it("every grade carries a title and blurb for the result surface", () => {
    for (const score of [9_000, 7_500, 6_000, 4_500, 1_000]) {
      const info = gradeForScore(score);
      expect(info.title.length).toBeGreaterThan(0);
      expect(info.blurb.length).toBeGreaterThan(0);
    }
  });
});
