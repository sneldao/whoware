import { useEffect, useMemo, useState } from "react";
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
}

export interface RevealFigure {
  name: string;
  figureId?: Id<"figures">;
}

export interface UseRevealStateParams {
  episode: { _id: Id<"episodes">; figureId?: Id<"figures">; slug: string } | null | undefined;
  figures: Array<{ _id: Id<"figures">; canonicalName: string }>;
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
}

export function useRevealState(params: UseRevealStateParams): UseRevealStateReturn {
  const { episode, figures, isExhausted, identityId } = params;
  const [solvedRun, setSolvedRun] = useState<SolvedRun | null>(null);
  const [solvedFigure, setSolvedFigure] = useState<RevealFigure | null>(null);
  const [revealDismissed, setRevealDismissed] = useState(false);

  // Reset reveal state on episode or identity change.
  useEffect(() => {
    setSolvedRun(null);
    setSolvedFigure(null);
    setRevealDismissed(false);
  }, [episode?._id, identityId]);

  const revealFigure = useMemo<RevealFigure | null>(() => {
    if (solvedFigure) return solvedFigure;
    if (isExhausted && episode && "figureId" in episode && episode.figureId) {
      const f = figures.find((fig) => fig._id === episode.figureId);
      if (f) return { name: f.canonicalName, figureId: f._id };
    }
    return null;
  }, [solvedFigure, isExhausted, episode, figures]);

  return {
    solvedRun,
    setSolvedRun,
    solvedFigure,
    setSolvedFigure,
    revealDismissed,
    setRevealDismissed,
    revealFigure,
  };
}
