import { query } from "./_generated/server";
import { v } from "convex/values";

export const getGlobalStats = query({
  args: {},
  returns: v.object({
    totalSolves: v.number(),
    totalRuns: v.number(),
    uniqueSolvers: v.number(),
    averageScore: v.number(),
    totalMints: v.number(),
    totalArchiveUnlocks: v.number(),
    episodeCount: v.number(),
  }),
  handler: async (ctx) => {
    const allGuesses = await ctx.db.query("guesses").collect();
    const correctGuesses = allGuesses.filter((g) => g.isCorrect);

    const uniqueSolverIds = new Set(correctGuesses.map((g) => g.identityId).filter((id): id is string => !!id));

    const scores = correctGuesses.map((g) => g.score ?? 0).filter((s) => s > 0);
    const averageScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

    const allRuns = await ctx.db.query("playerRuns").collect();
    const totalMints = allRuns.filter((r) => !!r.mintTxHash).length;

    const archiveUnlocks = await ctx.db.query("archiveUnlocks").collect();
    const episodes = await ctx.db.query("episodes").collect();

    return {
      totalSolves: correctGuesses.length,
      totalRuns: allRuns.length,
      uniqueSolvers: uniqueSolverIds.size,
      averageScore,
      totalMints,
      totalArchiveUnlocks: archiveUnlocks.length,
      episodeCount: episodes.length,
    };
  },
});

const streakEntryShape = v.object({
  playerName: v.string(),
  bestScore: v.number(),
  totalSolves: v.number(),
});

export const getStreakLeaderboard = query({
  args: {},
  returns: v.array(streakEntryShape),
  handler: async (ctx) => {
    const allGuesses = await ctx.db.query("guesses").collect();
    const correctGuesses = allGuesses.filter((g) => g.isCorrect);

    const byPlayer = new Map<string, { playerName: string; bestScore: number; totalSolves: number }>();
    for (const g of correctGuesses) {
      const key = g.identityId ?? g.playerName;
      const existing = byPlayer.get(key);
      if (existing) {
        existing.totalSolves += 1;
        existing.bestScore = Math.max(existing.bestScore, g.score ?? 0);
      } else {
        byPlayer.set(key, { playerName: g.playerName, bestScore: g.score ?? 0, totalSolves: 1 });
      }
    }

    return Array.from(byPlayer.values())
      .sort((a, b) => b.totalSolves - a.totalSolves || b.bestScore - a.bestScore)
      .slice(0, 20);
  },
});

const recentSolveShape = v.object({
  playerName: v.string(),
  score: v.number(),
  scenesRevealed: v.number(),
  guessedAt: v.number(),
});

export const getRecentSolves = query({
  args: {},
  returns: v.array(recentSolveShape),
  handler: async (ctx) => {
    const allGuesses = await ctx.db
      .query("guesses")
      .withIndex("by_episodeId_and_isCorrect_and_guessedAt")
      .collect();

    return allGuesses
      .filter((g) => g.isCorrect)
      .sort((a, b) => b.guessedAt - a.guessedAt)
      .slice(0, 20)
      .map((g) => ({
        playerName: g.playerName,
        score: g.score ?? 0,
        scenesRevealed: g.scenesRevealed,
        guessedAt: g.guessedAt,
      }));
  },
});
