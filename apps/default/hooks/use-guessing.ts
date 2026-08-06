import { useCallback, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useMutation, useQuery } from "convex/react";

import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { MAX_GUESSES_PER_RUN, HOTSPOT_PENALTY } from "@/convex/scoring";
import { FigureOption } from "@/components/who-ware/guess-panel";
import { useVeniceHint } from "@/hooks/use-venice-hint";
import { useGameToast } from "@/hooks/use-game-toast";
import { useRevealState, RevealFigure, SolvedRun } from "@/hooks/use-reveal-state";
import { useOnchainCommit } from "@/hooks/use-onchain-commit";
import { useLocalDiscovery } from "@/hooks/use-local-discovery";
import { generateGuessSalt } from "@/lib/wallet";
import { logger } from "@/lib/logger";
import type { CoachTipId } from "@/lib/onboarding";
import type { UseGameSessionReturn } from "./use-game-session";

export interface UseGuessingParams {
  session: UseGameSessionReturn;
  sceneIndex: number;
  setSceneIndex: (i: number) => void;
  hasMoreMemories: () => boolean;
  enterSceneMutation: ReturnType<typeof useMutation<typeof api.runs.enterScene>>;
  openHotspotMutation: ReturnType<typeof useMutation<typeof api.runs.openHotspot>>;
  submitGuessMutation: ReturnType<typeof useMutation<typeof api.runs.submitGuess>>;
  ensureRun: () => Promise<NonNullable<ReturnType<typeof useQuery<typeof api.runs.getActiveRun>>>>;
  commitGuessOnChain: (address: string, day: number, guess: string, salt: string) => Promise<string | null>;
  onSolveOnchain: (args: SolveOnchainArgs) => Promise<void>;
  formatScore: (score: number) => string;
  /** Progressive coach — offer once at first wrong guess. */
  onCoachOffer?: (id: CoachTipId) => void;
  /** Soft redirect after a wrong guess when more memories exist. */
  onWrongGuessRedirect?: () => void;
}

export interface SolveOnchainArgs {
  runId: Id<"runs">;
  finalScore: number;
  figureId: Id<"figures">;
  figureName: string;
  solvedAt: number;
  guessesUsed: number;
  memoriesViewed: number;
  hotspotsOpened: number;
  commitState: { guess: string; salt: string; txHash: string | null; isCommitting: boolean; hasCommitted: boolean } | null;
}

export interface UseGuessingReturn {
  isGuessPanelOpen: boolean;
  setIsGuessPanelOpen: (v: boolean) => void;
  solvedRun: SolvedRun | null;
  status: string;
  setStatus: (s: string) => void;
  commitState: ReturnType<typeof useOnchainCommit>["commitState"];
  activeHint: string | null;
  revealDismissed: boolean;
  setRevealDismissed: (v: boolean) => void;
  isBusy: boolean;
  localHotspots: string[];
  discoveredClues: Array<{ sceneIndex: number; sceneTitle: string; label: string; detail: string }>;
  solvedFigure: RevealFigure | null;
  toastVisible: boolean;
  toastMessage: string;
  toastType: "info" | "warning" | "success" | "error";
  figureOptions: FigureOption[];
  revealFigure: RevealFigure | null;
  handleGuessNow: () => Promise<void>;
  handleOpenHotspot: (label: string) => Promise<void>;
  handleGuess: (guessText: string, figureId: string, playerName: string) => Promise<void>;
  handleGenerateHint: (clueLabel: string) => Promise<void>;
  showToast: (message: string, type?: "info" | "warning" | "success" | "error") => void;
  isHintGenerating: boolean;
}

const guessCap = MAX_GUESSES_PER_RUN;

/**
 * Composes the guessing flow for a single run: toast state, reveal
 * state, on-chain commit, local discovery, hint generation, and the
 * user actions (open hotspot, submit guess, guess without memory).
 *
 * The sub-hooks own the data; this hook is the action orchestrator
 * that wires them together and exposes a single return shape to
 * the GameDashboard.
 */
export function useGuessing(params: UseGuessingParams): UseGuessingReturn {
  const {
    session,
    sceneIndex,
    enterSceneMutation,
    openHotspotMutation,
    submitGuessMutation,
    ensureRun,
    commitGuessOnChain,
    onSolveOnchain,
    formatScore,
    hasMoreMemories,
    onCoachOffer,
    onWrongGuessRedirect,
  } = params;

  // Derive from session
  const episode = session.episode;
  const run = session.run;
  const figures = session.figures;
  const identity = session.identity;
  const wallet = session.wallet;
  const gameSounds = session.gameSounds;
  const recordSolve = session.recordSolve;
  const saveLastSolve = session.saveLastSolve;

  const isExhausted = run?.status === "exhausted";
  const hasEnteredMemory = (run?.memoriesViewed ?? 0) > 0;
  const guessesUsed = run?.guessesUsed ?? 0;
  const guessesLeft = Math.max(0, guessCap - guessesUsed);
  const memoriesViewed = run?.memoriesViewed ?? 0;

  // Local component state
  const [isGuessPanelOpen, setIsGuessPanelOpen] = useState(false);
  const [status, setStatus] = useState("You open your eyes in another life. Enter the first memory when you are ready.");
  const [isBusy, setIsBusy] = useState(false);
  const [activeHint, setActiveHint] = useState<string | null>(null);

  // Composed sub-hooks
  const toast = useGameToast();
  const reveal = useRevealState({
    episode,
    figures,
    isExhausted,
    identityId: identity.identityId,
  });
  const commit = useOnchainCommit();
  const discovery = useLocalDiscovery(episode?._id, identity.identityId);

  // Derived
  const hotspotsOpened = run?.hotspotsOpened ?? discovery.localHotspots.length;

  // Venice hint hook
  const { getHint, isGenerating: isHintGenerating } = useVeniceHint();

  // figureOptions memo
  const figureOptions = useMemo<FigureOption[]>(
    () =>
      figures.map((f) => ({
        figureId: f._id,
        displayName: f.canonicalName,
      })),
    [figures],
  );

  // handleGuessNow callback
  const handleGuessNow = useCallback(async () => {
    if (!episode || isBusy) return;
    setIsBusy(true);
    try {
      await ensureRun();
      setIsGuessPanelOpen((current) => !current);
      setStatus("You can name the identity before opening a memory. Unassisted solves keep the highest score ceiling.");
    } catch (e) {
      logger.warn("useGuessing.handleGuessNow", e);
    } finally {
      setIsBusy(false);
    }
  }, [episode, isBusy, ensureRun]);

  // handleOpenHotspot callback
  const handleOpenHotspot = useCallback(
    async (label: string) => {
      if (!episode) return;
      const scene = episode.scenes[sceneIndex];
      const clue = scene?.clues.find((c) => c.label === label);
      const xPercent = clue?.x ?? 50;
      gameSounds.playClueFoundAt(xPercent);
      const hotspotKey = `${sceneIndex}:${label}`;
      discovery.recordHotspot(hotspotKey);

      if (clue && scene) {
        const firstClue = discovery.discoveredClues.length === 0;
        discovery.recordClue({ sceneIndex, sceneTitle: scene.title, label: clue.label, detail: clue.detail });
        toast.show(
          firstClue
            ? `Clue: ${clue.label} · −${HOTSPOT_PENALTY.toLocaleString()} pts · restraint scores higher`
            : `Clue: ${clue.label} · −${HOTSPOT_PENALTY.toLocaleString()} pts`,
          "success",
        );
      } else {
        toast.show(
          `Clue found · −${HOTSPOT_PENALTY.toLocaleString()} pts`,
          "success",
        );
      }

      try {
        const activeRun = await ensureRun();
        await openHotspotMutation({ runId: activeRun._id, sceneIndex, hotspotLabel: label });
      } catch (e) {
        logger.warn("useGuessing.handleOpenHotspot", e);
      }
    },
    [episode, sceneIndex, openHotspotMutation, ensureRun, discovery, gameSounds, toast],
  );

  // handleGenerateHint
  const handleGenerateHint = useCallback(
    async (clueLabel: string) => {
      if (!episode) return;
      const currentScene = episode.scenes[sceneIndex] ?? episode.scenes[0];
      if (!currentScene) return;
      setActiveHint(null);
      const hint = await getHint({
        sceneAmbientText: currentScene.ambientText,
        clueLabel,
        sceneLocation: currentScene.location,
        sceneEra: currentScene.era,
      });
      setActiveHint(hint);
    },
    [episode, sceneIndex, getHint],
  );

  // handleGuess
  const handleGuess = useCallback(
    async (_guessText: string, _figureId: string, submittedPlayerName: string) => {
      if (!episode || run?.status === "solved" || guessesLeft <= 0 || !identity.identityId) return;

      const figureId = _figureId as Id<"figures">;
      const activeRun = await ensureRun();

      if (!hasEnteredMemory) {
        await enterSceneMutation({ runId: activeRun._id, sceneIndex: 0 });
      }

      // Commit-reveal: commit guess on-chain before submitting (competitive mode)
      if (episode.competitiveMode && wallet.address && !commit.hasCommitted) {
        const salt = generateGuessSalt();
        commit.beginCommit(_guessText, salt);
        const episodeDay = Math.max(1, Math.floor(episode.dropsAt / 86400000));
        const txHash = await commitGuessOnChain(wallet.address, episodeDay, _guessText, salt);
        commit.finishCommit(txHash);
        if (!txHash) {
          setStatus("Could not commit guess on-chain. Check your wallet connection and try again.");
          return;
        }
      }

      const result = await submitGuessMutation({
        runId: activeRun._id,
        figureId,
        playerName: submittedPlayerName,
        walletAddress: wallet.address ?? undefined,
      });

      if (result.isCorrect) {
        setIsGuessPanelOpen(false);
        gameSounds.playSolveMotif(episode.scenes[0]?.era ?? "");
        if (Platform.OS !== "web") {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        const solvedAt = Date.now();
        await recordSolve(solvedAt);
        const finalScore = result.score ?? 0;
        reveal.setSolvedRun({ elapsedMs: result.elapsedMs, score: finalScore });
        reveal.setSolvedFigure({ name: result.answer ?? "Unknown", figureId });
        saveLastSolve({
          episodeSlug: episode.slug,
          figureName: result.answer ?? "Unknown",
          score: finalScore,
          date: Date.now(),
          memoriesViewed,
          hotspotsOpened,
          guessesUsed: result.guessesUsed,
          elapsedMs: result.elapsedMs,
        });
        const identityLabel = result.answer ?? "the figure";
        toast.show(`✅ Solved! ${formatScore(finalScore)} pts`, "success");
        setStatus(`Identity anchored — you were ${identityLabel}. Final score: ${formatScore(finalScore)}.`);

        // Mint/delegation/streak orchestration (delegated to useSolveMinter)
        await onSolveOnchain({
          runId: activeRun._id,
          finalScore,
          figureId,
          figureName: result.answer ?? "Unknown",
          solvedAt,
          guessesUsed: result.guessesUsed,
          memoriesViewed: activeRun.memoriesViewed,
          hotspotsOpened,
          commitState: commit.commitState?.hasCommitted ? commit.commitState : null,
        });
        return;
      }

      // Wrong guess — use proximity feedback tier instead of generic penalty text
      const isClose = result.proximity === "same_era" || result.proximity === "same_region" || result.proximity === "same_era_and_region" || result.proximity === "same_century";
      toast.show(
        result.proximityMessage,
        isClose ? "warning" : "error",
      );
      onCoachOffer?.("wrongGuess");
      gameSounds.playWrongGuess();
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      if (result.guessesRemaining <= 0) {
        setStatus("The signal fades. The archive closes around the wrong name.");
        return;
      }

      if (!hasEnteredMemory) {
        setStatus(`${result.proximityMessage} Open the first memory or spend another unassisted guess.`);
        return;
      }

      if (hasMoreMemories()) {
        onWrongGuessRedirect?.();
        setStatus(`${result.proximityMessage} Another memory might help.`);
        return;
      }

      setStatus(result.proximityMessage);
    },
    [
      episode, run?.status, guessesLeft, identity.identityId, ensureRun, hasEnteredMemory,
      wallet.address, commit, commitGuessOnChain, submitGuessMutation,
      recordSolve, saveLastSolve, memoriesViewed, hotspotsOpened, formatScore, onSolveOnchain,
      gameSounds, hasMoreMemories, toast, reveal, onCoachOffer, onWrongGuessRedirect,
    ],
  );

  return {
    isGuessPanelOpen,
    setIsGuessPanelOpen,
    solvedRun: reveal.solvedRun,
    status,
    setStatus,
    commitState: commit.commitState,
    activeHint,
    revealDismissed: reveal.revealDismissed,
    setRevealDismissed: reveal.setRevealDismissed,
    isBusy,
    localHotspots: discovery.localHotspots,
    discoveredClues: discovery.discoveredClues,
    solvedFigure: reveal.solvedFigure,
    toastVisible: toast.visible,
    toastMessage: toast.message,
    toastType: toast.type,
    figureOptions,
    revealFigure: reveal.revealFigure,
    handleGuessNow,
    handleOpenHotspot,
    handleGuess,
    handleGenerateHint,
    showToast: toast.show,
    isHintGenerating,
  };
}
