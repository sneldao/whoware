import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const linkWallet = mutation({
  args: {
    identityId: v.string(),
    walletAddress: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const normalizedAddress = args.walletAddress.toLowerCase();

    const existing = await ctx.db
      .query("walletLinks")
      .withIndex("by_walletAddress", (q) => q.eq("walletAddress", normalizedAddress))
      .first();

    if (existing && existing.identityId !== args.identityId) {
      throw new Error("Wallet already linked to another account");
    }

    if (existing) return null;

    await ctx.db.insert("walletLinks", {
      identityId: args.identityId,
      walletAddress: normalizedAddress,
      linkedAt: Date.now(),
    });

    return null;
  },
});

export const getWalletForIdentity = query({
  args: { identityId: v.string() },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const link = await ctx.db
      .query("walletLinks")
      .withIndex("by_identityId", (q) => q.eq("identityId", args.identityId))
      .first();

    return link?.walletAddress ?? null;
  },
});
