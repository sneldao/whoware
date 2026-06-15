import { action, query } from "./_generated/server";
import { v } from "convex/values";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
} from "viem";
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
  {
    name: "nonces",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
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
  {
    name: "nonces",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const MANTLE_RPC =
  process.env.MANTLE_RPC_URL ?? mantleSepoliaTestnet.rpcUrls.default.http[0];

function getPublicClient() {
  return createPublicClient({
    chain: mantleSepoliaTestnet,
    transport: http(MANTLE_RPC),
  });
}

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
    const walletClient = createWalletClient({
      account,
      chain: mantleSepoliaTestnet,
      transport: http(MANTLE_RPC),
    });
    const publicClient = getPublicClient();
    const player = args.playerAddress as Address;

    let nonce = 0n;
    try {
      nonce = (await publicClient.readContract({
        address: contractAddress,
        abi: SCORE_ABI,
        functionName: "nonces",
        args: [player],
      })) as bigint;
    } catch (error) {
      console.error("Failed to read on-chain nonce:", error);
      return null;
    }

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
        player,
        episodeDay: BigInt(args.episodeDay),
        score: BigInt(args.score),
        memoriesViewed: args.memoriesViewed,
        cluesOpened: args.cluesOpened,
        guessesUsed: args.guessesUsed,
        nonce,
      },
    });

    try {
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: SCORE_ABI,
        functionName: "mintScore",
        args: [
          player,
          BigInt(args.episodeDay),
          BigInt(args.score),
          args.memoriesViewed,
          args.cluesOpened,
          args.guessesUsed,
          signature,
        ],
      });

      await publicClient.waitForTransactionReceipt({ hash });
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
    const walletClient = createWalletClient({
      account,
      chain: mantleSepoliaTestnet,
      transport: http(MANTLE_RPC),
    });
    const publicClient = getPublicClient();
    const player = args.playerAddress as Address;

    let nonce = 0n;
    try {
      nonce = (await publicClient.readContract({
        address: contractAddress,
        abi: STREAK_ABI,
        functionName: "nonces",
        args: [player],
      })) as bigint;
    } catch (error) {
      console.error("Failed to read on-chain nonce:", error);
      return null;
    }

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
        player,
        currentStreak: BigInt(args.currentStreak),
        bestStreak: BigInt(args.bestStreak),
        lastSolvedDay: BigInt(args.lastSolvedDay),
        totalSolved: BigInt(args.totalSolved),
        nonce,
      },
    });

    try {
      const hash = await walletClient.writeContract({
        address: contractAddress,
        abi: STREAK_ABI,
        functionName: "updateStreak",
        args: [
          player,
          BigInt(args.currentStreak),
          BigInt(args.bestStreak),
          BigInt(args.lastSolvedDay),
          BigInt(args.totalSolved),
          signature,
        ],
      });

      await publicClient.waitForTransactionReceipt({ hash });
      return hash;
    } catch (error) {
      console.error("Failed to update streak on Mantle:", error);
      return null;
    }
  },
});

const GUESS_CONTRACT = process.env.MANTLE_GUESS_CONTRACT ?? "0x8185762f72a6290eb4959adbd8286281131a531d";

const GUESS_ABI = [
  {
    name: "getRevealedCount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "episodeDay", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getRevealedGuess",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "episodeDay", type: "uint256" },
      { name: "index", type: "uint256" },
    ],
    outputs: [
      { name: "player", type: "address" },
      { name: "guess", type: "string" },
      { name: "revealedAt", type: "uint256" },
    ],
  },
] as const;

export const getRevealedGuessCount = query({
  args: { episodeDay: v.number() },
  returns: v.number(),
  handler: async (_ctx, args) => {
    const client = createPublicClient({
      chain: mantleSepoliaTestnet,
      transport: http(process.env.MANTLE_RPC_URL ?? mantleSepoliaTestnet.rpcUrls.default.http[0]),
    });
    try {
      return await client.readContract({
        address: GUESS_CONTRACT as Address,
        abi: GUESS_ABI,
        functionName: "getRevealedCount",
        args: [BigInt(args.episodeDay)],
      }) as bigint;
    } catch {
      return 0;
    }
  },
});

export const getRevealedGuesses = query({
  args: { episodeDay: v.number() },
  returns: v.array(
    v.object({
      player: v.string(),
      guess: v.string(),
      revealedAt: v.number(),
    }),
  ),
  handler: async (_ctx, args) => {
    const client = createPublicClient({
      chain: mantleSepoliaTestnet,
      transport: http(process.env.MANTLE_RPC_URL ?? mantleSepoliaTestnet.rpcUrls.default.http[0]),
    });
    try {
      const count = (await client.readContract({
        address: GUESS_CONTRACT as Address,
        abi: GUESS_ABI,
        functionName: "getRevealedCount",
        args: [BigInt(args.episodeDay)],
      })) as bigint;

      const results = [];
      for (let i = 0n; i < count; i++) {
        const result = (await client.readContract({
          address: GUESS_CONTRACT as Address,
          abi: GUESS_ABI,
          functionName: "getRevealedGuess",
          args: [BigInt(args.episodeDay), i],
        })) as [Address, string, bigint];
        results.push({
          player: result[0],
          guess: result[1],
          revealedAt: Number(result[2]),
        });
      }
      return results;
    } catch {
      return [];
    }
  },
});
