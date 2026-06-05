import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { compareRankedEntries, computeScore } from "./scoring";

const sceneClueValidator = v.object({
  label: v.string(),
  detail: v.string(),
  x: v.number(),
  y: v.number(),
});

const sceneReturnValidator = v.object({
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
  clues: v.array(sceneClueValidator),
  isMercy: v.optional(v.boolean()),
  imageUrl: v.optional(v.string()),
});

const publicEpisodeShape = v.object({
  _id: v.id("episodes"),
  _creationTime: v.number(),
  slug: v.string(),
  activeAt: v.number(),
  difficulty: v.union(v.literal("iconic"), v.literal("field"), v.literal("research")),
  scenes: v.array(sceneReturnValidator),
});

export const getActive = query({
  args: {},
  returns: v.union(publicEpisodeShape, v.null()),
  handler: async (ctx) => {
    const now = Date.now();
    const episode = await ctx.db
      .query("episodes")
      .withIndex("by_status_and_dropsAt", (q) => q.eq("status", "live"))
      .filter((q) => q.lte(q.field("dropsAt"), now))
      .order("desc")
      .first();

    if (!episode) return null;

    return {
      _id: episode._id,
      _creationTime: episode._creationTime,
      slug: episode.slug,
      activeAt: episode.activeAt,
      difficulty: episode.difficulty,
      scenes: episode.scenes,
    };
  },
});

const leaderboardEntryShape = v.object({
  _id: v.id("guesses"),
  playerName: v.string(),
  scenesRevealed: v.number(),
  hotspotsOpened: v.number(),
  guessesUsed: v.number(),
  elapsedMs: v.number(),
  score: v.number(),
  guessedAt: v.number(),
});

const leaderboardPlayerRankShape = v.object({
  rank: v.number(),
  playerName: v.string(),
  scenesRevealed: v.number(),
  hotspotsOpened: v.number(),
  guessesUsed: v.number(),
  elapsedMs: v.number(),
  score: v.number(),
  guessedAt: v.number(),
});

export const leaderboard = query({
  args: {
    episodeId: v.id("episodes"),
    playerName: v.optional(v.string()),
    identityId: v.optional(v.string()),
  },
  returns: v.object({
    entries: v.array(leaderboardEntryShape),
    playerRank: v.union(leaderboardPlayerRankShape, v.null()),
    rankedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const correctGuesses = await ctx.db
      .query("guesses")
      .withIndex("by_episodeId_and_isCorrect_and_scenesRevealed_and_guessedAt", (q) =>
        q.eq("episodeId", args.episodeId).eq("isCorrect", true),
      )
      .take(250);

    const ranked = correctGuesses
      .map((entry) => ({
        _id: entry._id,
        playerName: entry.playerName,
        scenesRevealed: entry.scenesRevealed,
        hotspotsOpened: entry.hotspotsOpened ?? 0,
        guessesUsed: entry.guessesUsed ?? 1,
        elapsedMs: entry.elapsedMs ?? 0,
        score:
          entry.score ??
          computeScore({
            memoriesViewed: entry.scenesRevealed,
            hotspotsOpened: entry.hotspotsOpened ?? 0,
            guessesUsed: entry.guessesUsed ?? 1,
            elapsedMs: entry.elapsedMs ?? 0,
          }),
        guessedAt: entry.guessedAt,
        identityId: entry.identityId,
      }))
      .sort(compareRankedEntries);

    const cleanPlayerName = args.playerName?.trim().toLowerCase();
    const cleanIdentityId = args.identityId?.trim();

    let playerIndex = -1;
    if (cleanIdentityId) {
      playerIndex = ranked.findIndex((entry) => entry.identityId === cleanIdentityId);
    }
    if (playerIndex < 0 && cleanPlayerName) {
      playerIndex = ranked.findIndex((entry) => entry.playerName.trim().toLowerCase() === cleanPlayerName);
    }

    const playerEntry = playerIndex >= 0 ? ranked[playerIndex] : null;

    return {
      entries: ranked.slice(0, 25).map(({ identityId: _identityId, ...rest }) => rest),
      playerRank: playerEntry
        ? {
            rank: playerIndex + 1,
            playerName: playerEntry.playerName,
            scenesRevealed: playerEntry.scenesRevealed,
            hotspotsOpened: playerEntry.hotspotsOpened,
            guessesUsed: playerEntry.guessesUsed,
            elapsedMs: playerEntry.elapsedMs,
            score: playerEntry.score,
            guessedAt: playerEntry.guessedAt,
          }
        : null,
      rankedCount: ranked.length,
    };
  },
});
