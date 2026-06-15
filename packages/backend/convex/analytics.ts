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

const leaderEntryShape = v.object({
  rank: v.number(),
  playerName: v.string(),
  value: v.number(),
  secondary: v.optional(v.string()),
});

const weeklyLeadersShape = v.object({
  mostHints: v.array(leaderEntryShape),
  fastestSolves: v.array(leaderEntryShape),
  topSolvers: v.array(leaderEntryShape),
});

export const getWeeklyLeaders = query({
  args: {},
  returns: weeklyLeadersShape,
  handler: async (ctx) => {
    const weekAgo = Date.now() - 7 * 86_400_000;

    const recentGuesses = await ctx.db
      .query("guesses")
      .collect();

    const weeklyCorrect = recentGuesses.filter(
      (g) => g.isCorrect && g.guessedAt >= weekAgo,
    );

    // --- Most hints used (highest hotspotsOpened among correct solves) ---
    const byHints = new Map<string, { name: string; hints: number; total: number }>();
    for (const g of weeklyCorrect) {
      const key = g.identityId ?? g.playerName;
      const existing = byHints.get(key);
      const hints = g.hotspotsOpened ?? 0;
      if (existing) {
        existing.hints = Math.max(existing.hints, hints);
        existing.total += 1;
      } else {
        byHints.set(key, { name: g.playerName, hints, total: 1 });
      }
    }
    const mostHints = Array.from(byHints.values())
      .sort((a, b) => b.hints - a.hints || b.total - a.total)
      .slice(0, 10)
      .map((entry, i) => ({
        rank: i + 1,
        playerName: entry.name,
        value: entry.hints,
        secondary: `${entry.total} solve${entry.total !== 1 ? "s" : ""}`,
      }));

    // --- Fastest solves (lowest elapsedMs) ---
    const bySpeed = new Map<string, { name: string; fastest: number; total: number }>();
    for (const g of weeklyCorrect) {
      const key = g.identityId ?? g.playerName;
      const existing = bySpeed.get(key);
      const elapsed = g.elapsedMs ?? 0;
      if (existing) {
        existing.fastest = Math.min(existing.fastest, elapsed);
        existing.total += 1;
      } else {
        bySpeed.set(key, { name: g.playerName, fastest: elapsed, total: 1 });
      }
    }
    const fastestSolves = Array.from(bySpeed.values())
      .filter((e) => e.fastest > 0)
      .sort((a, b) => a.fastest - b.fastest || b.total - a.total)
      .slice(0, 10)
      .map((entry, i) => ({
        rank: i + 1,
        playerName: entry.name,
        value: entry.fastest,
        secondary: `${Math.floor(entry.fastest / 1000)}s · ${entry.total} solve${entry.total !== 1 ? "s" : ""}`,
      }));

    // --- Top solvers (most correct guesses) ---
    const bySolves = new Map<string, { name: string; count: number; bestScore: number }>();
    for (const g of weeklyCorrect) {
      const key = g.identityId ?? g.playerName;
      const existing = bySolves.get(key);
      if (existing) {
        existing.count += 1;
        existing.bestScore = Math.max(existing.bestScore, g.score ?? 0);
      } else {
        bySolves.set(key, { name: g.playerName, count: 1, bestScore: g.score ?? 0 });
      }
    }
    const topSolvers = Array.from(bySolves.values())
      .sort((a, b) => b.count - a.count || b.bestScore - a.bestScore)
      .slice(0, 10)
      .map((entry, i) => ({
        rank: i + 1,
        playerName: entry.name,
        value: entry.count,
        secondary: `Best: ${entry.bestScore.toLocaleString()} pts`,
      }));

    return { mostHints, fastestSolves, topSolvers };
  },
});

const episodeBreakdownShape = v.object({
  episodeId: v.id("episodes"),
  slug: v.string(),
  figureName: v.string(),
  totalSolves: v.number(),
  mostHintsUsed: v.number(),
  fastestSolveMs: v.number(),
  averageScore: v.number(),
});

export const getEpisodeBreakdowns = query({
  args: {},
  returns: v.array(episodeBreakdownShape),
  handler: async (ctx) => {
    const weekAgo = Date.now() - 7 * 86_400_000;

    const recentGuesses = await ctx.db.query("guesses").collect();
    const weeklyCorrect = recentGuesses.filter(
      (g) => g.isCorrect && g.guessedAt >= weekAgo,
    );

    // Group by episodeId
    const byEpisode = new Map<
      string,
      {
        guesses: Array<{ hotspotsOpened: number; elapsedMs: number; score: number }>;
      }
    >();

    for (const g of weeklyCorrect) {
      const epId = g.episodeId;
      const existing = byEpisode.get(epId);
      const entry = {
        hotspotsOpened: g.hotspotsOpened ?? 0,
        elapsedMs: g.elapsedMs ?? 0,
        score: g.score ?? 0,
      };
      if (existing) {
        existing.guesses.push(entry);
      } else {
        byEpisode.set(epId, { guesses: [entry] });
      }
    }

    if (byEpisode.size === 0) return [];

    // Fetch episode details
    const episodeIds = Array.from(byEpisode.keys());
    const episodes = await Promise.all(
      episodeIds.map((id) => ctx.db.get(id as any)),
    );

    const results = episodeIds
      .map((epId, i) => {
        const ep = episodes[i];
        if (!ep) return null;

        const data = byEpisode.get(epId)!;
        const maxHints = Math.max(...data.guesses.map((g) => g.hotspotsOpened));
        const minElapsed = Math.min(...data.guesses.map((g) => g.elapsedMs));
        const avgScore = Math.round(
          data.guesses.reduce((s, g) => s + g.score, 0) / data.guesses.length,
        );

        return {
          episodeId: epId as any,
          slug: ep.slug,
          figureName: ep.figureName ?? "Unknown",
          totalSolves: data.guesses.length,
          mostHintsUsed: maxHints,
          fastestSolveMs: minElapsed,
          averageScore: avgScore,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return results;
  },
});
