import { action, internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { createPublicClient, http, parseAbiItem, decodeEventLog } from "viem";
import { polygonAmoy } from "viem/chains";

const USDC_AMOY_ADDRESS = "0x41E94EB019C0762f9Bfcf9FB1E58725BfB0e7582" as const;
const ARCHIVE_PRICE_USDC = 1_000_000n; // 1 USDC (6 decimals)

function getPolygonClient() {
  const rpcUrl = process.env.POLYGON_AMOY_RPC_URL ?? polygonAmoy.rpcUrls.default.http[0];
  return createPublicClient({
    chain: polygonAmoy,
    transport: http(rpcUrl),
  });
}

function getTreasuryAddress() {
  return process.env.PAYWALL_TREASURY_ADDRESS as `0x${string}` | undefined;
}

export const isUnlocked = query({
  args: {
    identityId: v.string(),
    episodeId: v.id("episodes"),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const unlock = await ctx.db
      .query("archiveUnlocks")
      .withIndex("by_identityId_and_episodeId", (q) =>
        q.eq("identityId", args.identityId).eq("episodeId", args.episodeId)
      )
      .first();
    return unlock !== null;
  },
});

export const getUnlock = query({
  args: {
    identityId: v.string(),
    episodeId: v.id("episodes"),
  },
  returns: v.union(
    v.object({
      txHash: v.string(),
      paidAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const unlock = await ctx.db
      .query("archiveUnlocks")
      .withIndex("by_identityId_and_episodeId", (q) =>
        q.eq("identityId", args.identityId).eq("episodeId", args.episodeId)
      )
      .first();
    return unlock ? { txHash: unlock.txHash, paidAt: unlock.paidAt } : null;
  },
});

export const recordUnlock = internalMutation({
  args: {
    identityId: v.string(),
    episodeId: v.id("episodes"),
    txHash: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("archiveUnlocks")
      .withIndex("by_identityId_and_episodeId", (q) =>
        q.eq("identityId", args.identityId).eq("episodeId", args.episodeId)
      )
      .first();

    if (existing) {
      return null;
    }

    await ctx.db.insert("archiveUnlocks", {
      identityId: args.identityId,
      episodeId: args.episodeId,
      txHash: args.txHash,
      paidAt: Date.now(),
    });

    return null;
  },
});

export const verifyAndUnlock = action({
  args: {
    identityId: v.string(),
    episodeId: v.id("episodes"),
    txHash: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const treasury = getTreasuryAddress();
    if (!treasury) {
      console.error("Missing PAYWALL_TREASURY_ADDRESS");
      return false;
    }

    const client = getPolygonClient();

    try {
      const receipt = await client.waitForTransactionReceipt({
        hash: args.txHash as `0x${string}`,
      });

      if (receipt.status !== "success") {
        console.error("Transaction failed:", args.txHash);
        return false;
      }

      const transferEventSignature = parseAbiItem(
        "event Transfer(address indexed from, address indexed to, uint256 value)"
      );

      let paymentVerified = false;

      for (const log of receipt.logs) {
        if (log.address.toLowerCase() !== USDC_AMOY_ADDRESS.toLowerCase()) {
          continue;
        }

        try {
          const decoded = decodeEventLog({
            abi: [transferEventSignature],
            data: log.data,
            topics: log.topics,
          });

          if (decoded.eventName === "Transfer") {
            const { to, value } = decoded.args as { to: string; value: bigint };
            if (
              to.toLowerCase() === treasury.toLowerCase() &&
              value >= ARCHIVE_PRICE_USDC
            ) {
              paymentVerified = true;
              break;
            }
          }
        } catch {
          continue;
        }
      }

      if (!paymentVerified) {
        console.error("Payment verification failed for tx:", args.txHash);
        return false;
      }

      await ctx.scheduler.runAfter(0, internal.paywall.recordUnlock, {
        identityId: args.identityId,
        episodeId: args.episodeId,
        txHash: args.txHash,
      });

      return true;
    } catch (error) {
      console.error("Failed to verify payment:", error);
      return false;
    }
  },
});
