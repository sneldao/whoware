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

describe("analytics.getTodaysRoomStats", () => {
  test("returns null for non-existent episode", async () => {
    const t = setup();
    // Create a valid episode ID format then delete it
    const epId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("episodes", {
        slug: "temp",
        activeAt: Date.now(),
        dropsAt: Date.now(),
        status: "live",
        difficulty: "iconic",
        scenes: [],
      });
      await ctx.db.delete(id);
      return id;
    });

    const stats = await t.query(api.analytics.getTodaysRoomStats, { episodeId: epId });
    expect(stats).toBeNull();
  });

  test("returns zero stats for episode with no runs", async () => {
    const t = setup();
    const epId = await t.run(async (ctx) => {
      return await ctx.db.insert("episodes", {
        slug: "ep-empty",
        activeAt: Date.now(),
        dropsAt: Date.now(),
        status: "live",
        difficulty: "iconic",
        scenes: [],
      });
    });

    const stats = await t.query(api.analytics.getTodaysRoomStats, { episodeId: epId });
    expect(stats).not.toBeNull();
    expect(stats!.totalAttempts).toBe(0);
    expect(stats!.totalSolved).toBe(0);
    expect(stats!.solveRate).toBe(0);
    expect(stats!.averageHintsUsed).toBe(0);
    expect(stats!.averageScore).toBe(0);
  });

  test("computes solve rate, averages, and most common first clue", async () => {
    const t = setup();
    const epId = await t.run(async (ctx) => {
      return await ctx.db.insert("episodes", {
        slug: "ep-room",
        activeAt: Date.now(),
        dropsAt: Date.now(),
        status: "live",
        difficulty: "iconic",
        scenes: [],
      });
    });

    await t.run(async (ctx) => {
      // Player A: solved with 2 memories, 1 guess, score 8800
      const runA = await ctx.db.insert("playerRuns", {
        episodeId: epId,
        identityId: "player-a",
        playerName: "Alice",
        status: "solved",
        startedAt: Date.now() - 120000,
        solvedAt: Date.now() - 60000,
        currentSceneIndex: 1,
        memoriesViewed: 2,
        hotspotsOpened: 1,
        guessesUsed: 1,
        score: 8800,
      });
      // Player B: exhausted with 5 memories, 5 guesses
      await ctx.db.insert("playerRuns", {
        episodeId: epId,
        identityId: "player-b",
        playerName: "Bob",
        status: "exhausted",
        startedAt: Date.now() - 300000,
        currentSceneIndex: 4,
        memoriesViewed: 5,
        hotspotsOpened: 3,
        guessesUsed: 5,
      });

      // Hotspot views for player A
      await ctx.db.insert("playerHotspotViews", {
        runId: runA,
        sceneIndex: 0,
        hotspotLabel: "Blackout notice",
        firstViewedAt: Date.now() - 90000,
      });
    });

    const stats = await t.query(api.analytics.getTodaysRoomStats, { episodeId: epId });
    expect(stats).not.toBeNull();
    expect(stats!.totalAttempts).toBe(2);
    expect(stats!.totalSolved).toBe(1);
    expect(stats!.solveRate).toBe(50);
    expect(stats!.averageMemoriesUsed).toBeGreaterThan(0);
    expect(stats!.averageHintsUsed).toBeGreaterThanOrEqual(0);
    expect(stats!.difficulty).toBe("iconic");
  });
});

describe("analytics.getWeeklyRecap", () => {
  test("returns empty recap when no closed episodes exist", async () => {
    const t = setup();
    const recap = await t.query(api.analytics.getWeeklyRecap, {});
    expect(recap.figures).toHaveLength(0);
    expect(recap.totalSolved).toBe(0);
    expect(recap.totalAttempted).toBe(0);
  });

  test("returns weekly figures with player solve status", async () => {
    const t = setup();
    await t.mutation(api.figures.seedCatalog, {});
    const churchill = await t.query(api.figures.search, { query: "Churchill" }).then((r) => r[0]);
    const einstein = await t.query(api.figures.search, { query: "Einstein" }).then((r) => r[0]);

    await t.run(async (ctx) => {
      // Episode 1 — solved by player
      const ep1 = await ctx.db.insert("episodes", {
        slug: "ep1",
        figureId: churchill._id,
        figureName: churchill.canonicalName,
        activeAt: Date.now() - 2 * 86_400_000,
        dropsAt: Date.now() - 2 * 86_400_000,
        closesAt: Date.now() - 86_400_000,
        status: "closed",
        difficulty: "iconic",
        scenes: [],
      });
      await ctx.db.insert("playerRuns", {
        episodeId: ep1,
        identityId: "player-x",
        playerName: "Player X",
        status: "solved",
        startedAt: Date.now() - 2 * 86_400_000,
        solvedAt: Date.now() - 2 * 86_400_000 + 60000,
        currentSceneIndex: 1,
        memoriesViewed: 2,
        hotspotsOpened: 1,
        guessesUsed: 1,
        score: 8500,
      });

      // Episode 2 — not solved by player
      await ctx.db.insert("episodes", {
        slug: "ep2",
        figureId: einstein._id,
        figureName: einstein.canonicalName,
        activeAt: Date.now() - 86_400_000,
        dropsAt: Date.now() - 86_400_000,
        closesAt: Date.now() - 3_600_000,
        status: "closed",
        difficulty: "iconic",
        scenes: [],
      });
    });

    const recap = await t.query(api.analytics.getWeeklyRecap, { identityId: "player-x" });
    expect(recap.figures).toHaveLength(2);
    expect(recap.totalAttempted).toBe(2);
    expect(recap.totalSolved).toBe(1);
    expect(recap.bestScore).toBe(8500);

    const churchillFig = recap.figures.find((f) => f.figureName === "Winston Churchill");
    expect(churchillFig).toBeDefined();
    expect(churchillFig!.playerSolved).toBe(true);
    expect(churchillFig!.playerScore).toBe(8500);

    const einsteinFig = recap.figures.find((f) => f.figureName === "Albert Einstein");
    expect(einsteinFig).toBeDefined();
    expect(einsteinFig!.playerSolved).toBe(false);
  });
});
