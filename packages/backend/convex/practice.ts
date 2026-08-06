import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const runStatus = v.union(v.literal("active"), v.literal("solved"), v.literal("abandoned"));

const practiceRunShape = v.object({
  _id: v.id("practiceRuns"),
  _creationTime: v.number(),
  episodeId: v.id("episodes"),
  identityId: v.string(),
  status: runStatus,
  startedAt: v.number(),
  solvedAt: v.optional(v.number()),
  currentSceneIndex: v.number(),
  memoriesViewed: v.number(),
  hotspotsOpened: v.number(),
  guessesUsed: v.number(),
  figureId: v.optional(v.id("figures")),
});

const PRACTICE_MAX_GUESSES = 99;

/**
 * Practice mode: replay any closed episode with no scoring, no streak impact,
 * and no leaderboard entry. Guesses are unlimited (cap is a safety valve).
 * The practice run is per (episodeId, identityId) — starting a new one
 * replaces an abandoned one, but a solved practice run is preserved.
 */
export const startPracticeRun = mutation({
  args: {
    episodeId: v.id("episodes"),
    identityId: v.string(),
  },
  returns: practiceRunShape,
  handler: async (ctx, args) => {
    const identityId = args.identityId.trim();
    if (!identityId || identityId.length > 64) {
      throw new Error("Invalid identity");
    }

    const episode = await ctx.db.get(args.episodeId);
    if (!episode) throw new Error("Episode not found");
    if (episode.status !== "closed") {
      throw new Error("Practice mode is only available for closed episodes");
    }

    // Check for an existing practice run — reuse if active or solved
    const existing = await ctx.db
      .query("practiceRuns")
      .withIndex("by_episodeId_and_identityId", (q) =>
        q.eq("episodeId", args.episodeId).eq("identityId", identityId),
      )
      .first();

    if (existing && (existing.status === "active" || existing.status === "solved")) {
      return existing;
    }

    // Replace abandoned run
    if (existing) {
      await ctx.db.delete(existing._id);
    }

    const runId = await ctx.db.insert("practiceRuns", {
      episodeId: args.episodeId,
      identityId,
      status: "active",
      startedAt: Date.now(),
      currentSceneIndex: 0,
      memoriesViewed: 0,
      hotspotsOpened: 0,
      guessesUsed: 0,
      figureId: episode.figureId,
    });

    const created = await ctx.db.get(runId);
    if (!created) throw new Error("Failed to create practice run");
    return created;
  },
});

export const getPracticeRun = query({
  args: { episodeId: v.id("episodes"), identityId: v.string() },
  returns: v.union(practiceRunShape, v.null()),
  handler: async (ctx, args) => {
    const identityId = args.identityId.trim();
    if (!identityId || identityId.length > 64) return null;

    return await ctx.db
      .query("practiceRuns")
      .withIndex("by_episodeId_and_identityId", (q) =>
        q.eq("episodeId", args.episodeId).eq("identityId", identityId),
      )
      .first();
  },
});

export const practiceEnterScene = mutation({
  args: {
    runId: v.id("practiceRuns"),
    sceneIndex: v.number(),
  },
  returns: v.object({ memoriesViewed: v.number() }),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Practice run not found");
    if (run.status !== "active") throw new Error("Practice run is not active");

    const episode = await ctx.db.get(run.episodeId);
    if (!episode) throw new Error("Episode not found");
    if (args.sceneIndex < 0 || args.sceneIndex >= episode.scenes.length) {
      throw new Error("Scene index out of range");
    }

    const nextSceneIndex = Math.max(run.currentSceneIndex, args.sceneIndex);
    const memoriesViewed = Math.max(run.memoriesViewed, args.sceneIndex + 1);
    await ctx.db.patch(args.runId, {
      currentSceneIndex: nextSceneIndex,
      memoriesViewed,
    });

    return { memoriesViewed };
  },
});

export const practiceOpenHotspot = mutation({
  args: {
    runId: v.id("practiceRuns"),
    hotspotLabel: v.string(),
  },
  returns: v.object({ hotspotsOpened: v.number() }),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Practice run not found");
    if (run.status !== "active") throw new Error("Practice run is not active");

    const hotspotsOpened = run.hotspotsOpened + 1;
    await ctx.db.patch(args.runId, { hotspotsOpened });

    return { hotspotsOpened };
  },
});

export const practiceSubmitGuess = mutation({
  args: {
    runId: v.id("practiceRuns"),
    figureId: v.id("figures"),
  },
  returns: v.object({
    isCorrect: v.boolean(),
    answer: v.optional(v.string()),
    guessesUsed: v.number(),
    status: runStatus,
  }),
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Practice run not found");
    if (run.status !== "active") throw new Error("Practice run is not active");

    const episode = await ctx.db.get(run.episodeId);
    if (!episode) throw new Error("Episode not found");

    const guessedFigure = await ctx.db.get(args.figureId);
    if (!guessedFigure) throw new Error("Figure not found");

    const correctFigureId = episode.figureId;
    const correctFigure = correctFigureId ? await ctx.db.get(correctFigureId) : null;
    const isCorrect = correctFigureId
      ? args.figureId === correctFigureId
      : correctFigure
        ? guessedFigure.canonicalName.toLowerCase() === correctFigure.canonicalName.toLowerCase()
        : false;

    const guessesUsed = run.guessesUsed + 1;
    let status: "active" | "solved" | "abandoned" = "active";

    if (isCorrect) {
      status = "solved";
      await ctx.db.patch(args.runId, {
        guessesUsed,
        status,
        solvedAt: Date.now(),
      });
    } else if (guessesUsed >= PRACTICE_MAX_GUESSES) {
      status = "abandoned";
      await ctx.db.patch(args.runId, { guessesUsed, status });
    } else {
      await ctx.db.patch(args.runId, { guessesUsed });
    }

    return {
      isCorrect,
      answer: isCorrect && correctFigure ? correctFigure.canonicalName : undefined,
      guessesUsed,
      status,
    };
  },
});
