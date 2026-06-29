import { useEffect, useRef, useState } from "react";

/**
 * Surfaces a retry affordance when a boot-time loading state stays
 * unresolved for longer than `timeoutMs`. Convex's `useQuery` returns
 * `undefined` indistinguishably for "still loading" and "errored", so
 * this hook is a pragmatic signal: if the loading state persists past
 * the threshold, treat it as a stalled request and offer retry.
 *
 * Returns `{ timedOut, retry }` where `retry` increments an internal
 * counter the caller can thread into a `useQuery` arg to force refetch
 * (most Convex hooks accept a key argument that includes arbitrary
 * dependencies).
 */
export function useBootError(
  isLoading: boolean,
  timeoutMs: number = 12_000,
): { timedOut: boolean; retry: () => void; retryCount: number } {
  const [timedOut, setTimedOut] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoading) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setTimedOut(false);
      return;
    }

    timerRef.current = setTimeout(() => setTimedOut(true), timeoutMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLoading, retryCount, timeoutMs]);

  return {
    timedOut,
    retry: () => {
      setTimedOut(false);
      setRetryCount((c) => c + 1);
    },
    retryCount,
  };
}
