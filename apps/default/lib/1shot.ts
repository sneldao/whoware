/**
 * 1Shot Permissionless Relayer Integration
 *
 * Uses 1Shot's public relayer to execute gas-abstracted transactions.
 * Users pay gas in USDC instead of the native chain token.
 * No signup, no pre-funding, no paymaster management needed.
 */

import type { Address, Hex } from "viem";
import { logger } from "./logger";

const RELAYER_TESTNET_URL = "https://relayer.1shotapi.dev/relayers";
const RELAYER_MAINNET_URL = "https://relayer.1shotapi.com/relayers";

// Polygon Amoy USDC address
export const USDC_AMOY_ADDRESS: Address = "0x41E94EB019C0762f9Bfcf9FB1E58725BfB0e7582";

// Polygon Amoy chain ID
const AMOY_CHAIN_ID = "80002";

/**
 * Generate a unique task ID for the 1Shot relayer.
 * The relayer requires a unique 32-byte hex string to prevent duplicate submissions.
 */
function generateTaskId(): Hex {
  const bytes = new Uint8Array(32);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 32; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return "0x" + Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Send a transaction via 1Shot's Permissionless Relayer with gas paid in USDC.
 *
 * The relayer handles gas abstraction — the user pays for gas in USDC
 * tokens rather than MATIC, and 1Shot manages the operational capacity.
 * No signup or pre-funding needed.
 *
 * @param to - The target contract address
 * @param data - The encoded calldata
 * @param usdcAddress - The USDC token address (defaults to Amoy USDC)
 * @param useMainnet - Whether to use mainnet or testnet relayer
 * @returns The relayer task ID (not a transaction hash), or null on failure
 */
export async function sendVia1ShotRelayer(
  to: Address,
  data: Hex,
  usdcAddress: Address = USDC_AMOY_ADDRESS,
  useMainnet: boolean = false,
): Promise<string | null> {
  const relayerUrl = useMainnet ? RELAYER_MAINNET_URL : RELAYER_TESTNET_URL;
  const taskId = generateTaskId();

  const body = {
    jsonrpc: "2.0",
    method: "relayer_sendTransaction",
    params: [
      {
        chainId: AMOY_CHAIN_ID,
        payment: {
          type: "token",
          address: usdcAddress,
        },
        to,
        data,
        taskId,
      },
    ],
    id: 1,
  };

  try {
    const response = await fetch(relayerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      logger.error("1shot.relayerError", { status: response.status, body: await response.text() });
      return null;
    }

    const json = await response.json() as {
      result?: string;
      error?: { code: number; message: string };
    };

    if (json.error) {
      logger.error("1shot.relayerRpcError", json.error);
      return null;
    }

    return json.result ?? null;
  } catch (error) {
    logger.error("1shot.sendViaRelayer", error);
    return null;
  }
}

/**
 * Check the status of a previously submitted relayed transaction.
 *
 * @param taskId - The task ID returned by sendVia1ShotRelayer
 * @returns The status result, or null on failure
 */
export async function getRelayerStatus(
  taskId: string,
  useMainnet: boolean = false,
): Promise<{
  status: number;
  transactionHash?: string;
  blockNumber?: string;
} | null> {
  const relayerUrl = useMainnet ? RELAYER_MAINNET_URL : RELAYER_TESTNET_URL;

  const body = {
    jsonrpc: "2.0",
    method: "relayer_getStatus",
    params: [
      {
        id: taskId,
        logs: false,
      },
    ],
    id: 1,
  };

  try {
    const response = await fetch(relayerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) return null;

    const json = await response.json() as {
      result?: {
        status: number;
        receipt?: {
          transactionHash: string;
          blockNumber: string;
        };
      };
    };

    if (!json.result) return null;

    return {
      status: json.result.status,
      transactionHash: json.result.receipt?.transactionHash,
      blockNumber: json.result.receipt?.blockNumber,
    };
  } catch (error) {
    logger.error("1shot.getRelayerStatus", error);
    return null;
  }
}
