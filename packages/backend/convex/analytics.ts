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

/* ── Today's Room: social stats for the active episode ───────────── */

const todaysRoomStatsShape = v.object({
  totalAttempts: v.number(),
  totalSolved: v.number(),
  solveRate: v.number(),
  averageMemoriesUsed: v.number(),
  averageGuessesUsed: v.number(),
  averageScore: v.number(),
  medianMemoriesUsed: v.number(),
  mostCommonFirstClue: v.optional(v.string()),
  fastestSolveMs: v.number(),
  difficulty: v.string(),
});

/**
 * Aggregate social stats for the active episode. Surfaces community-wide
 * interaction patterns (not individual player data) to create a shared
 * daily conversation: "most players needed 3 memories," "the first clue
 * everyone touched was the letter," etc.
 */
export const getTodaysRoomStats = query({
  args: { episodeId: v.id("episodes") },
  returns: v.union(todaysRoomStatsShape, v.null()),
  handler: async (ctx, args) => {
    const episode = await ctx.db.get(args.episodeId);
    if (!episode) return null;

    const runs = await ctx.db
      .query("playerRuns")
      .withIndex("by_episodeId_and_status", (q) => q.eq("episodeId", args.episodeId))
      .collect();

    if (runs.length === 0) {
      return {
        totalAttempts: 0,
        totalSolved: 0,
        solveRate: 0,
        averageMemoriesUsed: 0,
        averageGuessesUsed: 0,
        averageScore: 0,
        medianMemoriesUsed: 0,
        mostCommonFirstClue: undefined,
        fastestSolveMs: 0,
        difficulty: episode.difficulty,
      };
    }

    const solved = runs.filter((r) => r.status === "solved");
    const solveRate = runs.length > 0 ? solved.length / runs.length : 0;

    const memoriesUsed = runs.map((r) => r.memoriesViewed).filter((m) => m > 0);
    const avgMemories = memoriesUsed.length > 0
      ? Math.round((memoriesUsed.reduce((a, b) => a + b, 0) / memoriesUsed.length) * 10) / 10
      : 0;

    const guessesUsed = runs.map((r) => r.guessesUsed).filter((g) => g > 0);
    const avgGuesses = guessesUsed.length > 0
      ? Math.round((guessesUsed.reduce((a, b) => a + b, 0) / guessesUsed.length) * 10) / 10
      : 0;

    const scores = solved.map((r) => r.score ?? 0).filter((s) => s > 0);
    const avgScore = scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

    const sortedMemories = [...memoriesUsed].sort((a, b) => a - b);
    const medianMemories = sortedMemories.length > 0
      ? sortedMemories[Math.floor(sortedMemories.length / 2)]
      : 0;

    // Find most common first clue from hotspot views
    const hotspotViews = await ctx.db
      .query("playerHotspotViews")
      .collect();
    const episodeHotspots = hotspotViews.filter((h) => {
      // We can't directly filter by episode, but hotspot views are linked to runs
      // which are linked to episodes. We'd need to cross-reference.
      return true;
    });

    // Find the first hotspot opened per run (lowest firstViewedAt per runId)
    const firstHotspotByRun = new Map<string, string>();
    for (const hv of episodeHotspots) {
      const run = runs.find((r) => r._id === hv.runId);
      if (!run) continue;
      const existing = firstHotspotByRun.get(hv.runId);
      if (!existing) {
        firstHotspotByRun.set(hv.runId, hv.hotspotLabel);
      }
    }

    const clueCounts = new Map<string, number>();
    for (const label of firstHotspotByRun.values()) {
      clueCounts.set(label, (clueCounts.get(label) ?? 0) + 1);
    }
    let mostCommonFirstClue: string | undefined;
    let maxCount = 0;
    for (const [label, count] of clueCounts) {
      if (count > maxCount) {
        maxCount = count;
        mostCommonFirstClue = label;
      }
    }

    // Fastest solve
    const solveTimes = solved
      .filter((r) => r.solvedAt && r.startedAt)
      .map((r) => (r.solvedAt! - r.startedAt));
    const fastestSolveMs = solveTimes.length > 0 ? Math.min(...solveTimes) : 0;

    return {
      totalAttempts: runs.length,
      totalSolved: solved.length,
      solveRate: Math.round(solveRate * 100),
      averageMemoriesUsed: avgMemories,
      averageGuessesUsed: avgGuesses,
      averageScore: avgScore,
      medianMemoriesUsed: medianMemories,
      mostCommonFirstClue,
      fastestSolveMs,
      difficulty: episode.difficulty,
    };
  },
});

/* ── Weekly recap ────────────────────────────────────────────────── */

const weeklyRecapFigureShape = v.object({
  episodeId: v.id("episodes"),
  slug: v.string(),
  figureName: v.string(),
  era: v.string(),
  region: v.string(),
  tags: v.array(v.string()),
  difficulty: v.string(),
  activeAt: v.number(),
  playerSolved: v.boolean(),
  playerScore: v.optional(v.number()),
});

const weeklyRecapShape = v.object({
  figures: v.array(weeklyRecapFigureShape),
  totalSolved: v.number(),
  totalAttempted: v.number(),
  bestScore: v.optional(v.number()),
  currentStreak: v.number(),
});

/**
 * Returns the past 7 days of episodes with the player's solve status.
 * Used by the weekly recap screen to show a summary + quiz of the
 * week's figures.
 */
export const getWeeklyRecap = query({
  args: { identityId: v.optional(v.string()) },
  returns: weeklyRecapShape,
  handler: async (ctx, args) => {
    const now = Date.now();
    const weekAgo = now - 7 * 86_400_000;

    const recentEpisodes = await ctx.db
      .query("episodes")
      .withIndex("by_status_and_dropsAt", (q) => q.eq("status", "closed"))
      .filter((q) => q.gte(q.field("closesAt") ?? q.field("activeAt"), weekAgo))
      .take(20);

    const identityId = args.identityId?.trim();

    let playerRuns: Array<{ episodeId: any; status: string; score?: number }> = [];
    if (identityId) {
      const allRuns = await ctx.db
        .query("playerRuns")
        .withIndex("by_identityId_and_startedAt", (q) => q.eq("identityId", identityId))
        .take(50);
      playerRuns = allRuns.map((r) => ({
        episodeId: r.episodeId,
        status: r.status,
        score: r.score,
      }));
    }

    const figures: Array<{
      episodeId: any;
      slug: string;
      figureName: string;
      era: string;
      region: string;
      tags: string[];
      difficulty: string;
      activeAt: number;
      playerSolved: boolean;
      playerScore?: number;
    }> = [];

    for (const ep of recentEpisodes) {
      const figure = ep.figureId ? await ctx.db.get(ep.figureId) : null;
      const playerRun = playerRuns.find((r) => r.episodeId === ep._id);

      figures.push({
        episodeId: ep._id,
        slug: ep.slug,
        figureName: figure?.canonicalName ?? ep.figureName ?? "Unknown",
        era: figure?.era ?? "",
        region: figure?.region ?? "",
        tags: figure?.tags ?? [],
        difficulty: ep.difficulty,
        activeAt: ep.activeAt,
        playerSolved: playerRun?.status === "solved",
        playerScore: playerRun?.score,
      });
    }

    // Sort by activeAt descending (most recent first)
    figures.sort((a, b) => b.activeAt - a.activeAt);

    const totalSolved = figures.filter((f) => f.playerSolved).length;
    const totalAttempted = figures.length;
    const scores = figures.filter((f) => f.playerScore).map((f) => f.playerScore!);
    const bestScore = scores.length > 0 ? Math.max(...scores) : undefined;

    // Current streak is approximate — based on consecutive solved days
    let currentStreak = 0;
    for (const f of figures) {
      if (f.playerSolved) {
        currentStreak++;
      } else if (f.activeAt < now - 86_400_000) {
        break;
      }
    }

    return {
      figures: figures.slice(0, 7),
      totalSolved,
      totalAttempted,
      bestScore,
      currentStreak,
    };
  },
});
