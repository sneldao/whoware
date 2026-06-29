import { useCallback, useState } from "react";
import { createWalletClient, custom, type Address } from "viem";
import { mantleSepoliaTestnet } from "viem/chains";
import {
  upgradeToSmartAccount,
  sendViaSmartAccount,
  type MetaMaskSmartAccount,
} from "@/lib/smart-account";
import { logger } from "@/lib/logger";

interface SmartAccountState {
  smartAccount: MetaMaskSmartAccount | null;
  isUpgraded: boolean;
  isUpgrading: boolean;
  error: string | null;
}

/**
 * Hook to manage MetaMask Smart Account lifecycle.
 *
 * Upgrades the user's EOA to a MetaMask Smart Account (ERC-7710 + EIP-7702)
 * and provides methods to interact with the smart account.
 */
export function useSmartAccount() {
  const [state, setState] = useState<SmartAccountState>({
    smartAccount: null,
    isUpgraded: false,
    isUpgrading: false,
    error: null,
  });

  /**
   * Upgrade the user's MetaMask EOA to a Smart Account.
   * Requires MetaMask to be connected.
   */
  const upgrade = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      setState((prev) => ({ ...prev, error: "MetaMask not available" }));
      return false;
    }

    setState((prev) => ({ ...prev, isUpgrading: true, error: null }));

    try {
      const walletClient = createWalletClient({
        chain: mantleSepoliaTestnet,
        transport: custom((window as any).ethereum),
      });

      const smartAccount = await upgradeToSmartAccount(walletClient);

      if (!smartAccount) {
        setState((prev) => ({
          ...prev,
          isUpgrading: false,
          error: "Failed to upgrade to smart account. Make sure MetaMask is on Mantle Sepolia.",
        }));
        return false;
      }

      setState({
        smartAccount,
        isUpgraded: true,
        isUpgrading: false,
        error: null,
      });

      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setState((prev) => ({
        ...prev,
        isUpgrading: false,
        error: message,
      }));
      return false;
    }
  }, []);

  /**
   * Send a transaction via the smart account (using ERC-4337 user operation).
   * Only works after the account has been upgraded.
   */
  const sendTransaction = useCallback(
    async (
      to: Address,
      data: `0x${string}`,
      value: bigint = 0n,
    ): Promise<`0x${string}` | null> => {
      if (!state.smartAccount) {
        logger.warn("useSmartAccount.sendTransaction.noAccount");
        return null;
      }

      return sendViaSmartAccount(state.smartAccount, to, data, value);
    },
    [state.smartAccount],
  );

  /**
   * Reset the smart account state (e.g., on wallet disconnect).
   */
  const reset = useCallback(() => {
    setState({
      smartAccount: null,
      isUpgraded: false,
      isUpgrading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    upgrade,
    sendTransaction,
    reset,
  };
}
