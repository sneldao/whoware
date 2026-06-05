import { action, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push";
const PUSH_BATCH_SIZE = 100;

export const registerToken = mutation({
  args: {
    identityId: v.string(),
    expoPushToken: v.string(),
    platform: v.union(v.literal("ios"), v.literal("android"), v.literal("web")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identityId = args.identityId.trim();
    if (!identityId || identityId.length > 64) {
      throw new Error("Invalid identity");
    }

    const existing = await ctx.db
      .query("notificationSubscriptions")
      .withIndex("by_identityId", (q) => q.eq("identityId", identityId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        expoPushToken: args.expoPushToken,
        platform: args.platform,
        subscribedAt: now,
        unsubscribedAt: undefined,
      });
      return null;
    }

    await ctx.db.insert("notificationSubscriptions", {
      identityId,
      expoPushToken: args.expoPushToken,
      platform: args.platform,
      subscribedAt: now,
    });
    return null;
  },
});

export const unregisterToken = mutation({
  args: { identityId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identityId = args.identityId.trim();
    if (!identityId || identityId.length > 64) {
      throw new Error("Invalid identity");
    }

    const existing = await ctx.db
      .query("notificationSubscriptions")
      .withIndex("by_identityId", (q) => q.eq("identityId", identityId))
      .first();

    if (!existing) return null;
    await ctx.db.patch(existing._id, { unsubscribedAt: Date.now() });
    return null;
  },
});

export const getSubscription = query({
  args: { identityId: v.string() },
  returns: v.union(
    v.object({
      expoPushToken: v.string(),
      platform: v.union(v.literal("ios"), v.literal("android"), v.literal("web")),
      isOptedIn: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const identityId = args.identityId.trim();
    if (!identityId || identityId.length > 64) return null;

    const sub = await ctx.db
      .query("notificationSubscriptions")
      .withIndex("by_identityId", (q) => q.eq("identityId", identityId))
      .first();

    if (!sub) return null;
    return {
      expoPushToken: sub.expoPushToken,
      platform: sub.platform,
      isOptedIn: !sub.unsubscribedAt,
    };
  },
});

export const dispatchPending = internalMutation({
  args: {},
  returns: v.object({ dispatchedEpisodes: v.number() }),
  handler: async (ctx) => {
    const liveEpisodes = await ctx.db
      .query("episodes")
      .withIndex("by_status_and_dropsAt", (q) => q.eq("status", "live"))
      .collect();

    const now = Date.now();
    const tenMinutesAgo = now - 10 * 60 * 1000;
    const recentlyDropped = liveEpisodes.filter(
      (ep) => ep.dropsAt >= tenMinutesAgo && ep.dropsAt <= now,
    );

    let dispatchedEpisodes = 0;

    for (const episode of recentlyDropped) {
      const alreadySent = await ctx.db
        .query("notificationDispatchLog")
        .withIndex("by_episodeId", (q) => q.eq("episodeId", episode._id))
        .first();

      if (alreadySent) continue;

      await ctx.scheduler.runAfter(
        0,
        internal.notifications.sendDropLive,
        { episodeId: episode._id, slug: episode.slug },
      );

      dispatchedEpisodes += 1;
    }

    return { dispatchedEpisodes };
  },
});

export const sendDropLive = action({
  args: {
    episodeId: v.id("episodes"),
    slug: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const activeSubs = await ctx.db
      .query("notificationSubscriptions")
      .filter((q) => q.eq(q.field("unsubscribedAt"), undefined))
      .collect();

    if (activeSubs.length === 0) {
      await ctx.runMutation(internal.notifications.logDispatch, {
        episodeId: args.episodeId,
        recipientCount: 0,
      });
      return null;
    }

    const tokens = activeSubs.map((sub) => sub.expoPushToken);
    const batches: string[][] = [];
    for (let i = 0; i < tokens.length; i += PUSH_BATCH_SIZE) {
      batches.push(tokens.slice(i, i + PUSH_BATCH_SIZE));
    }

    const body = {
      to: tokens,
      title: "A new case is live",
      body: `WhoWare ${args.slug} just opened. Step into the memory.`,
      data: { episodeId: args.episodeId, slug: args.slug, type: "drop-live" },
      sound: "default",
    };

    let sentCount = 0;
    for (const batch of batches) {
      try {
        const response = await fetch(EXPO_PUSH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            ...body,
            to: batch,
          }),
        });
        if (response.ok) sentCount += batch.length;
      } catch {
        // Non-fatal: a batch failure doesn't block the rest.
      }
    }

    await ctx.runMutation(internal.notifications.logDispatch, {
      episodeId: args.episodeId,
      recipientCount: sentCount,
    });
    return null;
  },
});

export const logDispatch = internalMutation({
  args: {
    episodeId: v.id("episodes"),
    recipientCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("notificationDispatchLog", {
      episodeId: args.episodeId,
      dispatchedAt: Date.now(),
      recipientCount: args.recipientCount,
    });
    return null;
  },
});
