import { createWalletClient, custom, http, type Address, type Chain } from "viem";
import { baseSepolia, mantleSepoliaTestnet } from "viem/chains";
import { logger } from "./logger";
import { INCO_GUESS_ABI, encryptGuess, episodeDayFromDropsAt, INCO_GUESS_CONTRACT } from "./inco-lightning";

export const TARGET_CHAIN: Chain = mantleSepoliaTestnet;

export const WHOWARE_GUESS_CONTRACT = "0x8185762f72a6290eb4959adbd8286281131a531d" as const;

/** Base Sepolia chain for Inco Lightning (confidential guesses). */
export const INCO_CHAIN: Chain = baseSepolia;

const GUESS_ABI = [
  {
    name: "commitGuess",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "episodeDay", type: "uint256" },
      { name: "guessHash", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "revealGuess",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "episodeDay", type: "uint256" },
      { name: "guess", type: "string" },
      { name: "salt", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "getRevealedCount",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "episodeDay", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export interface WalletState {
  address: Address | null;
  isConnected: boolean;
  chainId: number | null;
  isCorrectChain: boolean;
}

export async function requestAccounts(): Promise<Address | null> {
  if (typeof window === "undefined" || !(window as any).ethereum) return null;
  try {
    const accounts = await (window as any).ethereum.request({
      method: "eth_requestAccounts",
    });
    return accounts?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function getConnectedAddress(): Promise<Address | null> {
  if (typeof window === "undefined" || !(window as any).ethereum) return null;
  try {
    const accounts = await (window as any).ethereum.request({
      method: "eth_accounts",
    });
    return accounts?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function switchToMantle(): Promise<boolean> {
  if (typeof window === "undefined" || !(window as any).ethereum) return false;
  try {
    await (window as any).ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${TARGET_CHAIN.id.toString(16)}` }],
    });
    return true;
  } catch (error: any) {
    if (error?.code === 4902) {
      try {
        await (window as any).ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${TARGET_CHAIN.id.toString(16)}`,
              chainName: TARGET_CHAIN.name,
              nativeCurrency: TARGET_CHAIN.nativeCurrency,
              rpcUrls: [TARGET_CHAIN.rpcUrls.default.http[0]],
              blockExplorerUrls: [TARGET_CHAIN.blockExplorers?.default.url],
            },
          ],
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

export async function getCurrentChainId(): Promise<number | null> {
  if (typeof window === "undefined" || !(window as any).ethereum) return null;
  try {
    const hex = await (window as any).ethereum.request({
      method: "eth_chainId",
    });
    return parseInt(hex, 16);
  } catch {
    return null;
  }
}

export function isMetaMaskAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as any).ethereum;
}

export function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function generateGuessSalt(): string {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function commitGuessOnChain(
  playerAddress: Address,
  episodeDay: number,
  guess: string,
  salt: string,
): Promise<string | null> {
  if (typeof window === "undefined" || !(window as any).ethereum) return null;

  const chainId = await getCurrentChainId();
  if (chainId !== TARGET_CHAIN.id) {
    const switched = await switchToMantle();
    if (!switched) return null;
  }

  const guessHash = await hashGuess(guess, salt);

  const client = createWalletClient({
    account: playerAddress,
    chain: TARGET_CHAIN,
    transport: custom((window as any).ethereum),
  });

  try {
    const hash = await client.writeContract({
      address: WHOWARE_GUESS_CONTRACT,
      abi: GUESS_ABI,
      functionName: "commitGuess",
      args: [BigInt(episodeDay), guessHash as `0x${string}`],
    });
    return hash;
  } catch (error) {
    logger.error("wallet.commitGuessOnChain", error);
    return null;
  }
}

export async function revealGuessOnChain(
  playerAddress: Address,
  episodeDay: number,
  guess: string,
  salt: string,
): Promise<string | null> {
  if (typeof window === "undefined" || !(window as any).ethereum) return null;

  const client = createWalletClient({
    account: playerAddress,
    chain: TARGET_CHAIN,
    transport: custom((window as any).ethereum),
  });

  try {
    const hash = await client.writeContract({
      address: WHOWARE_GUESS_CONTRACT,
      abi: GUESS_ABI,
      functionName: "revealGuess",
      args: [BigInt(episodeDay), guess, salt as `0x${string}`],
    });
    return hash;
  } catch (error) {
    logger.error("wallet.revealGuessOnChain", error);
    return null;
  }
}

async function hashGuess(guess: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(guess + salt);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "0x" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ── Inco Lightning: confidential encrypted guess ──────────────────── */

/**
 * Switch to Base Sepolia (Inco chain). Returns true if already on the
 * correct chain or the switch succeeded.
 */
export async function switchToBase(): Promise<boolean> {
  if (typeof window === "undefined" || !(window as any).ethereum) return false;
  try {
    const hex = await (window as any).ethereum.request({
      method: "eth_chainId",
    });
    if (parseInt(hex, 16) === INCO_CHAIN.id) return true;

    await (window as any).ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: `0x${INCO_CHAIN.id.toString(16)}` }],
    });
    return true;
  } catch (error: any) {
    if (error?.code === 4902) {
      try {
        await (window as any).ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: `0x${INCO_CHAIN.id.toString(16)}`,
              chainName: INCO_CHAIN.name,
              nativeCurrency: INCO_CHAIN.nativeCurrency,
              rpcUrls: [INCO_CHAIN.rpcUrls.default.http[0]],
              blockExplorerUrls: [INCO_CHAIN.blockExplorers?.default.url],
            },
          ],
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

/**
 * Submit an encrypted guess on-chain via Inco Lightning.
 *
 * Replaces the 2-tx commit-reveal flow with a single transaction:
 *   1. Encrypt the figure ID client-side via zap.encrypt()
 *   2. Submit the ciphertext to WhoWareConfidentialGuess.submitGuess()
 *
 * The contract checks e.eq(encryptedGuess, encryptedAnswer) on-chain,
 * producing an encrypted ebool result that's revealed at episode close.
 *
 * @param playerAddress  The player's wallet address
 * @param dropsAt  The episode's drop timestamp (ms) — used to derive episodeDay
 * @param figureId  The figure's numeric ID (from Convex _id, cast to number)
 * @returns  The tx hash, or null on failure
 */
export async function submitEncryptedGuess(
  playerAddress: Address,
  dropsAt: number,
  figureId: string | number,
): Promise<string | null> {
  if (typeof window === "undefined" || !(window as any).ethereum) return null;

  // Switch to Base Sepolia if needed
  const onBase = await switchToBase();
  if (!onBase) {
    logger.error("wallet.submitEncryptedGuess", "could not switch to Base Sepolia");
    return null;
  }

  try {
    const episodeDay = episodeDayFromDropsAt(dropsAt);
    const ciphertext = await encryptGuess(figureId, playerAddress);

    const client = createWalletClient({
      account: playerAddress,
      chain: INCO_CHAIN,
      transport: custom((window as any).ethereum),
    });

    const hash = await client.writeContract({
      address: INCO_GUESS_CONTRACT,
      abi: INCO_GUESS_ABI,
      functionName: "submitGuess",
      args: [BigInt(episodeDay), ciphertext],
    });

    return hash;
  } catch (error) {
    logger.error("wallet.submitEncryptedGuess", error);
    return null;
  }
}
