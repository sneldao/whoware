// Tests for the pure game core (bundle/game.js).
//
//   bun test anna/whoware/tools/game.test.js
//
// The streak rules are the point. An earlier revision kept `streak` inside
// the per-day run record, so every new episode reset it to zero — the daily
// ritual silently had no memory. These tests pin the two-key split.

import { describe, expect, test } from "bun:test";
import {
  applySolve,
  defaultProfile,
  detectiveGrade,
  evaluateGuess,
  recordMiss,
  runSummary,
  scoreCeiling,
  streakSummary,
  HISTORY_CAP,
} from "../bundle/game.js";

const episode = (day, over = {}) => ({
  episodeDay: day,
  scenes: [
    { title: "A", clues: [{}, {}] },
    { title: "B", clues: [{}, {}] },
  ],
  tuning: { guessLimit: 5, hintLimit: 2 },
  witnessChamber: true,
  roomFigure: { canonicalName: "Winston Churchill" },
  target: {
    canonicalName: "Alan Turing",
    aliases: ["Turing"],
    era: "20th century",
    region: "Britain",
  },
  targetSummary: "…",
  ...over,
});

const run = (over = {}) => ({
  sceneIndex: 0,
  guessesLeft: 5,
  hintsLeft: 2,
  cluesFound: [],
  guesses: [],
  score: 0,
  solved: false,
  exhausted: false,
  ...over,
});

describe("scoreCeiling", () => {
  test("a pristine short-mode run scores the full 1000", () => {
    expect(scoreCeiling(episode(1), run())).toBe(1000);
  });

  test("mercy is not charged unless a mercy scene was taken", () => {
    const ep = episode(1);
    ep.scenes[1].isMercy = true;
    expect(scoreCeiling(ep, run({ sceneIndex: 0 }))).toBe(1000);
    expect(scoreCeiling(ep, run({ sceneIndex: 1 }))).toBe(700);
  });

  test("clues, hints and wrong guesses each bleed the ceiling", () => {
    const base = scoreCeiling(episode(1), run());
    expect(scoreCeiling(episode(1), run({ cluesFound: [1, 2] }))).toBe(base - 80);
    expect(scoreCeiling(episode(1), run({ hintsLeft: 1 }))).toBe(base - 120);
    expect(scoreCeiling(episode(1), run({ guessesLeft: 4 }))).toBe(base - 80);
  });

  test("floors at zero when penalties exceed the base", () => {
    const ep = episode(1);
    ep.tuning.guessLimit = 12;
    const s = run({ cluesFound: [1, 2, 3, 4], hintsLeft: 0, guessesLeft: 0 });
    expect(scoreCeiling(ep, s)).toBe(0);
  });
});

describe("detectiveGrade", () => {
  test("thresholds are reachable", () => {
    expect(detectiveGrade(1000)).toBe("archivist");
    expect(detectiveGrade(800)).toBe("archivist");
    expect(detectiveGrade(700)).toBe("curator");
    expect(detectiveGrade(500)).toBe("investigator");
    expect(detectiveGrade(0)).toBe("witness");
  });
});

describe("evaluateGuess", () => {
  const ep = episode(1);

  test("accepts the canonical name and aliases, case- and space-insensitive", () => {
    expect(evaluateGuess("Alan Turing", ep).correct).toBe(true);
    expect(evaluateGuess("turing", ep).correct).toBe(true);
    expect(evaluateGuess("  ALAN   TURING ", ep).correct).toBe(true);
  });

  test("a near-miss on the name gets proximity prose, not a rejection", () => {
    const r = evaluateGuess("Alan", ep);
    expect(r.correct).toBe(false);
    expect(r.proximity).toBe("same_region");
    expect(r.prose.length).toBeGreaterThan(0);
  });

  test("era and region hits get their own proximity", () => {
    expect(evaluateGuess("20th century", ep).proximity).toBe("same_era");
    expect(evaluateGuess("Britain", ep).proximity).toBe("same_region");
  });

  test("an unrelated name is simply off", () => {
    const r = evaluateGuess("Napoleon Bonaparte", ep);
    expect(r.correct).toBe(false);
    expect(r.proximity).toBe("off");
  });

  test("empty input is handled without throwing", () => {
    expect(evaluateGuess("", ep).correct).toBe(false);
    expect(evaluateGuess("   ", ep).correct).toBe(false);
    expect(evaluateGuess(null, ep).correct).toBe(false);
  });
});

describe("streak", () => {
  test("first solve starts at 1", () => {
    const p = applySolve(defaultProfile(), episode(100), 900);
    expect(p.streak).toBe(1);
    expect(p.lastSolvedDay).toBe(100);
    expect(p.best).toBe(1);
  });

  test("consecutive days extend the streak", () => {
    let p = defaultProfile();
    p = applySolve(p, episode(100), 900);
    p = applySolve(p, episode(101), 900);
    p = applySolve(p, episode(102), 900);
    expect(p.streak).toBe(3);
    expect(p.best).toBe(3);
  });

  test("a gap of one day is absorbed by the freeze", () => {
    let p = defaultProfile();
    p = applySolve(p, episode(100), 900);
    p = applySolve(p, episode(102), 900); // day 101 skipped
    expect(p.streak).toBe(2);
    expect(p.freezes).toBe(0);
  });

  test("a second gap breaks the streak once freezes are spent", () => {
    let p = defaultProfile();
    p = applySolve(p, episode(100), 900);
    p = applySolve(p, episode(102), 900); // consumes the freeze
    p = applySolve(p, episode(104), 900); // no freeze left
    expect(p.streak).toBe(1);
    expect(p.best).toBe(2); // best is never lost
  });

  test("re-solving the same day does not double-count", () => {
    let p = defaultProfile();
    p = applySolve(p, episode(100), 900);
    p = applySolve(p, episode(100), 900);
    expect(p.streak).toBe(1);
  });

  test("out-of-order backfill does not corrupt the chain", () => {
    let p = defaultProfile();
    p = applySolve(p, episode(100), 900);
    p = applySolve(p, episode(101), 900);
    p = applySolve(p, episode(100), 900); // replay an older day
    expect(p.streak).toBe(2);
    expect(p.lastSolvedDay).toBe(101);
  });

  test("history is capped so APS quota cannot run away", () => {
    let p = defaultProfile();
    for (let d = 1000; d < 1000 + HISTORY_CAP + 25; d++) p = applySolve(p, episode(d), 900);
    expect(Object.keys(p.history).length).toBe(HISTORY_CAP);
    // oldest entries dropped, newest kept
    expect(p.history[String(1000 + HISTORY_CAP + 24)]).toBeDefined();
    expect(p.history["1000"]).toBeUndefined();
  });

  test("a miss is recorded without touching the streak", () => {
    let p = defaultProfile();
    p = applySolve(p, episode(100), 900);
    p = recordMiss(p, episode(101));
    expect(p.streak).toBe(1);
    expect(p.history["101"]).toEqual({ solved: false, score: 0, grade: null });
    expect(p.history["100"].solved).toBe(true);
  });

  test("applySolve does not mutate the input profile", () => {
    const p = defaultProfile();
    applySolve(p, episode(100), 900);
    expect(p.streak).toBe(0);
    expect(p.history).toEqual({});
  });
});

describe("summaries", () => {
  test("streakSummary reports freeze reserve on a miss", () => {
    const p = { streak: 3, best: 5, freezes: 1, history: {}, lastSolvedDay: 1 };
    expect(streakSummary(p, true)).toContain("freeze is in reserve");
    expect(streakSummary({ ...p, freezes: 0 }, true)).toContain("no freeze");
  });

  test("streakSummary pluralises", () => {
    expect(streakSummary({ streak: 1, best: 1, freezes: 0, history: {} })).toContain("1 day ·");
    expect(streakSummary({ streak: 2, best: 2, freezes: 0, history: {} })).toContain("2 days ·");
  });

  test("runSummary states the outcome for the assistant", () => {
    const ep = episode(100);
    const s = run({ solved: true, score: 840, guesses: [{ text: "Alan Turing" }] });
    const p = applySolve(defaultProfile(), ep, 840);
    const out = runSummary(p, s, ep);
    expect(out).toContain("solved as Alan Turing");
    expect(out).toContain("archivist");
    expect(out).toContain("Streak 1");
    expect(out).toContain("1/5");
  });

  test("runSummary reports a miss without leaking the answer as solved", () => {
    const ep = episode(100);
    const out = runSummary(defaultProfile(), run({ exhausted: true }), ep);
    expect(out).toContain("did not solve");
  });
});