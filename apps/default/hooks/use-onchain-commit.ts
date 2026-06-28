import { useCallback, useState } from "react";

/**
 * Owns the commit-reveal on-chain flow for competitive-mode guesses.
 *
 * The flow:
 *  1. Player submits a guess.
 *  2. We salt it, sign the commitment on-chain (returns a tx hash).
 *  3. We attach the tx hash to the run before reveal.
 *
 * State is reset to `null` when the user navigates away or the
 * episode changes (handled by the caller).
 */
export interface CommitState {
  guess: string;
  salt: string;
  txHash: string | null;
  isCommitting: boolean;
  hasCommitted: boolean;
}

export interface UseOnchainCommitReturn {
  commitState: CommitState | null;
  beginCommit: (guess: string, salt: string) => void;
  finishCommit: (txHash: string | null) => void;
  reset: () => void;
  hasCommitted: boolean;
  forGuess: (guessText: string) => CommitState | null;
}

export function useOnchainCommit(): UseOnchainCommitReturn {
  const [commitState, setCommitState] = useState<CommitState | null>(null);

  const beginCommit = useCallback((guess: string, salt: string) => {
    setCommitState({ guess, salt, txHash: null, isCommitting: true, hasCommitted: false });
  }, []);

  const finishCommit = useCallback((txHash: string | null) => {
    setCommitState((prev) => prev ? { ...prev, txHash, isCommitting: false, hasCommitted: !!txHash } : null);
  }, []);

  const reset = useCallback(() => {
    setCommitState(null);
  }, []);

  const hasCommitted = !!commitState?.hasCommitted;
  const forGuess = useCallback((guessText: string) => {
    return commitState?.hasCommitted && commitState.guess === guessText ? commitState : null;
  }, [commitState]);

  return { commitState, beginCommit, finishCommit, reset, hasCommitted, forGuess };
}
