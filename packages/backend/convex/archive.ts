import { query } from "./_generated/server";
import { v } from "convex/values";
import { compareRankedEntries, computeScore } from "./scoring";

const archiveListItemShape = v.object({
  _id: v.id("episodes"),
  _creationTime: v.number(),
  slug: v.string(),
  figureName: v.string(),
  difficulty: v.union(v.literal("iconic"), v.literal("field"), v.literal("research")),
  activeAt: v.number(),
  closesAt: v.optional(v.number()),
  sceneCount: v.number(),
});

export const listClosed = query({
  args: {},
  returns: v.array(archiveListItemShape),
  handler: async (ctx) => {
    const closed = await ctx.db
      .query("episodes")
      .withIndex("by_status_and_dropsAt", (q) => q.eq("status", "closed"))
      .order("desc")
      .take(50);

    return closed.map((episode) => ({
      _id: episode._id,
      _creationTime: episode._creationTime,
      slug: episode.slug,
      figureName: episode.figureName ?? "Unknown figure",
      difficulty: episode.difficulty,
      activeAt: episode.activeAt,
      closesAt: episode.closesAt,
      sceneCount: episode.scenes.length,
    }));
  },
});

const archiveFigureProfile = v.object({
  canonicalName: v.string(),
  era: v.string(),
  region: v.string(),
  tags: v.array(v.string()),
  aliases: v.array(v.string()),
});

const sceneShape = v.object({
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
  isMercy: v.optional(v.boolean()),
  imageUrl: v.optional(v.string()),
  props: v.optional(v.array(
    v.object({
      id: v.string(),
      kind: v.string(),
      position: v.array(v.number()),
      rotation: v.array(v.number()),
      scale: v.optional(v.number()),
      clueLabel: v.optional(v.string()),
    }),
  )),
  lighting: v.optional(v.object({
    ambient: v.number(),
    keyColor: v.string(),
    keyIntensity: v.number(),
    fillColor: v.optional(v.string()),
    fillIntensity: v.optional(v.number()),
  })),
});

const archiveEpisodeShape = v.object({
  _id: v.id("episodes"),
  _creationTime: v.number(),
  slug: v.string(),
  activeAt: v.number(),
  closesAt: v.optional(v.number()),
  difficulty: v.union(v.literal("iconic"), v.literal("field"), v.literal("research")),
  competitiveMode: v.optional(v.boolean()),
  scenes: v.array(sceneShape),
  figure: archiveFigureProfile,
});

export const getEpisode = query({
  args: { episodeId: v.id("episodes"), identityId: v.optional(v.string()) },
  returns: v.union(archiveEpisodeShape, v.null()),
  handler: async (ctx, args) => {
    const episode = await ctx.db.get(args.episodeId);
    if (!episode) return null;

    const isClosed = episode.status === "closed";
    const hasRun = args.identityId
      ? await ctx.db
          .query("playerRuns")
          .withIndex("by_episodeId_and_identityId", (q) =>
            q.eq("episodeId", args.episodeId!).eq("identityId", args.identityId!),
          )
          .first()
      : null;
    const canView = isClosed || (hasRun && (hasRun.status === "solved" || hasRun.status === "exhausted"));

    if (!canView) return null;

    const figure = episode.figureId ? await ctx.db.get(episode.figureId) : null;

    return {
      _id: episode._id,
      _creationTime: episode._creationTime,
      slug: episode.slug,
      activeAt: episode.activeAt,
      closesAt: episode.closesAt,
      difficulty: episode.difficulty,
      competitiveMode: episode.competitiveMode ?? false,
      scenes: episode.scenes,
      figure: {
        canonicalName: figure?.canonicalName ?? episode.figureName ?? "Unknown figure",
        era: figure?.era ?? "",
        region: figure?.region ?? "",
        tags: figure?.tags ?? [],
        aliases: figure?.aliases ?? [],
      },
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

export const getLeaderboard = query({
  args: { episodeId: v.id("episodes") },
  returns: v.object({
    entries: v.array(leaderboardEntryShape),
    rankedCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const episode = await ctx.db.get(args.episodeId);
    if (!episode || episode.status !== "closed") {
      return { entries: [], rankedCount: 0 };
    }

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
      }))
      .sort(compareRankedEntries);

    return {
      entries: ranked.slice(0, 25),
      rankedCount: ranked.length,
    };
  },
});

const archiveRunShape = v.object({
  _id: v.id("playerRuns"),
  status: v.union(v.literal("active"), v.literal("solved"), v.literal("exhausted")),
  startedAt: v.number(),
  solvedAt: v.optional(v.number()),
  memoriesViewed: v.number(),
  hotspotsOpened: v.number(),
  guessesUsed: v.number(),
  score: v.optional(v.number()),
});

export const getRun = query({
  args: { episodeId: v.id("episodes"), identityId: v.string() },
  returns: v.union(archiveRunShape, v.null()),
  handler: async (ctx, args) => {
    const identityId = args.identityId.trim();
    if (!identityId || identityId.length > 64) return null;

    return await ctx.db
      .query("playerRuns")
      .withIndex("by_episodeId_and_identityId", (q) =>
        q.eq("episodeId", args.episodeId).eq("identityId", identityId),
      )
      .first();
  },
});
