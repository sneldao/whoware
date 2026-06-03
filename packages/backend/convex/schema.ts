import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

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
  clues: v.array(
    v.object({
      label: v.string(),
      detail: v.string(),
      x: v.number(),
      y: v.number(),
    }),
  ),
});

export default defineSchema({
  ...authTables,
  episodes: defineTable({
    slug: v.string(),
    figureName: v.string(),
    activeAt: v.number(),
    isActive: v.boolean(),
    difficulty: v.union(v.literal("iconic"), v.literal("field"), v.literal("research")),
    scenes: v.array(scene),
    answerOptions: v.array(v.string()),
  })
    .index("by_isActive_and_activeAt", ["isActive", "activeAt"])
    .index("by_slug", ["slug"]),
  guesses: defineTable({
    episodeId: v.id("episodes"),
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
    .index("by_episodeId_and_playerName", ["episodeId", "playerName"]),
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
