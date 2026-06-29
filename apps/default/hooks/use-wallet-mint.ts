import { useCallback } from "react";
import { TARGET_CHAIN } from "@/lib/wallet";
import { logger } from "@/lib/logger";

/**
 * Foundation hook for wallet / paywall on-chain operations.
 *
 * Mirrors the convention of the other on-chain hooks (object-return shape,
 * `let cancelled = false` patterns deferred to consumers) and serves as the
 * dedicated home for USDC balance / allowance checks and `archiveUnlock`
 * contract writes as those features land.
 *
 * Today it surfaces only what can be safely derived from the connected
 * wallet state — chain id, target-chain readiness, and a guard helper that
 * callers must `await` before any on-chain write so we never broadcast a
 * transaction on the wrong network.
 */
export interface UseWalletMintParams {
  wallet: ReturnType<typeof import("./use-wallet").useWallet>;
}

export interface UseWalletMintReturn {
  /** Connected wallet chain id, or null when not connected. */
  chainId: number | null;
  /** True iff the connected wallet is on `TARGET_CHAIN` (Mantle Sepolia). */
  isOnTargetChain: boolean;
  /** True iff the wallet is connected AND on the target chain. */
  isReady: boolean;
  /**
   * Returns true when the wallet is connected and on the target chain;
   * logs and returns false otherwise. Callers should invoke this before
   * any on-chain write (USDC approval, archiveUnlock pay, etc.).
   */
  ensureReady: () => boolean;
}

export function useWalletMint(
  params: UseWalletMintParams,
): UseWalletMintReturn {
  const { wallet } = params;

  const chainId = wallet.chainId;
  const isOnTargetChain = wallet.isCorrectChain;
  const isReady = !!wallet.address && isOnTargetChain;

  const ensureReady = useCallback(() => {
    if (!wallet.address) {
      logger.warn("useWalletMint.noAddress");
      return false;
    }
    if (!isOnTargetChain) {
      logger.warn(`useWalletMint.wrongChain:got=${chainId}:want=${TARGET_CHAIN.id}`);
      return false;
    }
    return true;
  }, [wallet.address, isOnTargetChain, chainId]);

  return { chainId, isOnTargetChain, isReady, ensureReady };
}
