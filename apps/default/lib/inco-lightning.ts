/**
 * Inco Lightning integration for WhoWare's confidential guessing.
 *
 * This module wraps the @inco/lightning-js SDK to:
 *   1. Initialize a Lightning client (Base Sepolia testnet)
 *   2. Encrypt a figure ID before submitting on-chain
 *   3. Decrypt the correctness result after episode close
 *
 * The flow replaces the old commit-reveal scheme (2 txs) with a single
 * encrypted submission (1 tx). The answer is stored encrypted on-chain;
 * the contract checks e.eq(encryptedGuess, encryptedAnswer) → ebool;
 * the result is revealed via e.reveal at episode close.
 *
 * Web-only: the Inco SDK uses browser crypto (EIP-712 signing, Web Crypto).
 * Native mobile falls back to the legacy commit-reveal flow.
 */

import { BASE_SEPOLIA_INCO_GUESS_CONTRACT } from "./contracts";
import { logger } from "./logger";

// ABI for WhoWareConfidentialGuess — only the functions the frontend calls
export const INCO_GUESS_ABI = [
  {
    name: "submitGuess",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "episodeDay", type: "uint256" },
      { name: "ciphertext", type: "bytes" },
    ],
    outputs: [],
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
  {
    name: "hasGuessed",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "player", type: "address" },
      { name: "episodeDay", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "isRevealed",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "player", type: "address" },
      { name: "episodeDay", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export const INCO_GUESS_CONTRACT = BASE_SEPOLIA_INCO_GUESS_CONTRACT;

/** Whether Inco is available — requires a deployed contract address. */
export function isIncoEnabled(): boolean {
  return INCO_GUESS_CONTRACT !== "0x0000000000000000000000000000000000000000";
}

/** Whether Inco can run on this platform — web only (SDK uses browser crypto). */
export function isIncoPlatformSupported(): boolean {
  return typeof window !== "undefined" && typeof window.ethereum !== "undefined";
}

/**
 * Lazily-initialized Lightning client. We use dynamic import so the
 * @inco/lightning-js package never loads on native or when Inco is disabled.
 */
let lightningClient: any = null;

async function getLightning(): Promise<any> {
  if (lightningClient) return lightningClient;

  const { Lightning } = await import("@inco/lightning-js/lite");
  lightningClient = await Lightning.baseSepoliaTestnet({
    hostChainRpcUrls: ["https://sepolia.base.org"],
  });
  return lightningClient;
}

/**
 * Encrypt a figure ID (as uint256) for on-chain submission.
 *
 * @param figureId  The figure's numeric ID (from the figures table, cast to bigint)
 * @param userAddress  The player's wallet address
 * @returns  The ciphertext bytes to pass to submitGuess()
 */
export async function encryptGuess(
  figureId: string | number,
  userAddress: `0x${string}`,
): Promise<`0x${string}`> {
  const zap = await getLightning();
  const { handleTypes } = await import("@inco/lightning-js");

  const ciphertext = await zap.encrypt(BigInt(figureId), {
    accountAddress: userAddress,
    dappAddress: INCO_GUESS_CONTRACT,
    handleType: handleTypes.euint256,
  });

  return ciphertext as `0x${string}`;
}

/**
 * Decrypt the correctness result after e.reveal has been called.
 *
 * After the contract calls e.reveal(isCorrect), the handle is public.
 * Anyone can request an attested decryption — no wallet signature needed.
 *
 * @param handle  The ebool handle from the contract (obtained via readContract)
 * @returns  The decrypted boolean (true = correct guess)
 */
export async function decryptRevealedResult(handle: string): Promise<boolean> {
  const zap = await getLightning();

  const [result] = await zap.attestedReveal([handle]);
  return Boolean(result.plaintext.value);
}

/**
 * Encrypt the episode answer (curator-side).
 *
 * Called by the backend (Convex action) when an episode goes live.
 * The ciphertext is submitted to setAnswer() on the contract.
 *
 * @param figureId  The figure's numeric ID
 * @param curatorAddress  The curator's wallet address
 * @returns  The ciphertext bytes to pass to setAnswer()
 */
export async function encryptAnswer(
  figureId: string | number,
  curatorAddress: `0x${string}`,
): Promise<`0x${string}`> {
  const zap = await getLightning();
  const { handleTypes } = await import("@inco/lightning-js");

  const ciphertext = await zap.encrypt(BigInt(figureId), {
    accountAddress: curatorAddress,
    dappAddress: INCO_GUESS_CONTRACT,
    handleType: handleTypes.euint256,
  });

  return ciphertext as `0x${string}`;
}

/**
 * Convert an episode drop timestamp to an episode day number
 * (matching the existing commit-reveal scheme).
 */
export function episodeDayFromDropsAt(dropsAt: number): number {
  return Math.max(1, Math.floor(dropsAt / 86_400_000));
}

logger.info("inco-lightning.ts loaded", {
  enabled: isIncoEnabled(),
  contract: INCO_GUESS_CONTRACT,
});
