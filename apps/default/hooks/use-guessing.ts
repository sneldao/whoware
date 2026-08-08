import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";
import { useMutation, useQuery } from "convex/react";

import { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { MAX_GUESSES_PER_RUN, HOTSPOT_PENALTY, HINT_PENALTY } from "@/convex/scoring";
import { FigureOption } from "@/components/who-ware/guess-panel";
import { useVeniceHint, type HintTier } from "@/hooks/use-venice-hint";
import { evaluateHintRequest } from "@/hooks/hint-gating";
import { useGameToast } from "@/hooks/use-game-toast";
import { useRevealState, RevealFigure, SolvedRun } from "@/hooks/use-reveal-state";
import { useOnchainCommit } from "@/hooks/use-onchain-commit";
import { useIncoGuess } from "@/hooks/use-inco-guess";
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
  /** Inco Lightning tx hash — present when the guess was submitted via encrypted on-chain tx. */
  incoTxHash?: string | null;
}

export interface UseGuessingReturn {
  isGuessPanelOpen: boolean;
  setIsGuessPanelOpen: (v: boolean) => void;
  solvedRun: SolvedRun | null;
  status: string;
  setStatus: (s: string) => void;
  commitState: ReturnType<typeof useOnchainCommit>["commitState"];
  incoGuessState: ReturnType<typeof useIncoGuess>["state"];
  incoAvailable: boolean;
  activeHint: string | null;
  activeHintTier: "socratic" | "era" | "proximity" | null;
  hintsUsed: number;
  hintUsedForScene: (sceneIndex: number) => boolean;
  hasHintTierForScene: (sceneIndex: number, tier: "socratic" | "era" | "proximity") => boolean;
  canRequestHintForClue: (clueLabel: string) => boolean;
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
  handleGenerateHint: (clueLabel: string, tier?: "socratic" | "era" | "proximity") => Promise<void>;
  handleDismissHint: () => void;
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
  const [activeHintTier, setActiveHintTier] = useState<HintTier | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  /** Tiers generated per scene — each tier may be generated once per scene. */
  const [sceneHintTiers, setSceneHintTiers] = useState<Map<number, Set<HintTier>>>(new Map());
  /** Generated hints keyed by `${sceneIndex}:${tier}` for instant tier switching. */
  const [sceneHints, setSceneHints] = useState<Map<string, string>>(new Map());

  const addTierForScene = useCallback((sceneIdx: number, hintTier: HintTier) => {
    setSceneHintTiers((prev) => {
      const next = new Map(prev);
      const existing = new Set(next.get(sceneIdx) ?? []);
      existing.add(hintTier);
      next.set(sceneIdx, existing);
      return next;
    });
  }, []);

  // Composed sub-hooks
  const toast = useGameToast();
  const reveal = useRevealState({
    episode,
    figures,
    isExhausted,
    identityId: identity.identityId,
  });
  const commit = useOnchainCommit();
  const incoGuess = useIncoGuess({
    competitiveMode: episode?.competitiveMode ?? false,
    dropsAt: episode?.dropsAt ?? 0,
  });
  const discovery = useLocalDiscovery(episode?._id, identity.identityId);

  // Derived
  const hotspotsOpened = run?.hotspotsOpened ?? discovery.localHotspots.length;

  // Sync hintsUsed from backend when it's higher (e.g. page reload)
  const backendHintsUsed = run?.hintsUsed ?? 0;
  useEffect(() => {
    if (backendHintsUsed > hintsUsed) {
      setHintsUsed(backendHintsUsed);
    }
  }, [backendHintsUsed, hintsUsed]);

  // Clear the visible hint when navigating between scenes or episodes
  useEffect(() => {
    setActiveHint(null);
    setActiveHintTier(null);
  }, [sceneIndex, episode?._id]);

  // Reset per-scene hint state for a new episode/identity
  useEffect(() => {
    setSceneHintTiers(new Map());
    setSceneHints(new Map());
    setHintsUsed(0);
  }, [episode?._id, identity.identityId]);

  // Venice hint hook
  const { getHint, isGenerating: isHintGenerating, recordHintUsage } = useVeniceHint();

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

  // handleGenerateHint — escalating tiers (socratic → era → proximity),
  // each tier once per scene, each new tier costs HINT_PENALTY.
  const handleGenerateHint = useCallback(
    async (clueLabel: string, tier: HintTier = "socratic") => {
      if (!episode) return;
      const currentScene = episode.scenes[sceneIndex] ?? episode.scenes[0];
      if (!currentScene) return;

      const tiersForScene = sceneHintTiers.get(sceneIndex) ?? new Set<HintTier>();

      // The clue must be opened in this scene before any hint is available.
      const sceneHasOpenedClue = discovery.discoveredClues.some(
        (c) => c.sceneIndex === sceneIndex && currentScene.clues.some((sc) => sc.label === c.label),
      );

      const decision = evaluateHintRequest({ tiersGenerated: tiersForScene, sceneHasOpenedClue }, tier);

      if (decision.action === "blocked" && decision.reason === "tier-unlocked-by-prior") {
        return;
      }
      if (decision.action === "blocked" && decision.reason === "no-clue") {
        toast.show("Open a clue in this memory first — the whisper needs context.", "info");
        return;
      }
      if (decision.action === "reshow") {
        const stored = sceneHints.get(`${sceneIndex}:${tier}`);
        if (stored) {
          setActiveHint(stored);
          setActiveHintTier(tier);
        }
        return;
      }

      setActiveHint(null);
      const hint = await getHint({
        sceneAmbientText: currentScene.ambientText,
        clueLabel,
        sceneLocation: currentScene.location,
        sceneEra: currentScene.era,
        episodeId: episode._id,
        tier,
      });
      setActiveHint(hint);
      setActiveHintTier(tier);
      setHintsUsed((n) => n + 1);
      addTierForScene(sceneIndex, tier);
      setSceneHints((prev) => new Map(prev).set(`${sceneIndex}:${tier}`, hint));

      // Record on backend so the score penalty is applied
      const activeRun = await ensureRun();
      await recordHintUsage(activeRun?._id);

      const tierLabel = tier === "era" ? "Era nudge" : tier === "proximity" ? "Proximity hint" : "Memory whisper";
      toast.show(`${tierLabel} used · −${HINT_PENALTY} pts`, "warning");
    },
    [episode, sceneIndex, getHint, sceneHintTiers, sceneHints, discovery.discoveredClues, ensureRun, recordHintUsage, toast, addTierForScene],
  );

  // hintUsedForScene — has any hint been generated for the given scene?
  const hintUsedForScene = useCallback(
    (idx: number) => (sceneHintTiers.get(idx)?.size ?? 0) > 0,
    [sceneHintTiers],
  );

  // hasHintTierForScene — was a specific tier generated for a scene?
  const hasHintTierForScene = useCallback(
    (idx: number, t: HintTier) => sceneHintTiers.get(idx)?.has(t) ?? false,
    [sceneHintTiers],
  );

  // canRequestHintForClue — gate: at least one clue opened in the current scene
  const canRequestHintForClue = useCallback(
    (_clueLabel: string) => {
      if (!episode) return false;
      const sceneClues = episode.scenes[sceneIndex]?.clues ?? episode.scenes[0]?.clues ?? [];
      return discovery.discoveredClues.some(
        (c) => c.sceneIndex === sceneIndex && sceneClues.some((sc) => sc.label === c.label),
      );
    },
    [episode, sceneIndex, discovery.discoveredClues],
  );

  // handleDismissHint — hide the overlay but keep generated tiers for instant re-view
  const handleDismissHint = useCallback(() => {
    setActiveHint(null);
  }, []);

  // handleGuess
  const handleGuess = useCallback(
    async (_guessText: string, _figureId: string, submittedPlayerName: string) => {
      if (!episode || run?.status === "solved" || guessesLeft <= 0 || !identity.identityId) return;

      const figureId = _figureId as Id<"figures">;
      const activeRun = await ensureRun();

      if (!hasEnteredMemory) {
        await enterSceneMutation({ runId: activeRun._id, sceneIndex: 0 });
      }

      // On-chain guess: use Inco encrypted guess if available, else commit-reveal
      if (episode.competitiveMode && wallet.address) {
        if (incoGuess.isAvailable) {
          // Inco Lightning: single encrypted tx on Base Sepolia
          if (incoGuess.state.hasSubmitted) return; // prevent double-submit
          const submitted = await incoGuess.submitEncrypted(wallet.address, _figureId);
          if (!submitted) {
            setStatus("Could not submit encrypted guess. Check your wallet and try again.");
            return;
          }
        } else if (!commit.hasCommitted) {
          // Legacy: commit-reveal on Mantle Sepolia
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
          // Inco tx hash (when encrypted guess was used instead of commit-reveal)
          incoTxHash: incoGuess.state.hasSubmitted ? incoGuess.state.txHash : null,
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
      incoGuess,
    ],
  );

  return {
    isGuessPanelOpen,
    setIsGuessPanelOpen,
    solvedRun: reveal.solvedRun,
    status,
    setStatus,
    commitState: commit.commitState,
    incoGuessState: incoGuess.state,
    incoAvailable: incoGuess.isAvailable,
    activeHint,
    activeHintTier,
    hintsUsed,
    hintUsedForScene,
    hasHintTierForScene,
    canRequestHintForClue,
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
    handleDismissHint,
    showToast: toast.show,
    isHintGenerating,
  };
}
