import { useCallback, useRef, useState } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { revealGuessOnChain } from "@/lib/wallet";
import { sendViaSmartAccount } from "@/lib/smart-account";
import { logger } from "@/lib/logger";

/**
 * Arguments required to commit a solve on-chain. The guesser supplies these
 * from its own state when it invokes `handleSolveOnchain`.
 */
export interface SolveOnchainArgs {
  runId: Id<"runs">;
  finalScore: number;
  figureId: Id<"figures">;
  figureName: string;
  solvedAt: number;
  guessesUsed: number;
  memoriesViewed: number;
  hotspotsOpened: number;
  commitState: {
    guess: string;
    salt: string;
    txHash: string | null;
    isCommitting: boolean;
    hasCommitted: boolean;
  } | null;
}

export interface UseSolveMinterParams {
  wallet: ReturnType<typeof import("./use-wallet").useWallet>;
  episode: { dropsAt: number; competitiveMode?: boolean } | null | undefined;
  streak: { current: number; best: number; totalSolved: number };
  showToast: (
    message: string,
    type?: "info" | "warning" | "success" | "error",
  ) => void;
  /**
   * ERC-7710 delegation callback owned by `useSmartAccountDelegate`.
   * Invoked once per solve when the smart account is upgraded and a
   * delegation manager address has resolved.
   */
  delegate: () => Promise<void>;
  /** True iff the delegation manager address has resolved from the backend. */
  hasDelegationManager: boolean;
  /**
   * Setter for the userOpHash owned by `useSmartAccountDelegate`. Only
   * invoked when the smart-account path actually broadcasts a user op.
   */
  setUserOpHash?: (hash: string | null) => void;
}

export interface UseSolveMinterReturn {
  state: {
    mintTxHash: string | null;
    streakTxHash: string | null;
    isMinting: boolean;
    isStreakUpdating: boolean;
  };
  reset: () => void;
  handleSolveOnchain: (args: SolveOnchainArgs) => Promise<void>;
}

/**
 * Orchestrates the on-chain solve commit:
 *   1. reveal on-chain if the episode is competitive and we previously committed,
 *   2. ERC-7710 delegate if the smart account is upgraded,
 *   3. submit the score via the smart account OR the EOA,
 *   4. submit the streak update.
 *
 * State machine: `isMinting` / `isStreakUpdating` flip true while the
 * corresponding Convex action is in-flight and resolve to a tx hash. The
 * hook guards re-entry with `hasMintedRef`.
 */
export function useSolveMinter(
  params: UseSolveMinterParams,
): UseSolveMinterReturn {
  const {
    wallet,
    episode,
    streak,
    showToast,
    delegate,
    hasDelegationManager,
    setUserOpHash,
  } = params;

  const [mintTxHash, setMintTxHash] = useState<string | null>(null);
  const [streakTxHash, setStreakTxHash] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [isStreakUpdating, setIsStreakUpdating] = useState(false);
  const hasMintedRef = useRef(false);

  const mintScoreOnChain = useAction(api.mantle.mintScore);
  const prepareMint = useAction(api.mantle.prepareMint);
  const updateStreakOnChain = useAction(api.mantle.updateStreak);

  const { isUpgraded: isSmartAccountUpgraded } = wallet.smartAccount;

  const reset = useCallback(() => {
    setMintTxHash(null);
    setStreakTxHash(null);
    setIsMinting(false);
    setIsStreakUpdating(false);
    hasMintedRef.current = false;
  }, []);

  const handleSolveOnchain = useCallback(
    async (args: SolveOnchainArgs) => {
      if (!wallet.address || !episode || hasMintedRef.current) {
        return;
      }

      hasMintedRef.current = true;
      const episodeDay = Math.max(1, Math.floor(episode.dropsAt / 86400000));

      // Reveal on-chain if competitive mode and we committed
      if (
        episode.competitiveMode &&
        args.commitState?.hasCommitted &&
        wallet.address
      ) {
        await revealGuessOnChain(
          wallet.address,
          episodeDay,
          args.commitState.guess,
          args.commitState.salt,
        );
      }

      // ERC-7710 delegation
      if (
        isSmartAccountUpgraded &&
        wallet.smartAccount &&
        hasDelegationManager
      ) {
        await delegate();
      }

      setIsMinting(true);
      const smartAccountObj = wallet.smartAccount.smartAccount;
      if (isSmartAccountUpgraded && smartAccountObj) {
        prepareMint({
          playerAddress: wallet.address,
          episodeDay,
          score: args.finalScore,
          memoriesViewed: args.memoriesViewed,
          cluesOpened: args.hotspotsOpened,
          guessesUsed: args.guessesUsed,
        })
          .then(async (prepared) => {
            if (prepared) {
              const uoHash = await sendViaSmartAccount(
                smartAccountObj,
                prepared.to as `0x${string}`,
                prepared.data as `0x${string}`,
              );
              if (uoHash) {
                setUserOpHash?.(uoHash);
                showToast("🧠 Mint submitted via smart account", "success");
              }
              setMintTxHash(uoHash);
            } else {
              setMintTxHash(null);
            }
          })
          .catch((e) => logger.error("useSolveMinter.mintScore.smartAccount", e))
          .finally(() => setIsMinting(false));
      } else {
        mintScoreOnChain({
          playerAddress: wallet.address,
          episodeDay,
          score: args.finalScore,
          memoriesViewed: args.memoriesViewed,
          cluesOpened: args.hotspotsOpened,
          guessesUsed: args.guessesUsed,
        })
          .then((txHash) => {
            setMintTxHash(txHash);
          })
          .catch((e) => {
            logger.error("useSolveMinter.mintScore.eoa", e);
            showToast("Mint failed. Score not recorded on-chain.", "error");
          })
          .finally(() => setIsMinting(false));
      }

      setIsStreakUpdating(true);
      updateStreakOnChain({
        playerAddress: wallet.address,
        currentStreak: streak.current,
        bestStreak: streak.best,
        lastSolvedDay: Math.floor(args.solvedAt / 86400000),
        totalSolved: streak.totalSolved,
      })
        .then((txHash) => {
          setStreakTxHash(txHash);
        })
        .catch((e) => {
          logger.error("useSolveMinter.updateStreak", e);
          showToast("Streak update failed.", "error");
        })
        .finally(() => setIsStreakUpdating(false));
    },
    [
      wallet.address,
      episode,
      isSmartAccountUpgraded,
      wallet.smartAccount,
      hasDelegationManager,
      streak,
      prepareMint,
      mintScoreOnChain,
      updateStreakOnChain,
      delegate,
      setUserOpHash,
      showToast,
      // revealGuessOnChain and sendViaSmartAccount are stable module-level
      // imports — deliberately omitted from the dep array.
    ],
  );

  return {
    state: {
      mintTxHash,
      streakTxHash,
      isMinting,
      isStreakUpdating,
    },
    reset,
    handleSolveOnchain,
  };
}
