import { useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { logger } from "@/lib/logger";

interface UseWalletIdentityParams {
  identityId: string | null;
  identityLoaded: boolean;
  walletAddress: string | null;
  /** Current episode id, or null when no episode is live, undefined while loading. */
  episodeId: Id<"episodes"> | null | undefined;
  /** Replace the local identity (wallet-bound recovery on a fresh device). */
  adopt: (identityId: string) => Promise<void>;
  /** Notify the player when their identity was recovered via wallet. */
  notify?: (message: string) => void;
}

/**
 * Binds the anonymous local identity to the connected wallet so progress
 * (streak, history, runs) survives device/browser changes.
 *
 * - Wallet never linked        → link it to the current identity.
 * - Wallet linked to THIS id   → nothing to do.
 * - Wallet linked to ANOTHER id and no active local run → adopt the
 *   linked identity (recovery path on a fresh device).
 * - Wallet linked to another id but a local run is active → leave the
 *   session alone rather than yanking the rug out from under live play.
 *
 * All decisions are idempotent; a processed (identity, wallet) pair is
 * never re-run within a mount.
 */
export function useWalletIdentity({
  identityId,
  identityLoaded,
  walletAddress,
  episodeId,
  adopt,
  notify,
}: UseWalletIdentityParams): void {
  const ready =
    identityLoaded && identityId !== null && walletAddress !== null && episodeId !== undefined;

  const boundIdentity = useQuery(
    api.walletAuth.getIdentityForWallet,
    ready && identityId && walletAddress ? { walletAddress } : "skip",
  );

  // Only needed when the wallet is bound to a DIFFERENT identity: decide
  // whether it is safe to switch (no active run on the local identity).
  const needsRunCheck =
    ready && boundIdentity !== undefined && boundIdentity !== null && boundIdentity !== identityId;
  const localActiveRun = useQuery(
    api.runs.getActiveRun,
    needsRunCheck && identityId && episodeId
      ? { episodeId, identityId }
      : "skip",
  );

  const linkWallet = useMutation(api.walletAuth.linkWallet);
  const processedRef = useRef<string | null>(null);
  const linkedOnceRef = useRef(false);

  useEffect(() => {
    if (!ready || !identityId || !walletAddress) return;
    const pairKey = `${identityId}:${walletAddress.toLowerCase()}`;
    if (processedRef.current === pairKey) return;
    if (boundIdentity === undefined) return; // query still loading

    // Already bound to this exact identity — nothing to do.
    if (boundIdentity === identityId) {
      processedRef.current = pairKey;
      return;
    }

    // Bound to a different identity: adopt only when the local identity has
    // no in-flight run for the current episode (else live play is safe to keep).
    if (boundIdentity !== null) {
      if (episodeId === null || localActiveRun === null) {
        processedRef.current = pairKey;
        void adopt(boundIdentity).then(() => {
          notify?.("Wallet matched — your investigator dossier was restored.");
        });
      }
      // localActiveRun undefined → still loading; effect re-runs on resolve.
      return;
    }

    // Unbound wallet: link it to the current identity, once per pair.
    if (linkedOnceRef.current) return;
    linkedOnceRef.current = true;
    processedRef.current = pairKey;
    linkWallet({ identityId, walletAddress }).catch((e) => {
      // "Wallet already linked to another account" is benign here — a later
      // mount with that identity will take the adoption path instead.
      logger.warn("walletIdentity.link", e);
    });
  }, [
    ready,
    identityId,
    walletAddress,
    episodeId,
    boundIdentity,
    localActiveRun,
    adopt,
    linkWallet,
    notify,
  ]);
}
