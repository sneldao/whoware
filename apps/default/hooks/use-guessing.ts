import { useCallback, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useMutation, useQuery } from "convex/react";

import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { MAX_GUESSES_PER_RUN, HOTSPOT_PENALTY, GUESS_PENALTY } from "@/convex/scoring";
import { FigureOption } from "@/components/who-ware/guess-panel";
import { useVeniceHint } from "@/hooks/use-venice-hint";
import { useGameToast } from "@/hooks/use-game-toast";
import { useRevealState, RevealFigure, SolvedRun } from "@/hooks/use-reveal-state";
import { useOnchainCommit } from "@/hooks/use-onchain-commit";
import { useLocalDiscovery } from "@/hooks/use-local-discovery";
import { generateGuessSalt } from "@/lib/wallet";
import { logger } from "@/lib/logger";
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
      gameSounds.playClueFound();
      toast.show(`−${HOTSPOT_PENALTY.toLocaleString()} pts from max score`, "warning");
      const hotspotKey = `${sceneIndex}:${label}`;
      discovery.recordHotspot(hotspotKey);

      const scene = episode.scenes[sceneIndex];
      const clue = scene?.clues.find((c) => c.label === label);
      if (clue && scene) {
        discovery.recordClue({ sceneIndex, sceneTitle: scene.title, label: clue.label, detail: clue.detail });
      }

      try {
        const activeRun = await ensureRun();
        await openHotspotMutation({ runId: activeRun._id, sceneIndex, hotspotLabel: label });
      } catch (e) {
        logger.warn("useGuessing.handleOpenHotspot", e);
      }
    },
    [episode, sceneIndex, openHotspotMutation, identity.identityId, discovery, gameSounds, toast],
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
        gameSounds.playCorrectGuess();
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

      toast.show(
        `−${GUESS_PENALTY.toLocaleString()} pts · ${result.guessesRemaining} guess${result.guessesRemaining !== 1 ? "es" : ""} left`,
        "error",
      );
      gameSounds.playWrongGuess();
      if (Platform.OS !== "web") {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      if (result.guessesRemaining <= 0) {
        setStatus("The signal fades. The archive closes around the wrong name.");
        return;
      }

      if (!hasEnteredMemory) {
        setStatus("That name does not fit yet. Open the first memory or spend another unassisted guess.");
        return;
      }

      if (hasMoreMemories()) {
        const finished = run?.status === "solved" || run?.status === "exhausted";
        let nextIdx = -1;
        for (let i = sceneIndex + 1; i < episode.scenes.length; i++) {
          const s = episode.scenes[i] as { isMercy?: boolean };
          if (!s.isMercy || finished) { nextIdx = i; break; }
        }
        if (nextIdx >= 0) {
          try {
            await enterSceneMutation({ runId: activeRun._id, sceneIndex: nextIdx });
          } catch (e) {
            logger.warn("useGuessing.handleGuess.advance", e);
          }
          setStatus("The body rejects that name. A deeper memory surfaces.");
          return;
        }
      }

      setStatus("That name does not fit. You have reached the last memory.");
    },
    [
      episode, run?.status, guessesLeft, identity.identityId, ensureRun, hasEnteredMemory,
      enterSceneMutation, wallet.address, commit, commitGuessOnChain, submitGuessMutation,
      recordSolve, saveLastSolve, memoriesViewed, hotspotsOpened, formatScore, onSolveOnchain,
      gameSounds, sceneIndex, hasMoreMemories, toast, reveal,
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
