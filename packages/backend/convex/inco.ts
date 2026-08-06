import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  createWalletClient,
  http,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

/**
 * Inco Lightning curator integration.
 *
 * When an episode goes live, the curator (this Convex action) encrypts
 * the figure ID and calls setAnswer() on the WhoWareConfidentialGuess
 * contract on Base Sepolia. The answer stays encrypted on-chain until
 * the episode closes.
 *
 * Flow:
 *   1. openExpired mutation detects a draft episode ready to go live
 *   2. It calls this action via ctx.scheduler.runAfter(0, ...)
 *   3. This action encrypts the figure ID using @inco/lightning-js
 *   4. It submits setAnswer(episodeDay, ciphertext) to the contract
 *   5. Players can now submit encrypted guesses that are checked on-chain
 */

const INCO_GUESS_CONTRACT = (process.env.INCO_GUESS_CONTRACT ?? "") as `0x${string}`;
const BASE_SEPOLIA_RPC = process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";

const INCO_GUESS_ABI = [
  {
    name: "setAnswer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "episodeDay", type: "uint256" },
      { name: "ciphertext", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "answerSet",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "episodeDay", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "revealResult",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "player", type: "address" },
      { name: "episodeDay", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const DAY_MS = 86_400_000;

function episodeDayFromDropsAt(dropsAt: number): number {
  return Math.max(1, Math.floor(dropsAt / DAY_MS));
}

/**
 * Sets the encrypted answer on the WhoWareConfidentialGuess contract.
 *
 * Called when an episode transitions to "live" status. The figure ID is
 * encrypted client-side style using the Inco Lightning JS SDK, then
 * submitted to the contract as the encrypted answer for the episode day.
 *
 * If the Inco SDK or contract is not configured, this action is a no-op
 * (the game works fine without on-chain encrypted guesses — the legacy
 * commit-reveal flow on Mantle Sepolia remains available).
 */
export const setEpisodeAnswerOnChain = action({
  args: {
    episodeId: v.id("episodes"),
    figureId: v.id("figures"),
    dropsAt: v.number(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    if (!INCO_GUESS_CONTRACT || INCO_GUESS_CONTRACT === "") {
      console.log("[inco] INCO_GUESS_CONTRACT not set — skipping on-chain answer");
      return null;
    }

    const privateKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;
    if (!privateKey) {
      console.error("[inco] DEPLOYER_PRIVATE_KEY not set — cannot submit on-chain answer");
      return null;
    }

    try {
      // Convert figure ID to a numeric value for encryption
      // We use a simple hash of the figure ID to get a deterministic uint256
      const figureNumeric = BigInt(args.figureId.replace(/[^0-9]/g, "").slice(0, 10) || "0");
      const episodeDay = episodeDayFromDropsAt(args.dropsAt);

      // Dynamically import the Inco SDK (won't be available in all environments)
      const { Lightning } = await import("@inco/lightning-js/lite");
      const { handleTypes } = await import("@inco/lightning-js");

      const zap = await Lightning.baseSepoliaTestnet({
        hostChainRpcUrls: [BASE_SEPOLIA_RPC],
      });

      // Encrypt the figure ID as a uint256
      const account = privateKeyToAccount(privateKey);
      const ciphertext = await zap.encrypt(figureNumeric, {
        accountAddress: account.address,
        dappAddress: INCO_GUESS_CONTRACT,
        handleType: handleTypes.euint256,
      });

      // Submit setAnswer on-chain
      const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(BASE_SEPOLIA_RPC),
      });

      const txHash = await walletClient.writeContract({
        address: INCO_GUESS_CONTRACT,
        abi: INCO_GUESS_ABI,
        functionName: "setAnswer",
        args: [BigInt(episodeDay), ciphertext as `0x${string}`],
      });

      console.log(`[inco] setAnswer tx: ${txHash} (episode day ${episodeDay})`);
      return txHash;
    } catch (error) {
      console.error("[inco] setEpisodeAnswerOnChain failed:", error);
      return null;
    }
  },
});

/**
 * Called by the openExpired mutation when episodes transition from
 * draft to live. Schedules the on-chain answer submission.
 */
export const scheduleAnswerForLiveEpisodes = internalAction({
  args: {
    episodeId: v.id("episodes"),
    figureId: v.optional(v.id("figures")),
    dropsAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!args.figureId) {
      console.log("[inco] No figureId for episode — skipping on-chain answer");
      return null;
    }

    // Call the public action (which can use viem + Inco SDK)
    await ctx.runAction(internal.inco.setEpisodeAnswerOnChain, {
      episodeId: args.episodeId,
      figureId: args.figureId,
      dropsAt: args.dropsAt,
    });

    return null;
  },
});

/**
 * Reveals the correctness result for a player's guess at episode close.
 * Anyone can call this — it's a public good, not curator-only.
 */
export const revealEpisodeResults = action({
  args: {
    episodeDay: v.number(),
    playerAddresses: v.array(v.string()),
  },
  returns: v.union(v.array(v.string()), v.null()),
  handler: async (_ctx, args) => {
    if (!INCO_GUESS_CONTRACT || INCO_GUESS_CONTRACT === "") {
      return null;
    }

    const privateKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;
    if (!privateKey) return null;

    try {
      const account = privateKeyToAccount(privateKey);
      const walletClient = createWalletClient({
        account,
        chain: baseSepolia,
        transport: http(BASE_SEPOLIA_RPC),
      });

      const txHashes: string[] = [];

      for (const playerAddress of args.playerAddresses) {
        try {
          const txHash = await walletClient.writeContract({
            address: INCO_GUESS_CONTRACT,
            abi: INCO_GUESS_ABI,
            functionName: "revealResult",
            args: [playerAddress as Address, BigInt(args.episodeDay)],
          });
          txHashes.push(txHash);
        } catch {
          // Player may not have guessed, or result already revealed — skip
        }
      }

      return txHashes.length > 0 ? txHashes : null;
    } catch (error) {
      console.error("[inco] revealEpisodeResults failed:", error);
      return null;
    }
  },
});
