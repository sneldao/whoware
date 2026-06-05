import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

function setup() {
  return convexTest(schema, modules);
}

describe("analytics.getGlobalStats", () => {
  test("returns zeroes when no data exists", async () => {
    const t = setup();
    const stats = await t.query(api.analytics.getGlobalStats, {});
    expect(stats.totalSolves).toBe(0);
    expect(stats.totalRuns).toBe(0);
    expect(stats.uniqueSolvers).toBe(0);
    expect(stats.averageScore).toBe(0);
    expect(stats.totalMints).toBe(0);
    expect(stats.totalArchiveUnlocks).toBe(0);
    expect(stats.episodeCount).toBe(0);
  });

  test("counts solves, runs, mints, and unique solvers correctly", async () => {
    const t = setup();
    await t.run(async (ctx) => {
      const epId = await ctx.db.insert("episodes", {
        slug: "ep-analytics-1",
        activeAt: Date.now(),
        dropsAt: Date.now(),
        status: "live",
        difficulty: "iconic",
        scenes: [],
      });

      await ctx.db.insert("guesses", {
        episodeId: epId,
        identityId: "player-a",
        playerName: "Alice",
        guess: "Churchill",
        isCorrect: true,
        scenesRevealed: 2,
        score: 2000,
        guessedAt: Date.now() - 3600000,
      });
      await ctx.db.insert("guesses", {
        episodeId: epId,
        identityId: "player-b",
        playerName: "Bob",
        guess: "Churchill",
        isCorrect: true,
        scenesRevealed: 3,
        score: 1500,
        guessedAt: Date.now() - 1800000,
      });
      await ctx.db.insert("guesses", {
        episodeId: epId,
        identityId: "player-c",
        playerName: "Charlie",
        guess: "Napoleon",
        isCorrect: false,
        scenesRevealed: 5,
        guessedAt: Date.now() - 900000,
      });

      await ctx.db.insert("playerRuns", {
        episodeId: epId,
        identityId: "player-a",
        playerName: "Alice",
        status: "solved",
        startedAt: Date.now() - 7200000,
        solvedAt: Date.now() - 3600000,
        currentSceneIndex: 2,
        memoriesViewed: 2,
        hotspotsOpened: 3,
        guessesUsed: 1,
        mintTxHash: "0xabc123",
      });
      await ctx.db.insert("playerRuns", {
        episodeId: epId,
        identityId: "player-b",
        playerName: "Bob",
        status: "solved",
        startedAt: Date.now() - 5400000,
        solvedAt: Date.now() - 1800000,
        currentSceneIndex: 3,
        memoriesViewed: 3,
        hotspotsOpened: 4,
        guessesUsed: 2,
      });
    });

    const stats = await t.query(api.analytics.getGlobalStats, {});
    expect(stats.totalSolves).toBe(2);
    expect(stats.totalRuns).toBe(2);
    expect(stats.uniqueSolvers).toBe(2);
    expect(stats.averageScore).toBe(1750);
    expect(stats.totalMints).toBe(1);
    expect(stats.episodeCount).toBe(1);
  });
});

describe("analytics.getStreakLeaderboard", () => {
  test("returns empty array when no solves exist", async () => {
    const t = setup();
    const result = await t.query(api.analytics.getStreakLeaderboard, {});
    expect(result).toEqual([]);
  });

  test("ranks players by total solves then best score", async () => {
    const t = setup();
    await t.run(async (ctx) => {
      const ep1 = await ctx.db.insert("episodes", {
        slug: "ep-lb-1",
        activeAt: Date.now(),
        dropsAt: Date.now(),
        status: "closed",
        difficulty: "iconic",
        scenes: [],
      });
      const ep2 = await ctx.db.insert("episodes", {
        slug: "ep-lb-2",
        activeAt: Date.now(),
        dropsAt: Date.now(),
        status: "closed",
        difficulty: "field",
        scenes: [],
      });

      await ctx.db.insert("guesses", {
        episodeId: ep1,
        identityId: "alice",
        playerName: "Alice",
        guess: "Churchill",
        isCorrect: true,
        scenesRevealed: 2,
        score: 2000,
        guessedAt: Date.now() - 86400000,
      });
      await ctx.db.insert("guesses", {
        episodeId: ep2,
        identityId: "alice",
        playerName: "Alice",
        guess: "Roosevelt",
        isCorrect: true,
        scenesRevealed: 3,
        score: 1800,
        guessedAt: Date.now(),
      });
      await ctx.db.insert("guesses", {
        episodeId: ep1,
        identityId: "bob",
        playerName: "Bob",
        guess: "Churchill",
        isCorrect: true,
        scenesRevealed: 4,
        score: 1500,
        guessedAt: Date.now() - 86400000,
      });
    });

    const result = await t.query(api.analytics.getStreakLeaderboard, {});
    expect(result.length).toBe(2);
    expect(result[0]?.playerName).toBe("Alice");
    expect(result[0]?.totalSolves).toBe(2);
    expect(result[0]?.bestScore).toBe(2000);
    expect(result[1]?.playerName).toBe("Bob");
    expect(result[1]?.totalSolves).toBe(1);
  });
});

describe("analytics.getRecentSolves", () => {
  test("returns empty array when no solves exist", async () => {
    const t = setup();
    const result = await t.query(api.analytics.getRecentSolves, {});
    expect(result).toEqual([]);
  });

  test("returns recent correct guesses sorted by time", async () => {
    const t = setup();
    const now = Date.now();
    await t.run(async (ctx) => {
      const epId = await ctx.db.insert("episodes", {
        slug: "ep-recent",
        activeAt: now,
        dropsAt: now,
        status: "live",
        difficulty: "iconic",
        scenes: [],
      });

      await ctx.db.insert("guesses", {
        episodeId: epId,
        identityId: "p1",
        playerName: "First",
        guess: "Churchill",
        isCorrect: true,
        scenesRevealed: 3,
        score: 1500,
        guessedAt: now - 7200000,
      });
      await ctx.db.insert("guesses", {
        episodeId: epId,
        identityId: "p2",
        playerName: "Second",
        guess: "Churchill",
        isCorrect: true,
        scenesRevealed: 2,
        score: 2000,
        guessedAt: now - 3600000,
      });
      await ctx.db.insert("guesses", {
        episodeId: epId,
        identityId: "p3",
        playerName: "Wrong",
        guess: "Napoleon",
        isCorrect: false,
        scenesRevealed: 5,
        guessedAt: now - 1800000,
      });
    });

    const result = await t.query(api.analytics.getRecentSolves, {});
    expect(result.length).toBe(2);
    expect(result[0]?.playerName).toBe("Second");
    expect(result[1]?.playerName).toBe("First");
  });
});
