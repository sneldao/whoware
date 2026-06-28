import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import {
  buildMintDelegation,
  getDelegationTypedData,
  getEnvironment,
  signWithMetaMask,
} from "@/lib/smart-account";

export interface UseSmartAccountDelegateParams {
  wallet: ReturnType<typeof import("./use-wallet").useWallet>;
  showToast: (
    message: string,
    type?: "info" | "warning" | "success" | "error",
  ) => void;
}

export interface UseSmartAccountDelegateReturn {
  state: {
    showUpgradeOverlay: boolean;
    delegationHash: string | null;
    userOpHash: string | null;
    isDelegating: boolean;
  };
  delegate: () => Promise<void>;
  setShowUpgradeOverlay: (v: boolean) => void;
  /**
   * Exposed so that `useSolveMinter` can record the userOpHash returned from
   * `sendViaSmartAccount` after it broadcasts the mint. The setter lives with
   * the userOpHash state for cohesion.
   */
  setUserOpHash: (hash: string | null) => void;
  /** True iff the delegation manager address has resolved from the backend. */
  hasDelegationManager: boolean;
  /**
   * Clears delegation state (`delegationHash`, `userOpHash`, `isDelegating`).
   * Composed with `useSolveMinter.reset` by callers who need the full
   * original `useOnchainMinting.reset` semantics.
   */
  reset: () => void;
}

/**
 * Owns the ERC-7710 mint delegation flow and the smart-account upgrade
 * overlay UX. When `wallet.smartAccount.isUpgrading` flips true the overlay
 * is shown; it auto-hides 4s after the upgrade completes.
 *
 * `delegate()` is invoked once per solve (by `useSolveMinter`) once the
 * smart account is upgraded. It builds an EIP-712 typed delegation, asks
 * the user to sign via MetaMask, then submits it to the backend.
 */
export function useSmartAccountDelegate(
  params: UseSmartAccountDelegateParams,
): UseSmartAccountDelegateReturn {
  const { wallet, showToast } = params;

  const [showUpgradeOverlay, setShowUpgradeOverlay] = useState(false);
  const [delegationHash, setDelegationHash] = useState<string | null>(null);
  const [userOpHash, setUserOpHash] = useState<string | null>(null);
  const [isDelegating, setIsDelegating] = useState(false);

  const submitDelegation = useMutation(api.delegation.submitDelegation);
  const delegationManagerAddress = useQuery(
    api.delegation.getDelegationManagerAddress,
  );

  const {
    isUpgraded: isSmartAccountUpgraded,
    isUpgrading: isSmartAccountUpgrading,
  } = wallet.smartAccount;

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

  const reset = useCallback(() => {
    setDelegationHash(null);
    setUserOpHash(null);
    setIsDelegating(false);
  }, []);

  return {
    state: {
      showUpgradeOverlay,
      delegationHash,
      userOpHash,
      isDelegating,
    },
    delegate,
    setShowUpgradeOverlay,
    setUserOpHash,
    hasDelegationManager: !!delegationManagerAddress,
    reset,
  };
}
