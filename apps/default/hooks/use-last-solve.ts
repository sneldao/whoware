import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

const LAST_SOLVE_KEY = "whoware.lastSolve";

export interface LastSolve {
  episodeSlug: string;
  figureName: string;
  score: number;
  date: number;
  memoriesViewed: number;
  hotspotsOpened: number;
  guessesUsed: number;
  elapsedMs: number;
}

export function useLastSolve() {
  const [lastSolve, setLastSolve] = useState<LastSolve | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(LAST_SOLVE_KEY).then((stored) => {
      if (cancelled) return;
      if (stored) {
        try {
          setLastSolve(JSON.parse(stored));
        } catch {}
      }
      setLoaded(true);
    });
    return () => { cancelled = true; };
  }, []);

  const saveLastSolve = useCallback(async (solve: LastSolve) => {
    setLastSolve(solve);
    await AsyncStorage.setItem(LAST_SOLVE_KEY, JSON.stringify(solve));
  }, []);

  const clearLastSolve = useCallback(async () => {
    setLastSolve(null);
    await AsyncStorage.removeItem(LAST_SOLVE_KEY);
  }, []);

  return { lastSolve, loaded, saveLastSolve, clearLastSolve };
}
