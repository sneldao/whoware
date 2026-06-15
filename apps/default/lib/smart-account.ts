/**
 * MetaMask Smart Accounts Kit Integration
 *
 * Provides utilities to:
 * - Upgrade a user's EOA to a MetaMask Smart Account (EIP-7702)
 * - Send transactions via ERC-4337 user operations through a bundler
 * - Support ERC-7710 delegation patterns
 *
 * @metamask/smart-accounts-kit v1.6.0 + viem 2.52+
 */

import { createPublicClient, createWalletClient, http, type Address, type Chain } from "viem";
import { mantleSepoliaTestnet } from "viem/chains";
import {
  toMetaMaskSmartAccount,
  getSmartAccountsEnvironment,
  Implementation,
  type MetaMaskSmartAccount,
  type SmartAccountsEnvironment,
} from "@metamask/smart-accounts-kit";
import { createBundlerClient } from "viem/account-abstraction";

export const TARGET_CHAIN: Chain = mantleSepoliaTestnet;

// Mantle Sepolia Bundler RPC
// Note: For production, replace with a dedicated bundler service URL
const BUNDLER_RPC_URL = "https://bundler.mantle-sepolia.1rpc.io";

let _cachedEnvironment: SmartAccountsEnvironment | null = null;

/**
 * Get the Smart Accounts Kit deployment environment for Mantle Sepolia.
 * Returns contract addresses for the Delegation Framework on this chain.
 */
export function getEnvironment(): SmartAccountsEnvironment {
  if (!_cachedEnvironment) {
    _cachedEnvironment = getSmartAccountsEnvironment(mantleSepoliaTestnet.id);
  }
  return _cachedEnvironment;
}

/**
 * Create a viem public client for Mantle Sepolia.
 */
export function createMantlePublicClient() {
  return createPublicClient({
    chain: mantleSepoliaTestnet,
    transport: http(),
  });
}

/**
 * Create a viem bundler client for ERC-4337 user operations.
 * The bundler collects user operations and submits them to the network.
 */
export function createMantleBundlerClient() {
  const publicClient = createMantlePublicClient();
  return createBundlerClient({
    client: publicClient,
    transport: http(BUNDLER_RPC_URL),
  });
}

/**
 * Upgrade the user's EOA to a MetaMask Smart Account (Stateless7702).
 *
 * This wraps the user's existing MetaMask EOA into a smart account
 * that supports ERC-4337 account abstraction and ERC-7710 delegation.
 *
 * The EIP-7702 authorization is handled internally by the Smart Accounts Kit.
 *
 * @param walletClient - A viem wallet client connected to the user's MetaMask
 * @returns A MetaMaskSmartAccount instance, or null on failure
 */
export async function upgradeToSmartAccount(
  walletClient: ReturnType<typeof createWalletClient>,
): Promise<MetaMaskSmartAccount | null> {
  try {
    const publicClient = createMantlePublicClient();

    const addresses = await walletClient.getAddresses();
    const address = addresses[0];

    const smartAccount = await toMetaMaskSmartAccount({
      client: publicClient,
      implementation: Implementation.Stateless7702,
      address,
      signer: { walletClient },
    });

    return smartAccount;
  } catch (error) {
    console.error("Failed to upgrade to smart account:", error);
    return null;
  }
}

/**
 * Send a transaction through the MetaMask Smart Account.
 *
 * Uses ERC-4337 user operations submitted through a bundler,
 * demonstrating account abstraction in action.
 *
 * @param smartAccount - The MetaMaskSmartAccount instance
 * @param to - Target contract address
 * @param data - Encoded function calldata
 * @param value - ETH value to send (default: 0)
 * @returns The user operation hash, or null on failure
 */
export async function sendViaSmartAccount(
  smartAccount: MetaMaskSmartAccount,
  to: Address,
  data: `0x${string}`,
  value: bigint = 0n,
): Promise<`0x${string}` | null> {
  try {
    const bundlerClient = createMantleBundlerClient();

    const userOperationHash = await bundlerClient.sendUserOperation({
      account: smartAccount,
      calls: [
        {
          to,
          value,
          data,
        },
      ],
    });

    return userOperationHash;
  } catch (error) {
    console.error("Failed to send user operation:", error);
    return null;
  }
}

/**
 * Wait for a user operation to be confirmed on-chain.
 *
 * @param userOperationHash - Hash returned by sendViaSmartAccount
 * @returns The transaction hash on success, null on timeout/failure
 */
export async function waitForUserOperationReceipt(
  userOperationHash: `0x${string}`,
): Promise<`0x${string}` | null> {
  try {
    const bundlerClient = createMantleBundlerClient();
    const receipt = await bundlerClient.waitForUserOperationReceipt({
      hash: userOperationHash,
    });
    return receipt.receipt.transactionHash;
  } catch (error) {
    console.error("Failed to wait for user operation:", error);
    return null;
  }
}

export type { MetaMaskSmartAccount, SmartAccountsEnvironment };
