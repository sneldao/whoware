import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { logger } from "@/lib/logger";

const STREAK_STORAGE_KEY = "*****************";
const DAY_MS = 86_400_000;
// streak persistence (no auth required)

export interface StreakState {
  /** Number of consecutive days solved, ending on lastSolvedDay. */
  current: number;
  /** Best streak ever achieved. */
  best: number;
  /** UTC day index (floor(ms / DAY_MS)) of the most recent solve. */
  lastSolvedDay: number;
  /** Total episodes solved all-time. */
  totalSolved: number;
}

const EMPTY_STREAK: StreakState = {
  current: 0,
  best: 0,
  lastSolvedDay: -1,
  totalSolved: 0,
};

function utcDayIndex(timestampMs: number): number {
  return Math.floor(timestampMs / DAY_MS);
}

function isStreakState(value: unknown): value is StreakState {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.current === "number" &&
    typeof record.best === "number" &&
    typeof record.lastSolvedDay === "number" &&
    typeof record.totalSolved === "number"
  );
}

/**
 * Persists a daily-solve streak locally (no auth required). The streak is
 * scoped to UTC episode days so it matches the globally synchronized release.
 * Returns the loaded streak plus a `recordSolve` callback to invoke once when
 * the player solves the active episode.
 */
export function useStreak() {
  const [streak, setStreak] = useState<StreakState>(EMPTY_STREAK);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const raw = await AsyncStorage.getItem(STREAK_STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed: unknown = JSON.parse(raw);
          if (isStreakState(parsed)) setStreak(parsed);
        }
      } catch (e) {
        logger.warn("useStreak loadStorage", e);
        // Corrupt or unavailable storage — start fresh.
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const recordSolve = useCallback(async (solvedAtMs: number): Promise<StreakState> => {
    const solvedDay = utcDayIndex(solvedAtMs);
    let next: StreakState = EMPTY_STREAK;
    setStreak((previous) => {
      // Already counted today — no change.
      if (previous.lastSolvedDay === solvedDay) {
        next = previous;
        return previous;
      }
      const continues = previous.lastSolvedDay === solvedDay - 1;
      const current = continues ? previous.current + 1 : 1;
      next = {
        current,
        best: Math.max(previous.best, current),
        lastSolvedDay: solvedDay,
        totalSolved: previous.totalSolved + 1,
      };
      return next;
    });
    try {
      await AsyncStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(next));
    } catch (e) {
      logger.warn("useStreak persist", e);
      // Best-effort persistence.
    }
    return next;
  }, []);

  return { streak, isLoaded, recordSolve };
}
