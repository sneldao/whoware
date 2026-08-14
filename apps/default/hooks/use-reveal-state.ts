import { useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

/**
 * Owns the post-solve reveal state: the solved run snapshot, the
 * figure being revealed, the dismiss flag, and the derived
 * `revealFigure` (which falls back to the episode's figure when the
 * run is exhausted).
 *
 * Kept separate from `useGuessing` because the reveal surface is
 * a top-level overlay (rendered outside the scroll), so the
 * orchestrator wants a minimal handle, not a god-object.
 */
export interface SolvedRun {
  elapsedMs: number;
  score: number;
  guessesUsed?: number;
  hotspotsOpened?: number;
}

export interface RevealFigure {
  name: string;
  figureId?: Id<"figures">;
}

/** Full answer record served only to resolved runs (runs.getAnswer). */
export interface AnswerRecord {
  canonicalName: string;
  era: string;
  region: string;
  tags: string[];
  figureId: Id<"figures">;
}

export interface UseRevealStateParams {
  episode: { _id: Id<"episodes">; figureId?: Id<"figures">; slug: string } | null | undefined;
  isExhausted: boolean;
  identityId: string | undefined;
}

export interface UseRevealStateReturn {
  solvedRun: SolvedRun | null;
  setSolvedRun: (run: SolvedRun | null) => void;
  solvedFigure: RevealFigure | null;
  setSolvedFigure: (figure: RevealFigure | null) => void;
  revealDismissed: boolean;
  setRevealDismissed: (dismissed: boolean) => void;
  revealFigure: RevealFigure | null;
  /** Server-side answer record for resolved runs (survives reloads). */
  answerRecord: AnswerRecord | null;
}

export function useRevealState(params: UseRevealStateParams): UseRevealStateReturn {
  const { episode, isExhausted, identityId } = params;
  const [solvedRun, setSolvedRun] = useState<SolvedRun | null>(null);
  const [solvedFigure, setSolvedFigure] = useState<RevealFigure | null>(null);
  const [revealDismissed, setRevealDismissed] = useState(false);

  // The episode payload no longer carries the figure identity (leak fix),
  // so the exhausted reveal resolves the answer from runs.getAnswer — the
  // server only serves it once the run is solved or exhausted.
  const answer = useQuery(
    api.runs.getAnswer,
    isExhausted && episode && identityId
      ? { episodeId: episode._id, identityId }
      : "skip",
  );

  // Reset reveal state on episode or identity change.
  useEffect(() => {
    setSolvedRun(null);
    setSolvedFigure(null);
    setRevealDismissed(false);
  }, [episode?._id, identityId]);

  const answerRecord: AnswerRecord | null = useMemo(() => {
    if (!answer || answer.canonicalName === undefined) return null;
    return answer;
  }, [answer]);

  const revealFigure = useMemo<RevealFigure | null>(() => {
    if (solvedFigure) return solvedFigure;
    if (isExhausted && answerRecord) {
      return { name: answerRecord.canonicalName, figureId: answerRecord.figureId };
    }
    return null;
  }, [solvedFigure, isExhausted, answerRecord]);

  return {
    solvedRun,
    setSolvedRun,
    solvedFigure,
    setSolvedFigure,
    revealDismissed,
    setRevealDismissed,
    revealFigure,
    answerRecord,
  };
}
