import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

const episodeStatus = v.union(v.literal("draft"), v.literal("live"), v.literal("closed"));

const MIN_DROP_LEAD_TIME_MS = 60_000;

const dailyEpisodeShape = v.object({
  _id: v.id("episodes"),
  _creationTime: v.number(),
  slug: v.string(),
  dropsAt: v.number(),
  closesAt: v.optional(v.number()),
  status: episodeStatus,
  difficulty: v.union(v.literal("iconic"), v.literal("field"), v.literal("research")),
  scenes: v.array(
    v.object({
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
      clues: v.array(v.object({ label: v.string(), detail: v.string(), x: v.number(), y: v.number() })),
      isMercy: v.optional(v.boolean()),
    }),
  ),
});

export const getCurrentDrop = query({
  args: {},
  returns: v.union(dailyEpisodeShape, v.null()),
  handler: async (ctx) => {
    const now = Date.now();
    const live = await ctx.db
      .query("episodes")
      .withIndex("by_status_and_dropsAt", (q) => q.eq("status", "live"))
      .order("asc")
      .filter((q) => q.lte(q.field("dropsAt"), now))
      .first();

    if (live) return live;

    return await ctx.db
      .query("episodes")
      .withIndex("by_isActive_and_activeAt", (q) => q.eq("isActive", true))
      .order("desc")
      .filter((q) => q.or(q.eq(q.field("status"), "live"), q.eq(q.field("status"), undefined as unknown as "live")))
      .first();
  },
});

export const getNextDrop = query({
  args: {},
  returns: v.union(
    v.object({
      dropsAt: v.number(),
      closesAt: v.optional(v.number()),
      slug: v.string(),
      episodeId: v.id("episodes"),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const now = Date.now();

    const live = await ctx.db
      .query("episodes")
      .withIndex("by_status_and_dropsAt", (q) => q.eq("status", "live"))
      .order("asc")
      .filter((q) => q.lte(q.field("dropsAt"), now))
      .first();
    if (live?.closesAt && live.closesAt > now) {
      return { dropsAt: live.dropsAt, closesAt: live.closesAt, slug: live.slug, episodeId: live._id };
    }

    const upcomingLive = await ctx.db
      .query("episodes")
      .withIndex("by_status_and_dropsAt", (q) => q.eq("status", "live"))
      .order("asc")
      .filter((q) => q.gt(q.field("dropsAt"), now))
      .first();
    if (upcomingLive) {
      return { dropsAt: upcomingLive.dropsAt, closesAt: upcomingLive.closesAt, slug: upcomingLive.slug, episodeId: upcomingLive._id };
    }

    const scheduled = await ctx.db
      .query("episodes")
      .withIndex("by_status_and_dropsAt", (q) => q.eq("status", "draft"))
      .order("asc")
      .filter((q) => q.gt(q.field("dropsAt"), now))
      .first();
    if (scheduled) {
      return { dropsAt: scheduled.dropsAt, closesAt: scheduled.closesAt, slug: scheduled.slug, episodeId: scheduled._id };
    }

    return null;
  },
});

export const scheduleEpisode = mutation({
  args: {
    episodeId: v.id("episodes"),
    dropsAt: v.number(),
    closesAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (args.dropsAt < Date.now() + MIN_DROP_LEAD_TIME_MS) {
      throw new Error("dropsAt must be at least one minute in the future");
    }
    if (args.closesAt && args.closesAt <= args.dropsAt) {
      throw new Error("closesAt must be after dropsAt");
    }

    const episode = await ctx.db.get(args.episodeId);
    if (!episode) throw new Error("Episode not found");
    if (episode.status === "closed") {
      throw new Error("Closed episodes cannot be rescheduled");
    }

    const conflicting = await ctx.db
      .query("episodes")
      .withIndex("by_status_and_dropsAt", (q) => q.eq("status", "draft"))
      .filter((q) =>
        q.and(
          q.gt(q.field("dropsAt"), args.dropsAt - 24 * 60 * 60 * 1000),
          q.lt(q.field("dropsAt"), args.dropsAt + 24 * 60 * 60 * 1000),
          q.neq(q.field("_id"), args.episodeId),
        ),
      )
      .first();
    if (conflicting) {
      throw new Error("Another drop is already scheduled within 24 hours of this time");
    }

    await ctx.db.patch(args.episodeId, {
      dropsAt: args.dropsAt,
      closesAt: args.closesAt,
      status: "draft",
      isActive: false,
    });
    return null;
  },
});

export const openExpired = internalMutation({
  args: {},
  returns: v.object({ opened: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const drafts = await ctx.db
      .query("episodes")
      .withIndex("by_status_and_dropsAt", (q) => q.eq("status", "draft"))
      .filter((q) => q.lte(q.field("dropsAt"), now))
      .collect();

    for (const episode of drafts) {
      await ctx.db.patch(episode._id, {
        status: "live",
        isActive: true,
        activeAt: episode.dropsAt,
      });
    }
    return { opened: drafts.length };
  },
});

export const closeExpired = internalMutation({
  args: {},
  returns: v.object({ closed: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const live = await ctx.db
      .query("episodes")
      .withIndex("by_status_and_dropsAt", (q) => q.eq("status", "live"))
      .filter((q) =>
        q.and(q.neq(q.field("closesAt"), undefined), q.lte(q.field("closesAt"), now)),
      )
      .collect();

    for (const episode of live) {
      await ctx.db.patch(episode._id, { status: "closed", isActive: false });
    }
    return { closed: live.length };
  },
});
