import { useCallback, useState } from "react";
import type { UseWalletMintReturn } from "./use-wallet-mint";

export interface UsePaymentGateParams {
  /** The connected wallet state (for chain checks and address). */
  wallet: ReturnType<typeof import("./use-wallet").useWallet>;
  /**
   * Return value of `useWalletMint` — provides `isReady`, `isOnTargetChain`,
   * and the `ensureReady` guard that callers must invoke before any on-chain
   * write. `usePaymentGate` does NOT call `useWalletMint` itself; it receives
   * the return value so this hook can be tested in isolation.
   */
  walletMint: UseWalletMintReturn;
  showToast: (
    message: string,
    type?: "info" | "warning" | "success" | "error",
  ) => void;
}

export interface UsePaymentGateReturn {
  /** True while the unlock flow is in progress. */
  isUnlocking: boolean;
  /** Last error message, or null. */
  error: string | null;
  /**
   * Foundation entry point for the archive unlock flow. Validates wallet
   * readiness via `walletMint.ensureReady()`, surfaces a user-friendly toast
   * on failure, and returns whether the caller may proceed to the actual
   * `archiveUnlock` write (which is left to a future concrete implementation
   * — this hook does not broadcast any transaction itself).
   */
  unlock: () => Promise<boolean>;
  /** Clears any recorded error and busy flag. */
  reset: () => void;
}

/**
 * Thin UX glue for the archive paywall. Wires `useWalletMint`'s readiness
 * guard into a single `unlock()` callback the archive page can call from
 * its `PaywallState` machine.
 *
 * The hook does not call `useWalletMint`, `useSolveMinter`, or
 * `useSmartAccountDelegate` itself — those are passed in as params so the
 * archive page can compose them without violating the rules of hooks.
 *
 * Intentionally minimal today: real `archiveUnlock` writes will be wired
 * here as soon as the on-chain payment contract is finalised.
 */
export function usePaymentGate(
  params: UsePaymentGateParams,
): UsePaymentGateReturn {
  const { walletMint, showToast } = params;

  const [isUnlocking, setIsUnlocking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setError(null);
    setIsUnlocking(false);
  }, []);

  const unlock = useCallback(async (): Promise<boolean> => {
    setIsUnlocking(true);
    setError(null);
    try {
      if (!walletMint.ensureReady()) {
        const reason = walletMint.isOnTargetChain
          ? "Connect your wallet to continue"
          : `Switch your wallet to chain ${walletMint.chainId ?? "?"}`;
        setError(reason);
        showToast(reason, "warning");
        return false;
      }
      // Foundation: future code will build + send the `archiveUnlock` tx here.
      // The hook is wired so the archive page's PaywallState machine can call
      // `unlock()` directly without re-implementing readiness checks.
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unlock failed";
      setError(msg);
      console.error("usePaymentGate.unlock failed:", e);
      return false;
    } finally {
      setIsUnlocking(false);
    }
  }, [walletMint, showToast]);

  return { isUnlocking, error, unlock, reset };
}
