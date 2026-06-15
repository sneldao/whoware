import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { clampInteger, computeScore, MAX_GUESSES_PER_RUN } from "./scoring";

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

    let finalStatus: "active" | "solved" | "exhausted" = run.status;
    let score: number | undefined;
    let solvedAt: number | undefined = run.solvedAt;
    let completedAt: number | undefined = run.completedAt;

    if (isCorrect) {
      score = computeScore({
        memoriesViewed: run.memoriesViewed,
        hotspotsOpened: run.hotspotsOpened,
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
      scenesRevealed: run.memoriesViewed,
      hotspotsOpened: run.hotspotsOpened,
      guessesUsed,
      elapsedMs,
      score,
      guessedAt: now,
      walletAddress: args.walletAddress?.toLowerCase(),
    });

    const guessesRemaining = Math.max(0, MAX_GUESSES_PER_RUN - guessesUsed);

    return {
      isCorrect,
      answer: isCorrect && correctFigure ? correctFigure.canonicalName : undefined,
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
      guessesUsed: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const identityId = validateIdentity(args.identityId);
    const runs = await ctx.db
      .query("playerRuns")
      .withIndex("by_identityId_and_startedAt", (q) => q.eq("identityId", identityId))
      .order("desc")
      .collect();

    return await Promise.all(
      runs.map(async (run) => {
        const episode = await ctx.db.get(run.episodeId);
        return {
          _id: run._id,
          _creationTime: run._creationTime,
          episodeId: run.episodeId,
          episodeSlug: episode?.slug ?? "unknown",
          figureName: episode?.figureName,
          status: run.status,
          startedAt: run.startedAt,
          solvedAt: run.solvedAt,
          score: run.score,
          memoriesViewed: run.memoriesViewed,
          hotspotsOpened: run.hotspotsOpened,
          guessesUsed: run.guessesUsed,
        };
      }),
    );
  },
});
