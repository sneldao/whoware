import { useCallback, useEffect, useRef, useState } from "react";
import {
  COACH_COPY,
  consumeCoachTip,
  type CoachTipId,
} from "@/lib/onboarding";

const AUTO_DISMISS_MS = 7_000;

/**
 * One-shot progressive coaches. Call `offer(id)` at the moment of need;
 * a whisper message appears at most once per tip id.
 */
export function useProgressiveCoach() {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMessage(null);
  }, []);

  const offer = useCallback(async (id: CoachTipId, override?: string) => {
    const first = await consumeCoachTip(id);
    if (!first) return false;
    setMessage(override ?? COACH_COPY[id]);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setMessage(null);
      timerRef.current = null;
    }, AUTO_DISMISS_MS);
    return true;
  }, []);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { message, offer, dismiss };
}
