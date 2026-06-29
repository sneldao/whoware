import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { commitGuessOnChain } from "@/lib/wallet";
import { theme } from "@/lib/theme";
import { logger } from "@/lib/logger";
import { OnboardingFlow } from "@/components/who-ware/onboarding-flow";
import { useGameSession } from "@/hooks/use-game-session";
import { useGuessing, UseGuessingReturn } from "@/hooks/use-guessing";
import { useSceneProgression } from "@/hooks/use-scene-progression";
import { useSmartAccountDelegate } from "@/hooks/use-smart-account-delegate";
import { useSolveMinter } from "@/hooks/use-solve-minter";
import { useBootError } from "@/hooks/use-boot-error";
import { ExhaustedView } from "@/components/who-ware/views/exhausted-view";
import { HeroPanel } from "@/components/who-ware/views/hero-panel";
import { HistoryCard, LastSolveCard } from "@/components/who-ware/views/history-cards";
import { IntroView } from "@/components/who-ware/views/intro-view";
import {
  RevealLayer, ToastLayer, TooltipLayer, UpgradeOverlayLayer,
} from "@/components/who-ware/views/overlays";
import { PlayingView } from "@/components/who-ware/views/playing-view";
import { SolvedView } from "@/components/who-ware/views/solved-view";
import { MAX_GUESSES_PER_RUN } from "@/convex/scoring";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import styles from "./index.styles";

function formatScore(score: number) { return Math.round(score).toLocaleString(); }

function LoadingScreen({ message }: { message: string }) {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator color={theme.accent} />
      <Text style={styles.loadingText}>{message}</Text>
    </View>
  );
}

/**
 * Game dashboard — orchestrates the session, delegate, minter, guessing,
 * and progression hooks, then delegates rendering to the view components
 * under `components/who-ware/views/`.
 */
function GameDashboard() {
  const session = useGameSession();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toastDismissed, setToastDismissed] = useState(false);
  const hasMoreMemoriesRef = useRef<() => boolean>(() => false);
  const sceneIndexRef = useRef({ sceneIndex: 0, setSceneIndex: () => undefined });
  const guessingRef = useRef<UseGuessingReturn | null>(null);

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
  });
  guessingRef.current = guessing;

  const progression = useSceneProgression({
    session, isBusy: guessing.isBusy, setIsBusy: guessing.setIsBusy,
    setStatus: guessing.setStatus, showToast: guessing.showToast,
  });

  hasMoreMemoriesRef.current = progression.hasMoreMemories;
  sceneIndexRef.current = { sceneIndex: progression.sceneIndex, setSceneIndex: progression.setSceneIndex };

  useEffect(() => { if (guessing.toastVisible) setToastDismissed(false); }, [guessing.toastVisible]);

  // ── Loading states ──────────────────────────────────────────────
  const waitingForBoot = !session.identity.isLoaded || session.episode === undefined || session.run === undefined;
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

  // ── Derived state ───────────────────────────────────────────────
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

  // ── Handlers ────────────────────────────────────────────────────
  const handleEnterMemory = useCallback(async () => {
    if (!session.episode || guessing.isBusy) return;
    guessing.setIsBusy(true);
    try {
      const activeRun = await session.ensureRun();
      await session.enterSceneMutation({ runId: activeRun._id, sceneIndex: 0 });
      guessing.setStatus("The first memory resolves around you. Look carefully before asking the room for help.");
    } catch { } finally { guessing.setIsBusy(false); }
  }, [session.episode, guessing.isBusy, guessing.setIsBusy, session.ensureRun, session.enterSceneMutation, guessing.setStatus]);

  const handleShareResult = useCallback(async () => {
    try {
      await navigator.share({
        title: "WhoWare",
        text: "I solved today's WhoWare!",
        url: Platform.OS === "web" ? window.location.href : "https://whoware.vercel.app",
      });
    } catch { }
  }, []);

  // ── Hero ────────────────────────────────────────────────────────
  const hero = (
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
      onGuessNow={guessing.handleGuessNow}
      onEnterMemory={handleEnterMemory}
      isGuessPanelOpen={guessing.isGuessPanelOpen}
      onShowScoreTooltip={() => session.tooltip.show("score")}
      onShowCluesTooltip={() => session.tooltip.show("clues")}
      onShowGuessesTooltip={() => session.tooltip.show("guesses")}
    />
  );

  // ── View routing ────────────────────────────────────────────────
  let body: React.ReactNode;
  if (!hasEnteredMemory) {
    body = (
      <IntroView
        isGuessPanelOpen={guessing.isGuessPanelOpen}
        figureOptions={guessing.figureOptions}
        guessesLeft={guessesLeft}
        isSolved={isSolved}
        playerName={session.playerName}
        onPlayerNameChange={session.setPlayerName}
        onSubmitGuess={guessing.handleGuess}
      />
    );
  } else {
    body = (
      <PlayingView
        scene={currentScene}
        sceneIndex={progression.accessiblePosition}
        totalAccessibleScenes={progression.accessibleScenes.length}
        visibleSceneIndices={progression.visibleScenes.map((s) => s.episodeIndex)}
        currentSceneIndex={progression.sceneIndex}
        onSelectScene={progression.setSceneIndex}
        onToggleGuessPanel={() => guessing.setIsGuessPanelOpen((c) => !c)}
        isGuessPanelOpen={guessing.isGuessPanelOpen}
        isSolved={isSolved}
        isExhausted={isExhausted}
        moreMemoriesAvailable={moreMemoriesAvailable}
        isBusy={guessing.isBusy}
        onUnlockNextMemory={progression.handleUnlockNextMemory}
        discoveredClues={guessing.discoveredClues}
        onHotspotOpen={guessing.handleOpenHotspot}
        onGenerateHint={guessing.handleGenerateHint}
        activeHint={guessing.activeHint}
        isHintGenerating={guessing.isHintGenerating}
        episodeId={session.episode._id}
        memoriesViewed={memoriesViewed}
        currentStreak={session.streak.current}
        figureOptions={guessing.figureOptions}
        guessesLeft={guessesLeft}
        playerName={session.playerName}
        onPlayerNameChange={session.setPlayerName}
        onSubmitGuess={guessing.handleGuess}
        leaderboardEntries={session.leaderboardSnapshot?.entries ?? []}
        playerRank={session.leaderboardSnapshot?.playerRank ?? null}
        rankedCount={session.leaderboardSnapshot?.rankedCount ?? 0}
        archiveCount={session.archiveCount}
        isPushOptedIn={session.pushNotifications.isOptedIn}
        isPushBusy={session.pushNotifications.isBusy}
        onTogglePush={session.pushNotifications.toggleNotifications}
      />
    );
  }

  // ── Result share / solved-only layers ──────────────────────────
  const solvedFigure = guessing.revealFigure;
  const revealFigureRecord = solvedFigure ? session.figures.find((f) => f._id === solvedFigure.figureId) : null;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: session.insets.top + 18, paddingBottom: session.insets.bottom + 28 },
        ]}
        contentInsetAdjustmentBehavior="automatic"
      >
        {hero}
        {isSolved && guessing.solvedRun && (
          <ErrorBoundary label="SolvedView">
            <SolvedView
            episodeNumber={episodeNumber}
            memoriesViewed={memoriesViewed}
            cluesOpened={hotspotsOpened}
            elapsedMs={guessing.solvedRun.elapsedMs}
            score={guessing.solvedRun.score}
            rank={session.leaderboardSnapshot?.playerRank?.rank ?? null}
            rankedCount={session.leaderboardSnapshot?.rankedCount ?? 0}
            streak={session.streak.current}
            guessesUsed={guessing.solvedRun.guessesUsed}
            hotspotsOpened={guessing.solvedRun.hotspotsOpened}
            difficulty={session.episode.difficulty}
            figureEra={revealFigureRecord?.era}
            figureRegion={revealFigureRecord?.region}
            isSmartAccountUpgraded={session.wallet.smartAccount.isUpgraded}
            delegationTxHash={delegate.state.delegationHash}
            isDelegating={delegate.state.isDelegating}
            mintTxHash={minter.state.mintTxHash}
            isMinting={minter.state.isMinting}
            streakTxHash={minter.state.streakTxHash}
            isStreakUpdating={minter.state.isStreakUpdating}
            onShowDelegationTooltip={() => session.tooltip.show("delegation")}
            onShowMintTooltip={() => session.tooltip.show("mint")}
            onShowStreakTooltip={() => session.tooltip.show("streak")}
            onShowHistory={() => setHistoryOpen(true)}
            onShare={handleShareResult}
          />
          </ErrorBoundary>
        )}
        {isExhausted && <ExhaustedView onLearnMoreArchive={() => {}} />}
        {body}
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
        {session.playerHistory && session.playerHistory.length > 0 && (
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

export default function Index() {
  const session = useGameSession();
  if (!session.onboardingDone) {
    return <OnboardingFlow onComplete={() => session.markOnboardingDone()} />;
  }
  return <GameDashboard />;
}
