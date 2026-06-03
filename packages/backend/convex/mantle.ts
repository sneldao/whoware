import { action } from "./_generated/server";
import { v } from "convex/values";
import { createWalletClient, http, keccak256, encodePacked } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { mantleSepoliaTestnet } from "viem/chains";

const SCORE_ABI = [
  {
    name: "mintScore",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "player", type: "address" },
      { name: "episodeDay", type: "uint256" },
      { name: "score", type: "uint256" },
      { name: "memoriesViewed", type: "uint8" },
      { name: "cluesOpened", type: "uint8" },
      { name: "guessesUsed", type: "uint8" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const STREAK_ABI = [
  {
    name: "updateStreak",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "player", type: "address" },
      { name: "currentStreak", type: "uint256" },
      { name: "bestStreak", type: "uint256" },
      { name: "lastSolvedDay", type: "uint256" },
      { name: "totalSolved", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

export const mintScore = action({
  args: {
    playerAddress: v.string(),
    episodeDay: v.number(),
    score: v.number(),
    memoriesViewed: v.number(),
    cluesOpened: v.number(),
    guessesUsed: v.number(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (_ctx, args) => {
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;
    const contractAddress = process.env.MANTLE_SCORE_CONTRACT as `0x${string}` | undefined;

    if (!privateKey || !contractAddress) {
      console.error("Missing DEPLOYER_PRIVATE_KEY or MANTLE_SCORE_CONTRACT");
      return null;
    }

    const account = privateKeyToAccount(privateKey);
    const client = createWalletClient({
      account,
      chain: mantleSepoliaTestnet,
      transport: http(),
    });

    const nonce = 0n;

    const signature = await account.signTypedData({
      domain: {
        name: "WhoWareScore",
        version: "1",
        chainId: BigInt(mantleSepoliaTestnet.id),
        verifyingContract: contractAddress,
      },
      types: {
        MintScore: [
          { name: "player", type: "address" },
          { name: "episodeDay", type: "uint256" },
          { name: "score", type: "uint256" },
          { name: "memoriesViewed", type: "uint8" },
          { name: "cluesOpened", type: "uint8" },
          { name: "guessesUsed", type: "uint8" },
          { name: "nonce", type: "uint256" },
        ],
      },
      primaryType: "MintScore",
      message: {
        player: args.playerAddress as `0x${string}`,
        episodeDay: BigInt(args.episodeDay),
        score: BigInt(args.score),
        memoriesViewed: args.memoriesViewed,
        cluesOpened: args.cluesOpened,
        guessesUsed: args.guessesUsed,
        nonce,
      },
    });

    try {
      const hash = await client.writeContract({
        address: contractAddress,
        abi: SCORE_ABI,
        functionName: "mintScore",
        args: [
          args.playerAddress as `0x${string}`,
          BigInt(args.episodeDay),
          BigInt(args.score),
          args.memoriesViewed,
          args.cluesOpened,
          args.guessesUsed,
          signature,
        ],
      });

      return hash;
    } catch (error) {
      console.error("Failed to mint score on Mantle:", error);
      return null;
    }
  },
});

export const updateStreak = action({
  args: {
    playerAddress: v.string(),
    currentStreak: v.number(),
    bestStreak: v.number(),
    lastSolvedDay: v.number(),
    totalSolved: v.number(),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (_ctx, args) => {
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;
    const contractAddress = process.env.MANTLE_STREAK_CONTRACT as `0x${string}` | undefined;

    if (!privateKey || !contractAddress) {
      console.error("Missing DEPLOYER_PRIVATE_KEY or MANTLE_STREAK_CONTRACT");
      return null;
    }

    const account = privateKeyToAccount(privateKey);
    const client = createWalletClient({
      account,
      chain: mantleSepoliaTestnet,
      transport: http(),
    });

    const nonce = 0n;

    const signature = await account.signTypedData({
      domain: {
        name: "WhoWareStreak",
        version: "1",
        chainId: BigInt(mantleSepoliaTestnet.id),
        verifyingContract: contractAddress,
      },
      types: {
        UpdateStreak: [
          { name: "player", type: "address" },
          { name: "currentStreak", type: "uint256" },
          { name: "bestStreak", type: "uint256" },
          { name: "lastSolvedDay", type: "uint256" },
          { name: "totalSolved", type: "uint256" },
          { name: "nonce", type: "uint256" },
        ],
      },
      primaryType: "UpdateStreak",
      message: {
        player: args.playerAddress as `0x${string}`,
        currentStreak: BigInt(args.currentStreak),
        bestStreak: BigInt(args.bestStreak),
        lastSolvedDay: BigInt(args.lastSolvedDay),
        totalSolved: BigInt(args.totalSolved),
        nonce,
      },
    });

    try {
      const hash = await client.writeContract({
        address: contractAddress,
        abi: STREAK_ABI,
        functionName: "updateStreak",
        args: [
          args.playerAddress as `0x${string}`,
          BigInt(args.currentStreak),
          BigInt(args.bestStreak),
          BigInt(args.lastSolvedDay),
          BigInt(args.totalSolved),
          signature,
        ],
      });

      return hash;
    } catch (error) {
      console.error("Failed to update streak on Mantle:", error);
      return null;
    }
  },
});
