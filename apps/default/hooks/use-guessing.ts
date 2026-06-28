import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useMutation, useQuery } from "convex/react";

import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { MAX_GUESSES_PER_RUN, HOTSPOT_PENALTY, GUESS_PENALTY } from "@/convex/scoring";
import { FigureOption } from "@/components/who-ware/guess-panel";
import { useVeniceHint } from "@/hooks/use-venice-hint";
import { generateGuessSalt } from "@/lib/wallet";
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
  solvedRun: { elapsedMs: number; score: number } | null;
  status: string;
  setStatus: (s: string) => void;
  commitState: { guess: string; salt: string; txHash: string | null; isCommitting: boolean; hasCommitted: boolean } | null;
  activeHint: string | null;
  revealDismissed: boolean;
  setRevealDismissed: (v: boolean) => void;
  isBusy: boolean;
  localHotspots: string[];
  discoveredClues: Array<{ sceneIndex: number; sceneTitle: string; label: string; detail: string }>;
  solvedFigure: { name: string; figureId?: Id<"figures"> } | null;
  toastVisible: boolean;
  toastMessage: string;
  toastType: "info" | "warning" | "success" | "error";
  figureOptions: FigureOption[];
  revealFigure: { name: string; figureId?: Id<"figures"> } | null;
  handleGuessNow: () => Promise<void>;
  handleOpenHotspot: (label: string) => Promise<void>;
  handleGuess: (guessText: string, figureId: string, playerName: string) => Promise<void>;
  handleGenerateHint: (clueLabel: string) => Promise<void>;
  showToast: (message: string, type?: "info" | "warning" | "success" | "error") => void;
  isHintGenerating: boolean;
}

const guessCap = MAX_GUESSES_PER_RUN;

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
  const playerName = session.playerName;

  const isSolved = run?.status === "solved";
  const isExhausted = run?.status === "exhausted";
  const hasEnteredMemory = (run?.memoriesViewed ?? 0) > 0;
  const guessesUsed = run?.guessesUsed ?? 0;
  const guessesLeft = Math.max(0, guessCap - guessesUsed);
  const memoriesViewed = run?.memoriesViewed ?? 0;

  // State (extracted from GameContent, index.tsx lines 109, 111-112, 114, 116-118, 121, 122-124, 126, 127)
  const [isGuessPanelOpen, setIsGuessPanelOpen] = useState(false);
  const [solvedRun, setSolvedRun] = useState<{ elapsedMs: number; score: number } | null>(null);
  const [status, setStatus] = useState("You open your eyes in another life. Enter the first memory when you are ready.");
  const [commitState, setCommitState] = useState<{
    guess: string;
    salt: string;
    txHash: string | null;
    isCommitting: boolean;
    hasCommitted: boolean;
  } | null>(null);
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [localHotspots, setLocalHotspots] = useState<string[]>([]);
  const [discoveredClues, setDiscoveredClues] = useState<Array<{ sceneIndex: number; sceneTitle: string; label: string; detail: string }>>([]);
  const [revealDismissed, setRevealDismissed] = useState(false);
  const [solvedFigure, setSolvedFigure] = useState<{ name: string; figureId?: Id<"figures"> } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"info" | "warning" | "success" | "error">("info");

  // Derived
  const hotspotsOpened = run?.hotspotsOpened ?? localHotspots.length;

  // Venice hint hook
  const { getHint, isGenerating: isHintGenerating } = useVeniceHint();

  // showToast (index.tsx lines 129-134)
  function showToast(message: string, type: "info" | "warning" | "success" | "error" = "info") {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  }

  // Episode-change reset effect (index.tsx lines 218-230)
  useEffect(() => {
    setIsGuessPanelOpen(false);
    setSolvedRun(null);
    setActiveHint(null);
    setLocalHotspots([]);
    setDiscoveredClues([]);
    setRevealDismissed(false);
    setSolvedFigure(null);
    setCommitState(null);
    setStatus("You open your eyes in another life. Enter the first memory when you are ready.");
  }, [episode?._id, identity.identityId]);

  // figureOptions memo (index.tsx lines 248-254)
  const figureOptions = useMemo<FigureOption[]>(
    () =>
      figures.map((f: { _id: Id<"figures">; canonicalName: string }) => ({
        figureId: f._id,
        displayName: f.canonicalName,
      })),
    [figures],
  );

  // revealFigure memo (index.tsx lines 256-263)
  const revealFigure = useMemo(() => {
    if (solvedFigure) return solvedFigure;
    if (isExhausted && episode && "figureId" in episode && episode.figureId) {
      const f = figures.find((fig) => fig._id === episode.figureId);
      if (f) return { name: f.canonicalName, figureId: f._id };
    }
    return null;
  }, [solvedFigure, isExhausted, episode, figures]);

  // handleGuessNow callback (index.tsx lines 362-374)
  const handleGuessNow = useCallback(async () => {
    if (!episode || isBusy) return;
    setIsBusy(true);
    try {
      await ensureRun();
      setIsGuessPanelOpen((current) => !current);
      setStatus("You can name the identity before opening a memory. Unassisted solves keep the highest score ceiling.");
    } catch {
      // ignore
    } finally {
      setIsBusy(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episode, isBusy, playerName]);

  // handleOpenHotspot callback (index.tsx lines 376-393)
  const handleOpenHotspot = useCallback(
    async (label: string) => {
      if (!episode) return;
      gameSounds.playClueFound();
      showToast(`−${HOTSPOT_PENALTY.toLocaleString()} pts from max score`, "warning");
      const hotspotKey = `${sceneIndex}:${label}`;
      setLocalHotspots((current) => (current.includes(hotspotKey) ? current : [...current, hotspotKey]));

      const scene = episode.scenes[sceneIndex];
      const clue = scene?.clues.find((c) => c.label === label);
      if (clue && !discoveredClues.some((d) => d.sceneIndex === sceneIndex && d.label === label)) {
        setDiscoveredClues((current) => [
          ...current,
          { sceneIndex, sceneTitle: scene.title, label: clue.label, detail: clue.detail },
        ]);
      }

      try {
        const activeRun = await ensureRun();
        await openHotspotMutation({ runId: activeRun._id, sceneIndex, hotspotLabel: label });
      } catch {
        // ignore
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [episode, sceneIndex, openHotspotMutation, playerName, identity.identityId, discoveredClues],
  );

  // handleGenerateHint (index.tsx lines 661-670)
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

  // handleGuess (index.tsx lines 433-562)
  const handleGuess = useCallback(
    async (_guessText: string, _figureId: string, submittedPlayerName: string) => {
      if (!episode || isSolved || guessesLeft <= 0 || !identity.identityId) return;

      const figureId = _figureId as Id<"figures">;
      const activeRun = await ensureRun();

      if (!hasEnteredMemory) {
        await enterSceneMutation({ runId: activeRun._id, sceneIndex: 0 });
      }

      // Commit-reveal: commit guess on-chain before submitting (competitive mode)
      if (episode.competitiveMode && wallet.address && !commitState?.hasCommitted) {
        const salt = generateGuessSalt();
        setCommitState({ guess: _guessText, salt, txHash: null, isCommitting: true, hasCommitted: false });
        const episodeDay = Math.max(1, Math.floor(episode.dropsAt / 86400000));
        const txHash = await commitGuessOnChain(wallet.address, episodeDay, _guessText, salt);
        setCommitState((prev) => prev ? { ...prev, txHash, isCommitting: false, hasCommitted: !!txHash } : null);
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
        const updatedStreak = await recordSolve(solvedAt);
        const finalScore = result.score ?? 0;
        setSolvedRun({ elapsedMs: result.elapsedMs, score: finalScore });
        setSolvedFigure({ name: result.answer ?? "Unknown", figureId: figureId });
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
        showToast(`✅ Solved! ${formatScore(finalScore)} pts`, "success");
        setStatus(`Identity anchored — you were ${identityLabel}. Final score: ${formatScore(finalScore)}.`);

        // Mint/delegation/streak orchestration (delegated to useOnchainMinting)
        await onSolveOnchain({
          runId: activeRun._id,
          finalScore,
          figureId,
          figureName: result.answer ?? "Unknown",
          solvedAt,
          guessesUsed: result.guessesUsed,
          memoriesViewed: activeRun.memoriesViewed,
          hotspotsOpened,
          commitState: commitState?.hasCommitted ? commitState : null,
        });
        return;
      }

      showToast(`−${GUESS_PENALTY.toLocaleString()} pts · ${result.guessesRemaining} guess${result.guessesRemaining !== 1 ? 'es' : ''} left`, "error");
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
          } catch {
            // ignore
          }
          setStatus("The body rejects that name. A deeper memory surfaces.");
          return;
        }
      }

      setStatus("That name does not fit. You have reached the last memory.");
    },
    [
      episode, isSolved, guessesLeft, identity.identityId, ensureRun, hasEnteredMemory,
      enterSceneMutation, wallet.address, commitState, commitGuessOnChain, submitGuessMutation,
      recordSolve, saveLastSolve, memoriesViewed, hotspotsOpened, formatScore, onSolveOnchain,
      gameSounds, sceneIndex, hasMoreMemories, run?.status,
    ],
  );

  return {
    isGuessPanelOpen,
    setIsGuessPanelOpen,
    solvedRun,
    status,
    setStatus,
    commitState,
    activeHint,
    revealDismissed,
    setRevealDismissed,
    isBusy,
    localHotspots,
    discoveredClues,
    solvedFigure,
    toastVisible,
    toastMessage,
    toastType,
    figureOptions,
    revealFigure,
    handleGuessNow,
    handleOpenHotspot,
    handleGuess,
    handleGenerateHint,
    showToast,
    isHintGenerating,
  };
}
