import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const sceneClue = v.object({
  label: v.string(),
  detail: v.string(),
  x: v.number(),
  y: v.number(),
});

const scene = v.object({
  title: v.string(),
  location: v.string(),
  era: v.string(),
  palette: v.array(v.string()),
  panoramaPrompt: v.string(),
  imageKey: v.optional(v.string()),
  imageAspectRatio: v.optional(v.string()),
  detailImageKeys: v.optional(v.array(v.string())),
  mediaKind: v.optional(v.union(v.literal("image"), v.literal("motion"), v.literal("video"))),
  motionPrompt: v.optional(v.string()),
  ambientText: v.string(),
  clues: v.array(sceneClue),
  isMercy: v.optional(v.boolean()),
  imageUrl: v.optional(v.string()),
});

export default defineSchema({
  ...authTables,
  figures: defineTable({
    canonicalName: v.string(),
    aliases: v.array(v.string()),
    era: v.string(),
    region: v.string(),
    tier: v.union(v.literal("iconic"), v.literal("field"), v.literal("research")),
    tags: v.array(v.string()),
    difficulty: v.union(v.literal("iconic"), v.literal("field"), v.literal("research")),
    searchIndex: v.string(),
  })
    .index("by_canonicalName", ["canonicalName"])
    .index("by_tier", ["tier"])
    .searchIndex("by_name", { searchField: "searchIndex" }),
  episodes: defineTable({
    slug: v.string(),
    figureId: v.optional(v.id("figures")),
    figureName: v.optional(v.string()),
    activeAt: v.number(),
    dropsAt: v.number(),
    closesAt: v.optional(v.number()),
    status: v.union(v.literal("staging"), v.literal("review"), v.literal("draft"), v.literal("live"), v.literal("closed")),
    difficulty: v.union(v.literal("iconic"), v.literal("field"), v.literal("research")),
    scenes: v.array(scene),
    answerOptions: v.optional(v.array(v.string())),
  })
    .index("by_slug", ["slug"])
    .index("by_figureId", ["figureId"])
    .index("by_status_and_dropsAt", ["status", "dropsAt"]),
  playerRuns: defineTable({
    episodeId: v.id("episodes"),
    identityId: v.string(),
    playerName: v.string(),
    status: v.union(v.literal("active"), v.literal("solved"), v.literal("exhausted")),
    startedAt: v.number(),
    solvedAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    currentSceneIndex: v.number(),
    memoriesViewed: v.number(),
    hotspotsOpened: v.number(),
    guessesUsed: v.number(),
    score: v.optional(v.number()),
    walletAddress: v.optional(v.string()),
    mintTxHash: v.optional(v.string()),
  })
    .index("by_episodeId_and_identityId", ["episodeId", "identityId"])
    .index("by_identityId_and_startedAt", ["identityId", "startedAt"])
    .index("by_episodeId_and_status", ["episodeId", "status"]),
  playerSceneViews: defineTable({
    runId: v.id("playerRuns"),
    sceneIndex: v.number(),
    firstViewedAt: v.number(),
  }).index("by_runId", ["runId"]),
  playerHotspotViews: defineTable({
    runId: v.id("playerRuns"),
    sceneIndex: v.number(),
    hotspotLabel: v.string(),
    firstViewedAt: v.number(),
  }).index("by_runId", ["runId"]),
  guesses: defineTable({
    episodeId: v.id("episodes"),
    runId: v.optional(v.id("playerRuns")),
    identityId: v.optional(v.string()),
    figureId: v.optional(v.id("figures")),
    playerName: v.string(),
    guess: v.string(),
    isCorrect: v.boolean(),
    scenesRevealed: v.number(),
    hotspotsOpened: v.optional(v.number()),
    guessesUsed: v.optional(v.number()),
    elapsedMs: v.optional(v.number()),
    score: v.optional(v.number()),
    guessedAt: v.number(),
    walletAddress: v.optional(v.string()),
    mintTxHash: v.optional(v.string()),
  })
    .index("by_episodeId_and_isCorrect_and_guessedAt", ["episodeId", "isCorrect", "guessedAt"])
    .index("by_episodeId_and_isCorrect_and_scenesRevealed_and_guessedAt", [
      "episodeId",
      "isCorrect",
      "scenesRevealed",
      "guessedAt",
    ])
    .index("by_episodeId_and_isCorrect_and_score", ["episodeId", "isCorrect", "score"])
    .index("by_episodeId_and_playerName", ["episodeId", "playerName"])
    .index("by_runId", ["runId"]),
  veniceHints: defineTable({
    cacheKey: v.string(),
    hint: v.string(),
    cachedAt: v.number(),
  })
    .index("by_cacheKey", ["cacheKey"]),
  walletLinks: defineTable({
    identityId: v.string(),
    walletAddress: v.string(),
    linkedAt: v.number(),
  })
    .index("by_identityId", ["identityId"])
    .index("by_walletAddress", ["walletAddress"]),
});
