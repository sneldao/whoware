import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { useCallback, useEffect, useState } from "react";

const IDENTITY_KEY = "whoware.identity.id";

interface IdentityState {
  identityId: string | null;
  isLoaded: boolean;
}

export function useIdentity() {
  const [state, setState] = useState<IdentityState>({ identityId: null, isLoaded: false });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const stored = await AsyncStorage.getItem(IDENTITY_KEY);
        if (cancelled) return;

        if (stored && stored.length >= 8 && stored.length <= 64) {
          setState({ identityId: stored, isLoaded: true });
          return;
        }

        const fresh = Crypto.randomUUID();
        await AsyncStorage.setItem(IDENTITY_KEY, fresh);
        if (!cancelled) setState({ identityId: fresh, isLoaded: true });
      } catch {
        const fallback = Crypto.randomUUID();
        if (!cancelled) setState({ identityId: fallback, isLoaded: true });
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const reset = useCallback(async () => {
    const fresh = Crypto.randomUUID();
    try {
      await AsyncStorage.setItem(IDENTITY_KEY, fresh);
    } catch {
      // ignore
    }
    setState({ identityId: fresh, isLoaded: true });
  }, []);

  /**
   * Adopt an existing server-known identity (wallet-bound recovery).
   * Used when a fresh device connects a wallet that is already linked to
   * an identity — the local UUID is replaced so streak and history follow.
   */
  const adopt = useCallback(async (identityId: string) => {
    const clean = identityId.trim();
    if (!clean || clean.length < 8 || clean.length > 64) return;
    try {
      await AsyncStorage.setItem(IDENTITY_KEY, clean);
    } catch {
      // ignore — state still updates for this session
    }
    setState({ identityId: clean, isLoaded: true });
  }, []);

  return { identityId: state.identityId, isLoaded: state.isLoaded, reset, adopt };
}
