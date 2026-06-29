import { useEffect, useRef, useState } from "react";

/**
 * Surfaces a retry affordance when a boot-time loading state stays
 * unresolved for longer than `timeoutMs`. Convex's `useQuery` returns
 * `undefined` indistinguishably for "still loading" and "errored", so
 * this hook is a pragmatic signal: if the loading state persists past
 * the threshold, treat it as a stalled request and offer retry.
 *
 * Returns `{ timedOut, retry }` where `retry` increments an internal
 * counter the caller can thread into a `useQuery` arg to force refetch.
 */
export function useBootError(
  isLoading: boolean,
  timeoutMs: number = 12_000,
): { timedOut: boolean; retry: () => void; retryCount: number } {
  const [timedOut, setTimedOut] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingRef = useRef(isLoading);
  loadingRef.current = isLoading;

  useEffect(() => {
    if (!isLoading) {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      setTimedOut(false);
      return;
    }

    timerRef.current = setTimeout(() => {
      // Re-check at fire time in case loading already flipped.
      if (loadingRef.current) setTimedOut(true);
    }, timeoutMs);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
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
