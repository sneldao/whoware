import { useCallback, useState } from "react";
import { logger } from "@/lib/logger";
import { isIncoEnabled, isIncoPlatformSupported, episodeDayFromDropsAt } from "@/lib/inco-lightning";
import { submitEncryptedGuess } from "@/lib/wallet";

/**
 * Replaces the commit-reveal on-chain flow with Inco Lightning's
 * single-transaction encrypted guess.
 *
 * Old flow (useOnchainCommit):
 *   1. Player submits guess
 *   2. Salt + commit tx on Mantle (1st wallet interaction)
 *   3. Backend scores the guess
 *   4. Reveal tx on Mantle after episode close (2nd wallet interaction)
 *
 * New flow (useIncoGuess):
 *   1. Player submits guess
 *   2. Encrypt figure ID client-side, single submitGuess tx on Base (1 wallet interaction)
 *   3. Contract checks e.eq(guess, answer) → encrypted ebool
 *   4. At episode close, e.reveal makes the result publicly verifiable
 *
 * Falls back to the legacy commit-reveal flow when:
 *   - Inco is not deployed (contract address is zero)
 *   - Platform is not web (Inco SDK requires browser crypto)
 *   - The player's wallet doesn't support Base Sepolia
 */
export interface IncoGuessState {
  /** The tx hash of the encrypted guess submission, if it succeeded. */
  txHash: string | null;
  /** True while the encrypt + submit tx is in flight. */
  isSubmitting: boolean;
  /** True if the encrypted guess was successfully submitted. */
  hasSubmitted: boolean;
  /** Error message if submission failed. */
  error: string | null;
}

export interface UseIncoGuessParams {
  /** Whether the episode is in competitive mode (Inco only used in competitive). */
  competitiveMode: boolean;
  /** Episode drop timestamp (ms) — used to derive episodeDay. */
  dropsAt: number;
}

export interface UseIncoGuessReturn {
  state: IncoGuessState;
  /** Submit an encrypted guess on-chain. Returns true on success. */
  submitEncrypted: (playerAddress: `0x${string}`, figureId: string | number) => Promise<boolean>;
  /** Reset state (e.g. on episode change). */
  reset: () => void;
  /** Whether Inco is available for this session. */
  isAvailable: boolean;
}

export function useIncoGuess(params: UseIncoGuessParams): UseIncoGuessReturn {
  const { competitiveMode, dropsAt } = params;

  const [state, setState] = useState<IncoGuessState>({
    txHash: null,
    isSubmitting: false,
    hasSubmitted: false,
    error: null,
  });

  const isAvailable = isIncoEnabled() && isIncoPlatformSupported() && competitiveMode;

  const submitEncrypted = useCallback(
    async (playerAddress: `0x${string}`, figureId: string | number): Promise<boolean> => {
      if (!isAvailable) {
        logger.info("useIncoGuess.submitEncrypted", "Inco not available, skipping");
        return false;
      }

      setState((prev) => ({ ...prev, isSubmitting: true, error: null }));

      try {
        const txHash = await submitEncryptedGuess(playerAddress, dropsAt, figureId);

        if (txHash) {
          setState({
            txHash,
            isSubmitting: false,
            hasSubmitted: true,
            error: null,
          });
          logger.info("useIncoGuess.submitEncrypted", "success", { txHash });
          return true;
        } else {
          setState({
            txHash: null,
            isSubmitting: false,
            hasSubmitted: false,
            error: "Transaction failed",
          });
          return false;
        }
      } catch (error) {
        logger.error("useIncoGuess.submitEncrypted", error);
        setState({
          txHash: null,
          isSubmitting: false,
          hasSubmitted: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
        return false;
      }
    },
    [isAvailable, dropsAt],
  );

  const reset = useCallback(() => {
    setState({ txHash: null, isSubmitting: false, hasSubmitted: false, error: null });
  }, []);

  return { state, submitEncrypted, reset, isAvailable };
}
