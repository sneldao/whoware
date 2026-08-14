import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { clampInteger, computeDetailedProximity, computeScore, MAX_GUESSES_PER_RUN, proximityMessage } from "./scoring";

const guessProximity = v.union(
  v.literal("correct"),
  v.literal("same_era"),
  v.literal("same_region"),
  v.literal("same_era_and_region"),
  v.literal("same_century"),
  v.literal("off"),
);

const runStatus = v.union(v.literal("active"), v.literal("solved"), v.literal("exhausted"));

const runPublicShape = v.object({
  _id: v.id("playerRuns"),
  _creationTime: v.number(),
  episodeId: v.id("episodes"),
  identityId: v.string(),
  playerName: v.string(),
  status: runStatus,
  startedAt: v.number(),
  solvedAt: v.optional(v.number()),
  completedAt: v.optional(v.number()),
  currentSceneIndex: v.number(),
  memoriesViewed: v.number(),
  hotspotsOpened: v.number(),
  // Required post-backfill; all production playerRuns rows now carry it.
  hintsUsed: v.number(),
  guessesUsed: v.number(),
  score: v.optional(v.number()),
});

const MAX_SCENES = 20;
const MAX_HOTSPOTS_PER_SCENE = 50;

function validateIdentity(identityId: string): string {
  const clean = identityId.trim();
  if (!clean || clean.length > 64) {
    throw new Error("Invalid identity");
  }
  return clean;
}

function validatePlayerName(playerName: string): string {
  return playerName.trim().slice(0, 32) || "Anonymous";
}

export const getActiveRun = query({
  args: { episodeId: v.id("episodes"), identityId: v.string() },
  returns: v.union(runPublicShape, v.null()),
  handler: async (ctx, args) => {
    const identityId = validateIdentity(args.identityId);
    return await ctx.db
      .query("playerRuns")
      .withIndex("by_episodeId_and_identityId", (q) =>
        q.eq("episodeId", args.episodeId).eq("identityId", identityId),
      )
      .first();
  },
});

export const startRun = mutation({
  args: {
    episodeId: v.id("episodes"),
    identityId: v.string(),
    playerName: v.string(),
  },
  returns: runPublicShape,
  handler: async (ctx, args) => {
    const identityId = validateIdentity(args.identityId);
    const playerName = validatePlayerName(args.playerName);
    const episode = await ctx.db.get(args.episodeId);
    if (!episode) throw new Error("Episode not found");

    const existing = await ctx.db
      .query("playerRuns")
      .withIndex("by_episodeId_and_identityId", (q) =>
        q.eq("episodeId", args.episodeId).eq("identityId", identityId),
      )
      .first();
    if (existing) return existing;

    const runId = await ctx.db.insert("playerRuns", {
      episodeId: args.episodeId,
      identityId,
      playerName,
      status: "active",
      startedAt: Date.now(),
      currentSceneIndex: 0,
      memoriesViewed: 0,
      hotspotsOpened: 0,
      hintsUsed: 0,
      guessesUsed: 0,
    });

    const created = await ctx.db.get(runId);
    if (!created) throw new Error("Failed to create run");
    return created;
  },
});

export const enterScene = mutation({
  args: {
    runId: v.id("playerRuns"),
    sceneIndex: v.number(),
  },
  returns: v.object({ memoriesViewed: v.number() }),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found");

    const sceneIndex = clampInteger(args.sceneIndex, 0, MAX_SCENES);
    const episode = await ctx.db.get(run.episodeId);
    if (!episode) throw new Error("Episode not found");
    if (sceneIndex >= episode.scenes.length) {
      throw new Error("Scene index out of range");
    }

    const existing = await ctx.db
      .query("playerSceneViews")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .filter((q) => q.eq(q.field("sceneIndex"), sceneIndex))
      .first();

    if (existing) {
      return { memoriesViewed: run.memoriesViewed };
    }

    await ctx.db.insert("playerSceneViews", {
      runId: args.runId,
      sceneIndex,
      firstViewedAt: Date.now(),
    });

    const memoriesViewed = run.memoriesViewed + 1;
    const nextSceneIndex = Math.max(run.currentSceneIndex, sceneIndex);
    await ctx.db.patch(args.runId, { memoriesViewed, currentSceneIndex: nextSceneIndex });

    return { memoriesViewed };
  },
});

export const openHotspot = mutation({
  args: {
    runId: v.id("playerRuns"),
    sceneIndex: v.number(),
    hotspotLabel: v.string(),
  },
  returns: v.object({ hotspotsOpened: v.number() }),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found");

    const sceneIndex = clampInteger(args.sceneIndex, 0, MAX_SCENES);
    const label = args.hotspotLabel.trim().slice(0, 80);
    if (!label) throw new Error("Invalid hotspot label");

    const existing = await ctx.db
      .query("playerHotspotViews")
      .withIndex("by_runId", (q) => q.eq("runId", args.runId))
      .filter((q) =>
        q.and(q.eq(q.field("sceneIndex"), sceneIndex), q.eq(q.field("hotspotLabel"), label)),
      )
      .first();

    if (existing) {
      return { hotspotsOpened: run.hotspotsOpened };
    }

    if (run.hotspotsOpened >= MAX_HOTSPOTS_PER_SCENE * MAX_SCENES) {
      return { hotspotsOpened: run.hotspotsOpened };
    }

    await ctx.db.insert("playerHotspotViews", {
      runId: args.runId,
      sceneIndex,
      hotspotLabel: label,
      firstViewedAt: Date.now(),
    });

    const hotspotsOpened = run.hotspotsOpened + 1;
    await ctx.db.patch(args.runId, { hotspotsOpened });

    return { hotspotsOpened };
  },
});

export const useHint = mutation({
  args: {
    runId: v.id("playerRuns"),
    /** How many hint units to charge. Identity nudges cost 2; scene whispers cost 1. */
    count: v.optional(v.number()),
  },
  returns: v.object({ hintsUsed: v.number() }),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found");
    if (run.status !== "active") {
      throw new Error("Run is already resolved or exhausted");
    }
    const count = clampInteger(args.count ?? 1, 1, 10);
    const hintsUsed = run.hintsUsed + count;
    await ctx.db.patch(args.runId, { hintsUsed });
    return { hintsUsed };
  },
});

export const submitGuess = mutation({
  args: {
    runId: v.id("playerRuns"),
    figureId: v.id("figures"),
    playerName: v.optional(v.string()),
    walletAddress: v.optional(v.string()),
  },
  returns: v.object({
    isCorrect: v.boolean(),
    answer: v.optional(v.string()),
    answerFigureId: v.optional(v.id("figures")),
    guessedFigureName: v.string(),
    proximity: guessProximity,
    proximityMessage: v.string(),
    eraMatch: v.boolean(),
    regionMatch: v.boolean(),
    fieldMatch: v.boolean(),
    score: v.optional(v.number()),
    elapsedMs: v.number(),
    guessesUsed: v.number(),
    guessesRemaining: v.number(),
    status: runStatus,
  }),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Run not found");
    if (run.status !== "active") {
      throw new Error("Run is already resolved or exhausted");
    }

    const episode = await ctx.db.get(run.episodeId);
    if (!episode) throw new Error("Episode not found");

    const guessedFigure = await ctx.db.get(args.figureId);
    if (!guessedFigure) throw new Error("Figure not found");

    const now = Date.now();
    const elapsedMs = Math.max(0, now - run.startedAt);
    const guessesUsed = clampInteger(run.guessesUsed + 1, 1, MAX_GUESSES_PER_RUN);

    const correctFigureId = episode.figureId;
    const correctFigure = correctFigureId ? await ctx.db.get(correctFigureId) : null;
    const isCorrect = correctFigureId
      ? args.figureId === correctFigureId
      : correctFigure
        ? guessedFigure.canonicalName.toLowerCase() === correctFigure.canonicalName.toLowerCase()
        : false;

    // Compute guess proximity for feedback tiers
    let proximity: "correct" | "same_era" | "same_region" | "same_era_and_region" | "same_century" | "off" = "off";
    let eraMatch = false;
    let regionMatch = false;
    let fieldMatch = false;
    let proximityMsg = "";

    if (correctFigure) {
      if (isCorrect) {
        proximity = "correct";
        eraMatch = true;
        regionMatch = true;
        fieldMatch = true;
        proximityMsg = `${guessedFigure.canonicalName} — identity anchored.`;
      } else {
        const detailed = computeDetailedProximity(
          {
            guessed: { era: guessedFigure.era, region: guessedFigure.region, tags: guessedFigure.tags },
            correct: { era: correctFigure.era, region: correctFigure.region, tags: correctFigure.tags },
          },
          guessedFigure.canonicalName,
        );
        proximity = detailed.proximity;
        eraMatch = detailed.eraMatch;
        regionMatch = detailed.regionMatch;
        fieldMatch = detailed.fieldMatch;
        proximityMsg = detailed.message;
      }
    } else {
      proximityMsg = proximityMessage(proximity, guessedFigure.canonicalName);
    }

    let finalStatus: "active" | "solved" | "exhausted" = run.status;
    let score: number | undefined;
    let solvedAt: number | undefined = run.solvedAt;
    let completedAt: number | undefined = run.completedAt;

    if (isCorrect) {
      score = computeScore({
        memoriesViewed: run.memoriesViewed,
        hotspotsOpened: run.hotspotsOpened,
        hintsUsed: run.hintsUsed,
        guessesUsed,
        elapsedMs,
      });
      finalStatus = "solved";
      solvedAt = now;
    } else if (guessesUsed >= MAX_GUESSES_PER_RUN) {
      finalStatus = "exhausted";
      completedAt = now;
    }

    await ctx.db.patch(args.runId, {
      guessesUsed,
      status: finalStatus,
      score,
      solvedAt,
      completedAt,
      playerName: args.playerName ? validatePlayerName(args.playerName) : run.playerName,
      walletAddress: args.walletAddress?.toLowerCase() ?? run.walletAddress,
    });

    await ctx.db.insert("guesses", {
      episodeId: run.episodeId,
      runId: args.runId,
      identityId: run.identityId,
      figureId: args.figureId,
      playerName: args.playerName ? validatePlayerName(args.playerName) : run.playerName,
      guess: guessedFigure.canonicalName,
      isCorrect,
      // Persist the feedback so the deduction board survives reloads.
      proximity,
      proximityMessage: proximityMsg,
      eraMatch,
      regionMatch,
      fieldMatch,
      scenesRevealed: run.memoriesViewed,
      hotspotsOpened: run.hotspotsOpened,
      guessesUsed,
      elapsedMs,
      score,
      guessedAt: now,
      walletAddress: args.walletAddress?.toLowerCase(),
    });

    const guessesRemaining = Math.max(0, MAX_GUESSES_PER_RUN - guessesUsed);

    // The answer is revealed server-side exactly when the run ends:
    // solved (the player earned it) or exhausted (mercy reveal, no retry).
    const runEnded = finalStatus === "solved" || finalStatus === "exhausted";
    return {
      isCorrect,
      answer: runEnded && correctFigure ? correctFigure.canonicalName : undefined,
      answerFigureId: runEnded && correctFigureId ? correctFigureId : undefined,
      guessedFigureName: guessedFigure.canonicalName,
      proximity,
      proximityMessage: proximityMsg,
      eraMatch,
      regionMatch,
      fieldMatch,
      score,
      elapsedMs,
      guessesUsed,
      guessesRemaining,
      status: finalStatus,
    };
  },
});

export const getRun = query({
  args: { runId: v.id("playerRuns") },
  returns: v.union(runPublicShape, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.runId);
  },
});

/**
 * The episode's answer, scoped to the caller's resolved run. Only the
 * episode's own run may unlock it, and only once that run is solved or
 * exhausted — before then it returns null (same gate as archive.getEpisode).
 */
export const getAnswer = query({
  args: { episodeId: v.id("episodes"), identityId: v.string() },
  returns: v.union(
    v.object({
      canonicalName: v.string(),
      era: v.string(),
      region: v.string(),
      tags: v.array(v.string()),
      figureId: v.id("figures"),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const identityId = validateIdentity(args.identityId);
    const run = await ctx.db
      .query("playerRuns")
      .withIndex("by_episodeId_and_identityId", (q) =>
        q.eq("episodeId", args.episodeId).eq("identityId", identityId),
      )
      .first();
    if (!run || run.status === "active") return null;

    const episode = await ctx.db.get(args.episodeId);
    const figure = episode?.figureId ? await ctx.db.get(episode.figureId) : null;
    if (!figure) return null;
    return {
      canonicalName: figure.canonicalName,
      era: figure.era,
      region: figure.region,
      tags: figure.tags,
      figureId: figure._id,
    };
  },
});

export const getPlayerHistory = query({
  args: { identityId: v.string() },
  returns: v.array(
    v.object({
      _id: v.id("playerRuns"),
      _creationTime: v.number(),
      episodeId: v.id("episodes"),
      episodeSlug: v.string(),
      figureName: v.optional(v.string()),
      status: runStatus,
      startedAt: v.number(),
      solvedAt: v.optional(v.number()),
      score: v.optional(v.number()),
      memoriesViewed: v.number(),
      hotspotsOpened: v.number(),
      hintsUsed: v.number(),
      guessesUsed: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const identityId = validateIdentity(args.identityId);
    const runs = await ctx.db
      .query("playerRuns")
      .withIndex("by_identityId_and_startedAt", (q) => q.eq("identityId", identityId))
      .order("desc")
      .take(20);

    return await Promise.all(
      runs.map(async (run) => {
        const episode = await ctx.db.get(run.episodeId);
        return {
          _id: run._id,
          _creationTime: run._creationTime,
          episodeId: run.episodeId,
          episodeSlug: episode?.slug ?? "unknown",
          // Answer-leak guard: an active run's figure name is still the
          // live episode's secret. Reveal only once the run resolved.
          figureName: run.status === "active" ? undefined : episode?.figureName,
          status: run.status,
          startedAt: run.startedAt,
          solvedAt: run.solvedAt,
          score: run.score,
          memoriesViewed: run.memoriesViewed,
          hotspotsOpened: run.hotspotsOpened,
          hintsUsed: run.hintsUsed,
          guessesUsed: run.guessesUsed,
        };
      }),
    );
  },
});

/**
 * The caller's own guess feedback for the episode, chronological.
 *
 * Scoped to identityId and answer-leak-safe: a guess row never contains
 * the episode's figure (only the player's guessed figure, its proximity
 * tier, and match booleans), so serving these to an active run exposes
 * nothing the player hasn't already earned. Used to rehydrate the
 * deduction board after a reload.
 */
export const getRunGuesses = query({
  args: {
    episodeId: v.id("episodes"),
    identityId: v.string(),
  },
  returns: v.array(
    v.object({
      guess: v.string(),
      isCorrect: v.boolean(),
      eraMatch: v.boolean(),
      regionMatch: v.boolean(),
      fieldMatch: v.boolean(),
      proximityMessage: v.string(),
      guessedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const identityId = validateIdentity(args.identityId);
    const run = await ctx.db
      .query("playerRuns")
      .withIndex("by_episodeId_and_identityId", (q) =>
        q.eq("episodeId", args.episodeId).eq("identityId", identityId),
      )
      .first();
    if (!run) return [];

    const rows = await ctx.db
      .query("guesses")
      .withIndex("by_runId", (q) => q.eq("runId", run._id))
      .collect();
    return rows
      .sort((a, b) => a.guessedAt - b.guessedAt)
      .map((g) => ({
        guess: g.guess,
        isCorrect: g.isCorrect,
        eraMatch: g.eraMatch ?? false,
        regionMatch: g.regionMatch ?? false,
        fieldMatch: g.fieldMatch ?? false,
        proximityMessage: g.proximityMessage ?? "",
        guessedAt: g.guessedAt,
      }));
  },
});
