import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { revealGuessOnChain } from "@/lib/wallet";
import {
  getEnvironment,
  buildMintDelegation,
  getDelegationTypedData,
  signWithMetaMask,
  sendViaSmartAccount,
} from "@/lib/smart-account";

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

export interface UseOnchainMintingParams {
  wallet: ReturnType<typeof import("./use-wallet").useWallet>;
  episode: { dropsAt: number; competitiveMode?: boolean } | null | undefined;
  streak: { current: number; best: number; totalSolved: number };
  showToast: (
    message: string,
    type?: "info" | "warning" | "success" | "error",
  ) => void;
}

export interface UseOnchainMintingReturn {
  state: {
    mintTxHash: string | null;
    streakTxHash: string | null;
    isMinting: boolean;
    isStreakUpdating: boolean;
    showUpgradeOverlay: boolean;
    delegationHash: string | null;
    userOpHash: string | null;
    isDelegating: boolean;
  };
  reset: () => void;
  handleSolveOnchain: (args: SolveOnchainArgs) => Promise<void>;
  delegate: () => Promise<void>;
  setShowUpgradeOverlay: (v: boolean) => void;
}

export function useOnchainMinting(
  params: UseOnchainMintingParams,
): UseOnchainMintingReturn {
  const { wallet, episode, streak, showToast } = params;

  // State extracted from index.tsx lines 121-125, 131, 135-137
  const [mintTxHash, setMintTxHash] = useState<string | null>(null);
  const [streakTxHash, setStreakTxHash] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [isStreakUpdating, setIsStreakUpdating] = useState(false);
  const hasMintedRef = useRef(false);
  const [showUpgradeOverlay, setShowUpgradeOverlay] = useState(false);
  const [delegationHash, setDelegationHash] = useState<string | null>(null);
  const [userOpHash, setUserOpHash] = useState<string | null>(null);
  const [isDelegating, setIsDelegating] = useState(false);

  // Convex bindings from index.tsx lines 164-168
  const mintScoreOnChain = useAction(api.mantle.mintScore);
  const prepareMint = useAction(api.mantle.prepareMint);
  const updateStreakOnChain = useAction(api.mantle.updateStreak);
  const submitDelegation = useMutation(api.delegation.submitDelegation);
  const delegationManagerAddress = useQuery(
    api.delegation.getDelegationManagerAddress,
  );

  const { isUpgraded: isSmartAccountUpgraded, isUpgrading: isSmartAccountUpgrading } =
    wallet.smartAccount;

  // Upgrade overlay effects from index.tsx lines 150-162
  useEffect(() => {
    if (isSmartAccountUpgrading) {
      setShowUpgradeOverlay(true);
    }
  }, [isSmartAccountUpgrading]);

  useEffect(() => {
    if (isSmartAccountUpgraded && showUpgradeOverlay) {
      const timer = setTimeout(() => setShowUpgradeOverlay(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isSmartAccountUpgraded, showUpgradeOverlay]);

  // Reset method from index.tsx lines 214-218 (plus additional state owned by this hook)
  const reset = useCallback(() => {
    setMintTxHash(null);
    setStreakTxHash(null);
    setIsMinting(false);
    setIsStreakUpdating(false);
    hasMintedRef.current = false;
    setDelegationHash(null);
    setUserOpHash(null);
    setIsDelegating(false);
  }, []);

  // ERC-7710 delegation logic extracted from the solved branch
  const delegate = useCallback(async () => {
    if (
      !isSmartAccountUpgraded ||
      !wallet.smartAccount ||
      !delegationManagerAddress ||
      !wallet.address
    ) {
      return;
    }
    setIsDelegating(true);
    try {
      const env = getEnvironment();
      const oracleAddr =
        "0xfb8a7B42070334CB196e94E542cEA13655e2f394" as `0x${string}`;
      const scoreContract =
        "0xd6ad76bed934ea5e5b25d635fba7889e782e691a" as `0x${string}`;
      const delegation = buildMintDelegation(
        env,
        wallet.address as `0x${string}`,
        oracleAddr,
        scoreContract,
      );
      const typedData = getDelegationTypedData(delegation, env);

      const userSignature = await signWithMetaMask(
        wallet.address as `0x${string}`,
        typedData as any,
      );
      if (userSignature) {
        const signedDelegation = { ...delegation, signature: userSignature };
        const result = await submitDelegation({
          delegation: signedDelegation as any,
        });
        if (result) {
          setDelegationHash(result.txHash);
          showToast("🔑 ERC-7710 delegation granted on-chain", "success");
        }
      }
    } catch (e) {
      console.error("Delegation flow failed:", e);
    }
    setIsDelegating(false);
  }, [
    isSmartAccountUpgraded,
    wallet.smartAccount,
    wallet.address,
    delegationManagerAddress,
    submitDelegation,
    showToast,
  ]);

  // Main solve-onchain orchestrator from index.tsx lines 486-578
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
        delegationManagerAddress
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
                setUserOpHash(uoHash);
                showToast("🧠 Mint submitted via smart account", "success");
              }
              setMintTxHash(uoHash);
            } else {
              setMintTxHash(null);
            }
          })
          .catch(() => {})
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
          .catch(() => {})
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
        .catch(() => {})
        .finally(() => setIsStreakUpdating(false));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      wallet.address,
      episode,
      isSmartAccountUpgraded,
      wallet.smartAccount,
      delegationManagerAddress,
      streak,
      prepareMint,
      mintScoreOnChain,
      updateStreakOnChain,
      delegate,
      showToast,
    ],
  );

  return {
    state: {
      mintTxHash,
      streakTxHash,
      isMinting,
      isStreakUpdating,
      showUpgradeOverlay,
      delegationHash,
      userOpHash,
      isDelegating,
    },
    reset,
    handleSolveOnchain,
    delegate,
    setShowUpgradeOverlay,
  };
}
