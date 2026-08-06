import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { commitGuessOnChain } from "@/lib/wallet";
import { SITE_URL } from "@/lib/site";
import { theme } from "@/lib/theme";
import { detectSceneQuality } from "@/lib/scene-quality";
import { getSoundEnabled, markOnboardingComplete, setSoundEnabled } from "@/lib/onboarding";
import { useImmersionShell } from "@/lib/immersion-shell";
import { useGameSession, type UseGameSessionReturn } from "@/hooks/use-game-session";
import { useGuessing, UseGuessingReturn } from "@/hooks/use-guessing";
import { useSceneProgression } from "@/hooks/use-scene-progression";
import { useSmartAccountDelegate } from "@/hooks/use-smart-account-delegate";
import { useSolveMinter } from "@/hooks/use-solve-minter";
import { useBootError } from "@/hooks/use-boot-error";
import {
  setGameSoundsMuted,
  startAmbientBed,
  stopAmbientBed,
  unlockGameAudio,
} from "@/hooks/use-game-sounds";
import { ExhaustedView } from "@/components/who-ware/views/exhausted-view";
import { HeroPanel } from "@/components/who-ware/views/hero-panel";
import { HistoryCard, LastSolveCard } from "@/components/who-ware/views/history-cards";
import {
  RevealLayer, ToastLayer, TooltipLayer, UpgradeOverlayLayer,
} from "@/components/who-ware/views/overlays";
import { SolvedView } from "@/components/who-ware/views/solved-view";
import { ImmersionThreshold } from "@/components/who-ware/immersion-threshold";
import { ImmersionSession } from "@/components/who-ware/immersion-session";
import { CoachWhisper } from "@/components/who-ware/coach-whisper";
import { MAX_GUESSES_PER_RUN } from "@/convex/scoring";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { useProgressiveCoach } from "@/hooks/use-progressive-coach";
import { useImmersionKeyboard } from "@/hooks/use-immersion-keyboard";
import styles from "./index.styles";

const CHROME_UNLOCK_MS = 12_000;
const SOLVE_HOLD_MS = 1_400;
const PULSE_NEXT_MS = 4_500;

function formatScore(score: number) { return Math.round(score).toLocaleString(); }

function playingNextStep(guessesLeft: number): string {
  const quality = Platform.OS === "web" ? detectSceneQuality() : { mode: "panorama" as const };
  const lookHint = quality.mode === "three-d"
    ? "Drag to look, tap a glow for a clue"
    : "Tap a glowing fragment for a clue";
  return `${lookHint}, unlock another memory, or Name identity (${guessesLeft} left).`;
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color={theme.accent} />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

/**
 * Single session owner. Cold path: threshold → ImmersionSession (room + HUD).
 * Returning mid-run players land in HUD-over-room. Column shell only after solve.
 */
export default function Index() {
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toastDismissed, setToastDismissed] = useState(false);
  const [isEntering, setIsEntering] = useState(false);
  const [chromeUnlocked, setChromeUnlocked] = useState(false);
  const [loadFigures, setLoadFigures] = useState(false);
  const [loadLeaderboard, setLoadLeaderboard] = useState(false);
  const [loadHistory, setLoadHistory] = useState(false);
  const [pulseNextMemory, setPulseNextMemory] = useState(false);
  const [roomHold, setRoomHold] = useState(false);

  const hasMoreMemoriesRef = useRef<() => boolean>(() => false);
  const sceneIndexRef = useRef({ sceneIndex: 0, setSceneIndex: (_i: number) => undefined as void });
  const guessingRef = useRef<UseGuessingReturn | null>(null);
  const chromeUnlockedRef = useRef(false);
  const wakeAtRef = useRef<number | null>(null);
  const wasActivePlayRef = useRef(false);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { setFullBleed } = useImmersionShell();
  const coach = useProgressiveCoach();
  const coachOfferRef = useRef(coach.offer);
  coachOfferRef.current = coach.offer;

  const session: UseGameSessionReturn = useGameSession({
    loadFigures,
    loadLeaderboard,
    loadHistory: loadHistory || historyOpen,
  });

  const delegate = useSmartAccountDelegate({
    wallet: session.wallet,
    showToast: (msg, type) => { guessingRef.current?.showToast(msg, type); },
  });

  const minter = useSolveMinter({
    wallet: session.wallet, episode: session.episode, streak: session.streak,
    showToast: (msg, type) => { guessingRef.current?.showToast(msg, type); },
    delegate: delegate.delegate,
    hasDelegationManager: delegate.hasDelegationManager,
    setUserOpHash: delegate.setUserOpHash,
  });

  const guessing = useGuessing({
    session,
    sceneIndex: sceneIndexRef.current.sceneIndex,
    setSceneIndex: sceneIndexRef.current.setSceneIndex,
    hasMoreMemories: () => hasMoreMemoriesRef.current(),
    enterSceneMutation: session.enterSceneMutation,
    openHotspotMutation: session.openHotspotMutation,
    submitGuessMutation: session.submitGuessMutation,
    ensureRun: session.ensureRun,
    commitGuessOnChain,
    onSolveOnchain: minter.handleSolveOnchain,
    formatScore,
    onCoachOffer: (id) => { void coachOfferRef.current(id); },
    onWrongGuessRedirect: () => {
      setPulseNextMemory(true);
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = setTimeout(() => {
        setPulseNextMemory(false);
        pulseTimerRef.current = null;
      }, PULSE_NEXT_MS);
    },
  });
  guessingRef.current = guessing;

  const progression = useSceneProgression({
    session, isBusy: guessing.isBusy, setIsBusy: guessing.setIsBusy,
    setStatus: guessing.setStatus, showToast: guessing.showToast,
  });

  hasMoreMemoriesRef.current = progression.hasMoreMemories;
  sceneIndexRef.current = { sceneIndex: progression.sceneIndex, setSceneIndex: progression.setSceneIndex };

  const unlockChrome = useCallback(() => {
    if (chromeUnlockedRef.current) return;
    chromeUnlockedRef.current = true;
    setChromeUnlocked(true);
  }, []);

  useEffect(() => { if (guessing.toastVisible) setToastDismissed(false); }, [guessing.toastVisible]);

  useEffect(() => {
    if (guessing.isGuessPanelOpen || (session.run?.memoriesViewed ?? 0) === 0) {
      setLoadFigures(true);
    }
  }, [guessing.isGuessPanelOpen, session.run?.memoriesViewed]);

  useEffect(() => {
    if (guessing.isGuessPanelOpen || guessing.discoveredClues.length > 0 || session.run?.status === "solved") {
      setLoadLeaderboard(true);
    }
  }, [guessing.isGuessPanelOpen, guessing.discoveredClues.length, session.run?.status]);

  const hasEnteredMemoryEarly = (session.run?.memoriesViewed ?? 0) > 0;
  const runFinishedEarly =
    session.run?.status === "solved" || session.run?.status === "exhausted";
  const guessesLeftEarly = Math.max(
    0,
    MAX_GUESSES_PER_RUN - (session.run?.guessesUsed ?? 0),
  );

  // Returning players already in a run (or finished) start with chrome on.
  useEffect(() => {
    if (hasEnteredMemoryEarly || runFinishedEarly) {
      chromeUnlockedRef.current = true;
      setChromeUnlocked(true);
    }
  }, [hasEnteredMemoryEarly, runFinishedEarly]);

  // Track live play this session so solve-hold only runs after an in-session finish.
  useEffect(() => {
    if (hasEnteredMemoryEarly && !runFinishedEarly) {
      wasActivePlayRef.current = true;
    }
  }, [hasEnteredMemoryEarly, runFinishedEarly]);

  // Brief hold in the room after solve/exhaust before column chrome.
  useEffect(() => {
    if (!runFinishedEarly || !wasActivePlayRef.current) return;
    setRoomHold(true);
    const t = setTimeout(() => setRoomHold(false), SOLVE_HOLD_MS);
    return () => clearTimeout(t);
  }, [runFinishedEarly]);

  // Full-bleed on web for threshold + active run + solve hold; column after.
  useEffect(() => {
    const waitingForBoot =
      !session.identity.isLoaded || session.episode === undefined || session.run === undefined;
    if (waitingForBoot || session.episode === null) {
      setFullBleed(false);
      return;
    }
    const inThreshold = !hasEnteredMemoryEarly && !runFinishedEarly;
    const inActivePlay = hasEnteredMemoryEarly && !runFinishedEarly;
    setFullBleed(Platform.OS === "web" && (inThreshold || inActivePlay || roomHold));
    return () => setFullBleed(false);
  }, [
    session.identity.isLoaded,
    session.episode,
    session.run,
    hasEnteredMemoryEarly,
    runFinishedEarly,
    roomHold,
    setFullBleed,
  ]);

  // Chrome escape hatch after wake.
  useEffect(() => {
    if (!hasEnteredMemoryEarly || runFinishedEarly || chromeUnlocked) return;
    if (wakeAtRef.current == null) wakeAtRef.current = Date.now();
    const remaining = Math.max(0, CHROME_UNLOCK_MS - (Date.now() - wakeAtRef.current));
    const t = setTimeout(() => unlockChrome(), remaining);
    return () => clearTimeout(t);
  }, [hasEnteredMemoryEarly, runFinishedEarly, chromeUnlocked, unlockChrome]);

  // First clue unlocks chrome.
  useEffect(() => {
    if (guessing.discoveredClues.length > 0) unlockChrome();
  }, [guessing.discoveredClues.length, unlockChrome]);

  // Opening guess panel unlocks chrome.
  useEffect(() => {
    if (guessing.isGuessPanelOpen) unlockChrome();
  }, [guessing.isGuessPanelOpen, unlockChrome]);

  useEffect(() => {
    if (!hasEnteredMemoryEarly || runFinishedEarly || !chromeUnlocked) return;
    guessing.setStatus(playingNextStep(guessesLeftEarly));
  }, [hasEnteredMemoryEarly, runFinishedEarly, chromeUnlocked, guessesLeftEarly, guessing.setStatus]);

  useEffect(() => {
    if (runFinishedEarly) setLoadFigures(true);
  }, [runFinishedEarly]);

  useEffect(() => {
    if (historyOpen || hasEnteredMemoryEarly || runFinishedEarly) {
      setLoadHistory(true);
    }
  }, [historyOpen, hasEnteredMemoryEarly, runFinishedEarly]);

  // Resume ambient for mid-run returns when sound pref is on; stop when finished.
  useEffect(() => {
    if (!hasEnteredMemoryEarly || runFinishedEarly) {
      stopAmbientBed();
      return;
    }
    let cancelled = false;
    void getSoundEnabled().then((enabled) => {
      if (cancelled || !enabled) return;
      setGameSoundsMuted(false);
      startAmbientBed();
    });
    return () => {
      cancelled = true;
    };
  }, [hasEnteredMemoryEarly, runFinishedEarly]);

  const handleThresholdEnter = useCallback(async (withSound: boolean) => {
    if (!session.episode || isEntering) return;
    setIsEntering(true);
    try {
      await setSoundEnabled(withSound);
      setGameSoundsMuted(!withSound);
      if (withSound) {
        unlockGameAudio();
        session.gameSounds.playSceneEnter();
        session.gameSounds.startAmbient();
      } else {
        session.gameSounds.stopAmbient();
      }
      const activeRun = await session.ensureRun();
      await session.enterSceneMutation({ runId: activeRun._id, sceneIndex: 0 });
      void markOnboardingComplete();
      wakeAtRef.current = Date.now();
      chromeUnlockedRef.current = false;
      setChromeUnlocked(false);
      const left = Math.max(0, MAX_GUESSES_PER_RUN - (activeRun.guessesUsed ?? 0));
      guessing.setStatus(playingNextStep(left));
    } catch {
      // keep threshold; user can retry
    } finally {
      setIsEntering(false);
    }
  }, [
    session.episode,
    isEntering,
    session.ensureRun,
    session.enterSceneMutation,
    session.gameSounds,
    guessing.setStatus,
  ]);

  const handleShareResult = useCallback(async () => {
    try {
      await navigator.share({
        title: "WhoWare",
        text: "I solved today's WhoWare!",
        url: Platform.OS === "web" ? window.location.href : SITE_URL,
      });
    } catch { }
  }, []);

  const scrollRef = useRef<ScrollView>(null);
  const scrollToCountdown = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  const toggleGuessPanel = useCallback(() => {
    const next = !guessing.isGuessPanelOpen;
    if (next) {
      void coach.offer("nameIdentity");
      setLoadFigures(true);
      unlockChrome();
    }
    guessing.setIsGuessPanelOpen(next);
  }, [guessing.isGuessPanelOpen, guessing.setIsGuessPanelOpen, coach, unlockChrome]);

  const unlockNextMemory = useCallback(() => {
    setPulseNextMemory(false);
    if (pulseTimerRef.current) {
      clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = null;
    }
    void progression.handleUnlockNextMemory().then(() => {
      void coach.offer("unlockNext");
    });
  }, [progression, coach]);

  const closeSheets = useCallback(() => {
    guessing.setIsGuessPanelOpen(false);
  }, [guessing.setIsGuessPanelOpen]);

  const selectRailIndex = useCallback((railIndex: number) => {
    const epiIdx = progression.visibleScenes[railIndex]?.episodeIndex;
    if (epiIdx != null) progression.setSceneIndex(epiIdx);
  }, [progression]);

  const keyboardEnabled =
    hasEnteredMemoryEarly && (!runFinishedEarly || roomHold) && !roomHold;

  useImmersionKeyboard({
    enabled: keyboardEnabled,
    onToggleGuess: toggleGuessPanel,
    onCloseSheets: closeSheets,
    onUnlockNext: unlockNextMemory,
    onSelectRailIndex: selectRailIndex,
    railCount: progression.visibleScenes.length,
    guessPanelOpen: guessing.isGuessPanelOpen,
  });

  useEffect(() => () => {
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
  }, []);

  const waitingForBoot =
    !session.identity.isLoaded || session.episode === undefined || session.run === undefined;
  const bootError = useBootError(waitingForBoot);

  if (bootError.timedOut && waitingForBoot) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Couldn't open today's archive.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={bootError.retry}
          style={({ pressed }) => [styles.actionButton, styles.guessButton, pressed && styles.pressed]}
        >
          <Ionicons name="refresh" size={18} color={theme.inkOnAccent} />
          <Text style={styles.guessButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }
  if (waitingForBoot) return <LoadingScreen message="Opening today's archive…" />;
  if (session.episode === null) return <LoadingScreen message="Preparing the first episode…" />;

  const guessCap = MAX_GUESSES_PER_RUN;
  const hasEnteredMemory = (session.run?.memoriesViewed ?? 0) > 0;
  const isSolved = session.run?.status === "solved";
  const isExhausted = session.run?.status === "exhausted";
  const guessesUsed = session.run?.guessesUsed ?? 0;
  const guessesLeft = Math.max(0, guessCap - guessesUsed);
  const hotspotsOpened = session.run?.hotspotsOpened ?? guessing.localHotspots.length;
  const memoriesViewed = session.run?.memoriesViewed ?? 0;
  const totalMemories = session.episode.scenes.length;
  const revealProgress = isSolved ? 1 : Math.min(0.85, (memoriesViewed / Math.max(1, totalMemories)) * 0.65 + hotspotsOpened * 0.04);
  const episodeNumber = parseInt(session.episode.slug.replace(/\D/g, ""), 10) || 1;
  const currentScene = session.episode.scenes[progression.sceneIndex] ?? session.episode.scenes[0];
  if (!currentScene) return <LoadingScreen message="Generating today's memories…" />;

  const firstScene = session.episode.scenes[0] ?? currentScene;
  const solvedSceneImageKey = session.episode.scenes[session.episode.scenes.length - 1]?.imageKey ?? currentScene.imageKey;
  const solvedSceneImageUrl = session.episode.scenes[session.episode.scenes.length - 1]?.imageUrl ?? currentScene.imageUrl;
  const solvedToday = isSolved && session.streak.current > 0;
  const runFinished = isSolved || isExhausted;
  const moreMemoriesAvailable = progression.nextAccessibleIndex >= 0;
  const countdownTarget = isSolved || isExhausted
    ? (session.nextDrop?.dropsAt ?? null)
    : (session.episode.closesAt ?? session.nextDrop?.dropsAt ?? null);
  const countdownLabel = session.episode.closesAt && !isSolved && !isExhausted
    ? "Today's signal collapses in"
    : isSolved
      ? "Next body opens in"
      : "Next drop opens in";

  // ── Threshold (cold start) ──────────────────────────────────────
  if (!hasEnteredMemory && !runFinished) {
    return (
      <View style={{ flex: 1 }}>
        <ImmersionThreshold
          scene={firstScene as unknown as Parameters<typeof ImmersionThreshold>[0]["scene"]}
          imageKey={firstScene.imageKey}
          imageUrl={firstScene.imageUrl}
          isEntering={isEntering}
          onEnterWithSound={() => void handleThresholdEnter(true)}
          onEnterWithoutSound={() => void handleThresholdEnter(false)}
        />
      </View>
    );
  }

  const inImmersionSurface = hasEnteredMemory && (!runFinished || roomHold);

  const sceneState = {
    scene: currentScene,
    sceneIndex: progression.accessiblePosition,
    totalAccessibleScenes: progression.accessibleScenes.length,
    visibleSceneIndices: progression.visibleScenes.map((s) => s.episodeIndex),
    currentSceneIndex: progression.sceneIndex,
    discoveredClues: guessing.discoveredClues,
    activeHint: guessing.activeHint,
    isHintGenerating: guessing.isHintGenerating,
    onSelectScene: progression.setSceneIndex,
    onHotspotOpen: guessing.handleOpenHotspot,
    onGenerateHint: guessing.handleGenerateHint,
  };

  const actionState = {
    isGuessPanelOpen: guessing.isGuessPanelOpen,
    isSolved,
    isExhausted,
    moreMemoriesAvailable,
    isBusy: guessing.isBusy,
    onToggleGuessPanel: toggleGuessPanel,
    onUnlockNextMemory: unlockNextMemory,
    pulseNextMemory,
  };
  const guessState = {
    figureOptions: guessing.figureOptions,
    guessesLeft,
    playerName: session.playerName,
    onPlayerNameChange: session.setPlayerName,
    onSubmitGuess: guessing.handleGuess,
  };
  const extrasState = {
    episodeId: session.episode._id,
    memoriesViewed,
    currentStreak: session.streak.current,
    leaderboardEntries: session.leaderboardSnapshot?.entries ?? [],
    playerRank: session.leaderboardSnapshot?.playerRank ?? null,
    rankedCount: session.leaderboardSnapshot?.rankedCount ?? 0,
    archiveCount: session.archiveCount,
    isPushOptedIn: session.pushNotifications.isOptedIn,
    isPushBusy: session.pushNotifications.isBusy,
    onTogglePush: session.pushNotifications.toggleNotifications,
  };
  const metricsState = {
    scoreDisplay: session.run?.score != null ? formatScore(session.run.score) : "—",
    hotspotsOpened,
    guessesLeft,
    guessCap,
    onShowScoreTooltip: () => session.tooltip.show("score"),
    onShowCluesTooltip: () => session.tooltip.show("clues"),
    onShowGuessesTooltip: () => session.tooltip.show("guesses"),
  };

  // ── Active run (+ brief solve hold): room stays mounted ─────────
  if (inImmersionSurface) {
    return (
      <View style={{ flex: 1 }}>
        <ImmersionSession
          chromeUnlocked={chromeUnlocked || roomHold}
          scene={sceneState}
          actions={actionState}
          guess={guessState}
          extras={extrasState}
          metrics={metricsState}
          solveHold={roomHold}
          solveHoldLabel={isSolved ? "Identity anchored…" : "The signal fades…"}
          onNameIdentity={() => {
            unlockChrome();
            void coach.offer("nameIdentity");
            guessing.setIsGuessPanelOpen(true);
            setLoadFigures(true);
          }}
          onOpenHowTo={() => router.push("/how-to")}
        />
        {!roomHold ? (
          <CoachWhisper message={coach.message} onDismiss={coach.dismiss} />
        ) : null}
        <TooltipLayer activeBadge={session.tooltip.activeBadge} onDismiss={session.tooltip.hide} />
        <ToastLayer
          visible={guessing.toastVisible && !toastDismissed && !roomHold}
          message={guessing.toastMessage}
          type={guessing.toastType}
          onDismiss={() => setToastDismissed(true)}
        />
        <ErrorBoundary label="UpgradeOverlay">
          <UpgradeOverlayLayer
            isVisible={delegate.state.showUpgradeOverlay}
            isUpgrading={session.wallet.smartAccount.isUpgrading}
            isUpgraded={session.wallet.smartAccount.isUpgraded}
            error={session.wallet.smartAccount.error}
            onDismiss={() => delegate.setShowUpgradeOverlay(false)}
          />
        </ErrorBoundary>
      </View>
    );
  }

  // ── Solved / exhausted — restore column shell ───────────────────
  const solvedFigure = guessing.revealFigure;
  const revealFigureRecord = solvedFigure ? session.figures.find((f) => f._id === solvedFigure.figureId) : null;

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: session.insets.top + 18, paddingBottom: session.insets.bottom + 28 },
        ]}
        contentInsetAdjustmentBehavior="automatic"
      >
        <HeroPanel
          walletAddress={session.wallet.address}
          isWalletConnected={session.wallet.isConnected}
          isCorrectChain={session.wallet.isCorrectChain}
          isSmartAccountUpgraded={session.wallet.smartAccount.isUpgraded}
          isSmartAccountUpgrading={session.wallet.smartAccount.isUpgrading}
          isMinting={minter.state.isMinting}
          isMinted={!!minter.state.mintTxHash}
          isStreakUpdating={minter.state.isStreakUpdating}
          hasStreakTx={!!minter.state.streakTxHash}
          archiveCount={session.archiveCount}
          imageKey={currentScene.imageKey}
          imageUrl={currentScene.imageUrl}
          solvedImageKey={solvedSceneImageKey}
          solvedImageUrl={solvedSceneImageUrl}
          revealProgress={revealProgress}
          isSolved={isSolved}
          statusText={guessing.status}
          countdownTarget={countdownTarget}
          countdownLabel={countdownLabel}
          runFinished={runFinished}
          currentStreak={session.streak.current}
          bestStreak={session.streak.best}
          solvedToday={solvedToday}
          hasEnteredMemory={hasEnteredMemory}
          isBusy={guessing.isBusy}
          scoreDisplay={session.run?.score != null ? formatScore(session.run.score) : "—"}
          rawScore={session.run?.score ?? null}
          maxPotential={10_000}
          hotspotsOpened={hotspotsOpened}
          guessesLeft={guessesLeft}
          guessCap={guessCap}
          onConnect={session.wallet.connect}
          onUpgrade={session.wallet.smartAccount.upgrade}
          onSwitchChain={session.wallet.switchChain}
          onGuessNow={() => {
            setLoadFigures(true);
            void guessing.handleGuessNow();
          }}
          onEnterMemory={async () => undefined}
          isGuessPanelOpen={guessing.isGuessPanelOpen}
          onShowScoreTooltip={() => session.tooltip.show("score")}
          onShowCluesTooltip={() => session.tooltip.show("clues")}
          onShowGuessesTooltip={() => session.tooltip.show("guesses")}
        />
        {isSolved && guessing.solvedRun && (
          <ErrorBoundary label="SolvedView">
            <SolvedView
              result={{
                episodeNumber,
                memoriesViewed,
                cluesOpened: hotspotsOpened,
                elapsedMs: guessing.solvedRun.elapsedMs,
                score: guessing.solvedRun.score,
                rank: session.leaderboardSnapshot?.playerRank?.rank ?? null,
                rankedCount: session.leaderboardSnapshot?.rankedCount ?? 0,
                streak: session.streak.current,
                guessesUsed: guessing.solvedRun.guessesUsed,
                hotspotsOpened: guessing.solvedRun.hotspotsOpened,
                difficulty: session.episode.difficulty,
                figureEra: revealFigureRecord?.era,
                figureRegion: revealFigureRecord?.region,
              }}
              onchain={{
                isSmartAccountUpgraded: session.wallet.smartAccount.isUpgraded,
                delegationTxHash: delegate.state.delegationHash,
                isDelegating: delegate.state.isDelegating,
                mintTxHash: minter.state.mintTxHash,
                isMinting: minter.state.isMinting,
                streakTxHash: minter.state.streakTxHash,
                isStreakUpdating: minter.state.isStreakUpdating,
                onShowDelegationTooltip: () => session.tooltip.show("delegation"),
                onShowMintTooltip: () => session.tooltip.show("mint"),
                onShowStreakTooltip: () => session.tooltip.show("streak"),
              }}
              figureReveal={{
                episodeId: session.episode._id,
                figureName: guessing.solvedFigure?.name ?? "",
                figureEra: revealFigureRecord?.era,
                figureRegion: revealFigureRecord?.region,
                figureTags: revealFigureRecord?.tags,
              }}
              nextActions={{
                onShowHistory: () => {
                  setLoadHistory(true);
                  setHistoryOpen(true);
                },
                onShare: handleShareResult,
                onTomorrow: scrollToCountdown,
              }}
            />
          </ErrorBoundary>
        )}
        {isExhausted && (
          <ExhaustedView
            episodeId={session.episode._id}
            figureName={guessing.solvedFigure?.name ?? ""}
            figureEra={revealFigureRecord?.era}
            figureRegion={revealFigureRecord?.region}
            figureTags={revealFigureRecord?.tags}
            onLearnMoreArchive={() => router.push("/archive")}
            onTomorrow={scrollToCountdown}
          />
        )}
        {session.lastSolveLoaded && session.lastSolve && !isSolved && (
          <LastSolveCard
            figureName={session.lastSolve.figureName}
            score={session.lastSolve.score}
            memoriesViewed={session.lastSolve.memoriesViewed}
            guessesUsed={session.lastSolve.guessesUsed}
            onDismiss={session.clearLastSolve}
            formatScore={formatScore}
          />
        )}
        {(historyOpen || (session.playerHistory && session.playerHistory.length > 0)) &&
          session.playerHistory &&
          session.playerHistory.length > 0 && (
          <HistoryCard
            history={session.playerHistory}
            open={historyOpen}
            onToggle={() => setHistoryOpen((o) => !o)}
            formatScore={formatScore}
          />
        )}
        <TooltipLayer activeBadge={session.tooltip.activeBadge} onDismiss={session.tooltip.hide} />
        <ToastLayer
          visible={guessing.toastVisible && !toastDismissed}
          message={guessing.toastMessage}
          type={guessing.toastType}
          onDismiss={() => setToastDismissed(true)}
        />
      </ScrollView>
      <RevealLayer
        visible={(isSolved || isExhausted) && !guessing.revealDismissed && !!solvedFigure}
        figureName={guessing.solvedFigure?.name ?? ""}
        era={revealFigureRecord?.era ?? ""}
        region={revealFigureRecord?.region ?? ""}
        tags={revealFigureRecord?.tags ?? []}
        imageUrl={solvedSceneImageUrl}
        onContinue={() => guessing.setRevealDismissed(true)}
      />
      <ErrorBoundary label="UpgradeOverlay">
        <UpgradeOverlayLayer
          isVisible={delegate.state.showUpgradeOverlay}
          isUpgrading={session.wallet.smartAccount.isUpgrading}
          isUpgraded={session.wallet.smartAccount.isUpgraded}
          error={session.wallet.smartAccount.error}
          onDismiss={() => delegate.setShowUpgradeOverlay(false)}
        />
      </ErrorBoundary>
    </View>
  );
}
