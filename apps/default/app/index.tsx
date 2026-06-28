import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MAX_GUESSES_PER_RUN } from "@/convex/scoring";
import { commitGuessOnChain } from "@/lib/wallet";
import { CinematicHero } from "@/components/who-ware/cinematic-hero";
import { IdentityCountdown } from "@/components/who-ware/identity-countdown";
import { EnhancedIdentityReveal } from "@/components/who-ware/enhanced-identity-reveal";
import { IdentityHintButton } from "@/components/who-ware/identity-hint-button";
import { Leaderboard } from "@/components/who-ware/leaderboard";
import { OnChainBadge } from "@/components/who-ware/on-chain-badge";
import { MemoryScene } from "@/components/who-ware/memory-scene";
import { ResultShareCard } from "@/components/who-ware/result-share-card";
import { OnboardingFlow } from "@/components/who-ware/onboarding-flow";
import { EnhancedSceneTransition } from "@/components/who-ware/enhanced-scene-transition";
import { StreakBanner } from "@/components/who-ware/streak-banner";
import { IdentitySection } from "@/components/who-ware/identity-section";
import { ScoreTrajectory } from "@/components/who-ware/score-trajectory";
import { ActionToast } from "@/components/who-ware/action-toast";
import { SmartAccountUpgradeOverlay } from "@/components/who-ware/smart-account-upgrade-overlay";
import { SmartAccountBadge } from "@/components/who-ware/smart-account-badge";
import { TooltipOverlay } from "@/components/curator/tooltip";
import { TappableMetric } from "@/components/shared/tappable-metric";
import { GuessPanel } from "@/components/who-ware/guess-panel";
import { ClueLedger } from "@/components/who-ware/clue-ledger";
import { useGameSession } from "@/hooks/use-game-session";
import { useSceneProgression } from "@/hooks/use-scene-progression";
import { useGuessing, UseGuessingReturn } from "@/hooks/use-guessing";
import { useSmartAccountDelegate } from "@/hooks/use-smart-account-delegate";
import { useSolveMinter } from "@/hooks/use-solve-minter";
import styles from "./index.styles";

function formatScore(score: number) { return Math.round(score).toLocaleString(); }

function StepBadge({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <View style={styles.stepBadge}>
      <Ionicons name={icon as any} size={10} color={color} />
      <Text style={[styles.stepBadgeLabel, { color }]}>{label}</Text>
    </View>
  );
}

function IndexInner() {
  const session = useGameSession();
  if (!session.onboardingDone) return <OnboardingFlow onComplete={() => session.markOnboardingDone()} />;

  const [historyOpen, setHistoryOpen] = useState(false);
  const [toastDismissed, setToastDismissed] = useState(false);
  const hasMoreMemoriesRef = useRef<() => boolean>(() => false);
  const sceneIndexRef = useRef({ sceneIndex: 0, setSceneIndex: (_: number) => {} });
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
      await navigator.share({ title: "WhoWare", text: "I solved today's WhoWare!", url: Platform.OS === "web" ? window.location.href : "https://whoware.vercel.app" });
    } catch { }
  }, []);



  const waitingForBoot = !session.identity.isLoaded || session.episode === undefined || session.run === undefined;
  if (waitingForBoot) return (<View style={styles.loadingContainer}><ActivityIndicator color="#FBBF24" /><Text style={styles.loadingText}>Opening today’s archive…</Text></View>);
  if (session.episode === null) return (<View style={styles.loadingContainer}><ActivityIndicator color="#FBBF24" /><Text style={styles.loadingText}>Preparing the first episode…</Text></View>);

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
  if (!currentScene) return (<View style={styles.loadingContainer}><ActivityIndicator color="#FBBF24" /><Text style={styles.loadingText}>Generating today’s memories…</Text></View>);
  const solvedSceneImageKey = session.episode.scenes[session.episode.scenes.length - 1]?.imageKey ?? currentScene.imageKey;
  const solvedSceneImageUrl = session.episode.scenes[session.episode.scenes.length - 1]?.imageUrl ?? currentScene.imageUrl;
  const solvedToday = isSolved && session.streak.current > 0;
  const runFinished = isSolved || isExhausted;
  const moreMemoriesAvailable = progression.nextAccessibleIndex >= 0;
  const countdownTarget = isSolved || isExhausted ? (session.nextDrop?.dropsAt ?? null) : (session.episode.closesAt ?? session.nextDrop?.dropsAt ?? null);
  const countdownLabel = session.episode.closesAt && !isSolved && !isExhausted ? "Today's signal collapses in" : isSolved ? "Next body opens in" : "Next drop opens in";

  return (
    <View style={styles.root}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: session.insets.top + 18, paddingBottom: session.insets.bottom + 28 }]} contentInsetAdjustmentBehavior="automatic">
        <View style={styles.hero}>
          <CinematicHero imageKey={currentScene.imageKey} revealProgress={revealProgress} isSolved={isSolved} solvedImageKey={solvedSceneImageKey} imageUrl={currentScene.imageUrl} solvedImageUrl={solvedSceneImageUrl} />
          <View style={styles.heroContent}>
            <View style={styles.brandRow}>
              <View style={styles.logoMark}><Ionicons name="eye" size={22} color="#111827" /></View>
              <View style={styles.brandTextCol}><Text style={styles.brand}>WhoWare</Text><Text style={styles.drop}>Daily embodied history ritual</Text></View>
              {session.archiveCount > 0 && <Pressable style={styles.archiveBadge} href="/archive"><Ionicons name="archive-outline" size={11} color="#FFF7ED" /><Text style={styles.archiveBadgeText}>{session.archiveCount}</Text></Pressable>}
            </View>
            <IdentitySection walletAddress={session.wallet.address} isWalletConnected={session.wallet.isConnected} isCorrectChain={session.wallet.isCorrectChain} isSmartAccountUpgraded={session.wallet.smartAccount.isUpgraded} isSmartAccountUpgrading={session.wallet.smartAccount.isUpgrading} isMinting={minter.state.isMinting} isMinted={!!minter.state.mintTxHash} isStreakUpdating={minter.state.isStreakUpdating} hasStreakTx={!!minter.state.streakTxHash} type={hasEnteredMemory ? "during" : "start"} onConnect={session.wallet.connect} onUpgrade={session.wallet.smartAccount.upgrade} onSwitchChain={session.wallet.switchChain} />
            <Text style={styles.headline}>Someone changed history{"\n"}from this room.</Text>
            <Text style={styles.subhead}>{guessing.status}</Text>
            <IdentityCountdown isSolved={isSolved} dropsAt={countdownTarget} statusLabel={countdownLabel} />
            {runFinished && session.archiveCount > 0 && <View style={styles.suggestionsCard}><Pressable style={styles.suggestionRow} href="/archive"><Ionicons name="archive-outline" size={14} color="#A78BFA" /><Text style={styles.suggestionText}>{session.archiveCount} past episode{session.archiveCount !== 1 ? 's' : ''} to explore</Text></Pressable><Pressable style={styles.suggestionRow} href="/curator"><Ionicons name="layers" size={14} color="#A78BFA" /><Text style={styles.suggestionText}>How episodes are made</Text></Pressable></View>}
            <StreakBanner current={session.streak.current} best={session.streak.best} solvedToday={solvedToday} />
            {!hasEnteredMemory ? (
              <View style={styles.introActions}>
                <Pressable accessibilityRole="button" onPress={guessing.handleGuessNow} disabled={guessing.isBusy} style={({ pressed }) => [styles.secondaryIntroButton, pressed && styles.pressed, guessing.isBusy && styles.disabledButton]}><Ionicons name="finger-print" size={18} color="#FFF7ED" /><Text style={styles.secondaryIntroButtonText}>{guessing.isGuessPanelOpen ? "Hide guess" : "Guess without a memory"}</Text></Pressable>
                <Pressable accessibilityRole="button" onPress={handleEnterMemory} disabled={guessing.isBusy} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, guessing.isBusy && styles.disabledButton]}><Text style={styles.primaryButtonText}>{guessing.isBusy ? "Entering memory…" : "Enter first memory"}</Text><Ionicons name="arrow-forward" size={18} color="#111827" /></Pressable>
              </View>
            ) : (
              <>
                <View style={styles.scoreStrip}>
                  <TappableMetric label="Score" value={session.run?.score != null ? `${formatScore(session.run.score)} pts` : "—"} onPress={() => session.tooltip.show("score")} />
                  <TappableMetric label="Clues opened" value={`${hotspotsOpened}`} onPress={() => session.tooltip.show("clues")} />
                  <TappableMetric label="Guesses" value={`${guessesLeft}/${guessCap}`} onPress={() => session.tooltip.show("guesses")} />
                </View>
                {session.run?.score != null && <ScoreTrajectory currentScore={session.run.score} maxPotential={10_000} label="Score trajectory" />}
              </>
            )}
          </View>
        </View>
        {isSolved && guessing.solvedRun && <>
          <ResultShareCard episodeNumber={episodeNumber} memoriesViewed={memoriesViewed} cluesOpened={hotspotsOpened} elapsedMs={guessing.solvedRun.elapsedMs} score={guessing.solvedRun.score} rank={session.leaderboardSnapshot?.playerRank?.rank ?? null} rankedCount={session.leaderboardSnapshot?.rankedCount ?? 0} streak={session.streak.current} guessesUsed={guessing.solvedRun.guessesUsed} hotspotsOpened={guessing.solvedRun.hotspotsOpened} difficulty={session.episode.difficulty} figureEra={guessing.solvedFigure ? session.figures.find((f) => f._id === guessing.solvedFigure?.figureId)?.era : undefined} figureRegion={guessing.solvedFigure ? session.figures.find((f) => f._id === guessing.solvedFigure?.figureId)?.region : undefined} />
          <View style={styles.onChainRow}>{session.wallet.smartAccount.isUpgraded && <OnChainBadge txHash={delegate.state.delegationHash} isMinting={delegate.state.isDelegating} mintingLabel="Granting ERC-7710 delegation…" verifiedLabel="ERC-7710 delegation live" onTooltipPress={() => session.tooltip.show("delegation")} />}<OnChainBadge txHash={minter.state.mintTxHash} isMinting={minter.state.isMinting} mintingLabel="Minting score…" verifiedLabel="Score on Mantle" onTooltipPress={() => session.tooltip.show("mint")} /><OnChainBadge txHash={minter.state.streakTxHash} isMinting={minter.state.isStreakUpdating} mintingLabel="Updating streak…" verifiedLabel="Streak on Mantle" onTooltipPress={() => session.tooltip.show("streak")} /></View>
          {session.wallet.smartAccount.isUpgraded && <SmartAccountBadge isUpgraded={true} isUpgrading={false} onUpgrade={async () => true} />}
        </>}
        {isSolved && <View style={styles.nextActionsRow}><Pressable style={styles.nextActionButton} href="/archive"><Ionicons name="archive-outline" size={14} color="#FFF7ED" /><Text style={styles.nextActionText}>Archive</Text></Pressable><Pressable style={styles.nextActionButton} onPress={handleShareResult}><Ionicons name="share-outline" size={14} color="#FFF7ED" /><Text style={styles.nextActionText}>Share</Text></Pressable><Pressable style={styles.nextActionButton} onPress={() => setHistoryOpen(true)}><Ionicons name="list-outline" size={14} color="#FFF7ED" /><Text style={styles.nextActionText}>History</Text></Pressable><Pressable style={styles.nextActionButton}><Ionicons name="calendar-outline" size={14} color="#FFF7ED" /><Text style={styles.nextActionText}>Tomorrow</Text></Pressable></View>}
        {isExhausted && <View style={styles.exhaustedCard}><Text style={styles.exhaustedTitle}>Case exhausted</Text><Text style={styles.exhaustedSub}>All guesses exhausted. The identity is revealed above — the archive holds what remains.</Text><View style={styles.nextActionsRow}><Pressable style={styles.nextActionButton} href="/archive"><Ionicons name="archive-outline" size={14} color="#FFF7ED" /><Text style={styles.nextActionText}>Learn more in archive</Text></Pressable><Pressable style={styles.nextActionButton}><Ionicons name="calendar-outline" size={14} color="#FFF7ED" /><Text style={styles.nextActionText}>Try again tomorrow</Text></Pressable></View></View>}
        {!hasEnteredMemory ? (
          <>
            {guessing.isGuessPanelOpen && <GuessPanel figures={guessing.figureOptions} guessesLeft={guessesLeft} isSolved={isSolved} playerName={session.playerName} onPlayerNameChange={session.setPlayerName} onSubmit={guessing.handleGuess} />}
            <View style={styles.ritualCard}><View style={styles.ritualHeader}><Ionicons name="sparkles" size={18} color="#FBBF24" /><Text style={styles.ritualTitle}>Score by restraint</Text></View><Text style={styles.ritualText}>Guess before opening a memory for the highest possible score. Each visual memory, inspected detail, wrong guess, and extra second lowers the final leaderboard ceiling.</Text></View>
          </>
        ) : (
          <>
            <EnhancedSceneTransition sceneIndex={progression.sceneIndex} title={currentScene.title} location={currentScene.location} era={currentScene.era} palette={currentScene.palette}>
              <MemoryScene scene={currentScene} sceneIndex={progression.accessiblePosition} totalScenes={progression.accessibleScenes.length} onHotspotOpen={guessing.handleOpenHotspot} onGenerateHint={guessing.handleGenerateHint} activeHint={guessing.activeHint} isHintGenerating={guessing.isHintGenerating} />
            </EnhancedSceneTransition>
            <View style={styles.actionBar}><Pressable accessibilityRole="button" onPress={() => guessing.setIsGuessPanelOpen((c) => !c)} style={({ pressed }) => [styles.actionButton, styles.guessButton, pressed && styles.pressed]}><Ionicons name="finger-print" size={18} color="#111827" /><Text style={styles.guessButtonText}>{guessing.isGuessPanelOpen ? "Hide guesses" : "Name identity"}</Text></Pressable><Pressable accessibilityRole="button" disabled={!moreMemoriesAvailable || isSolved || guessing.isBusy} onPress={progression.handleUnlockNextMemory} style={({ pressed }) => [styles.actionButton, styles.secondaryButton, (!moreMemoriesAvailable || isSolved) && styles.disabledButton, pressed && styles.pressed]}><Text style={styles.secondaryButtonText}>{moreMemoriesAvailable ? "Unlock next memory" : "All memories open"}</Text></Pressable></View>
            <View style={styles.sceneRail}>{progression.visibleScenes.map(({ episodeIndex: epiIdx }, railIndex) => (<Pressable key={session.episode.scenes[epiIdx]?.title ?? railIndex} accessibilityRole="button" onPress={() => progression.setSceneIndex(epiIdx)} style={[styles.scenePill, progression.sceneIndex === epiIdx && styles.scenePillActive]}><Text style={[styles.scenePillText, progression.sceneIndex === epiIdx && styles.scenePillTextActive]}>{railIndex + 1}</Text></Pressable>))}</View>
            <ClueLedger clues={guessing.discoveredClues} totalCluesAvailable={progression.accessibleScenes.length * 3} />
            {session.episode && !isSolved && !isExhausted && <IdentityHintButton episodeId={session.episode._id} scenesRevealed={memoriesViewed} streak={session.streak.current} isRunActive={!isSolved && !isExhausted} />}
            {guessing.isGuessPanelOpen || isSolved || isExhausted || guessesLeft <= 0 ? <GuessPanel figures={guessing.figureOptions} guessesLeft={guessesLeft} isSolved={isSolved || isExhausted} playerName={session.playerName} onPlayerNameChange={session.setPlayerName} onSubmit={guessing.handleGuess} /> : null}
            <Leaderboard entries={session.leaderboardSnapshot?.entries ?? []} playerRank={session.leaderboardSnapshot?.playerRank ?? null} rankedCount={session.leaderboardSnapshot?.rankedCount ?? 0} />
            {session.archiveCount > 0 && <Pressable style={styles.curatorLink} href="/archive"><Ionicons name="archive-outline" size={14} color="#475569" /><Text style={styles.curatorLinkText}>Archive · {session.archiveCount}</Text></Pressable>}
            <View style={styles.venicePipelineCard}><View style={styles.venicePipelineHeader}><View style={styles.venicePipelineIcon}><Ionicons name="layers" size={16} color="#A78BFA" /></View><View style={styles.venicePipelineInfo}><Text style={styles.venicePipelineTitle}>Autonomous Agent Pipeline</Text><Text style={styles.venicePipelineSub}>Scenes · Images · Hints · Calibration — all generated by Venice AI</Text></View></View><View style={styles.venicePipelineSteps}><StepBadge icon="search" label="Select" color="#A78BFA" /><Ionicons name="arrow-forward" size={10} color="rgba(255,247,237,0.2)" /><StepBadge icon="sparkles" label="Write" color="#A78BFA" /><Ionicons name="arrow-forward" size={10} color="rgba(255,247,237,0.2)" /><StepBadge icon="shield-checkmark" label="Verify" color="#22C55E" /><Ionicons name="arrow-forward" size={10} color="rgba(255,247,237,0.2)" /><StepBadge icon="trending-up" label="Calibrate" color="#FBBF24" /><Ionicons name="arrow-forward" size={10} color="rgba(255,247,237,0.2)" /><StepBadge icon="image" label="Render" color="#A78BFA" /></View><Pressable href="/curator" style={({ pressed }) => [styles.venicePipelineAction, pressed && styles.pressed]}><Text style={styles.venicePipelineActionText}>Open AI Curator Studio</Text><Ionicons name="arrow-forward" size={14} color="#111827" /></Pressable></View>
            <Pressable style={styles.curatorLink} href="/analytics"><Ionicons name="pulse-outline" size={14} color="#475569" /><Text style={styles.curatorLinkText}>Pulse</Text></Pressable>
            <Pressable style={styles.curatorLink} onPress={session.pushNotifications.toggleNotifications} disabled={session.pushNotifications.isBusy}><Ionicons name={session.pushNotifications.isOptedIn ? "notifications" : "notifications-off-outline"} size={14} color={session.pushNotifications.isOptedIn ? "#FBBF24" : "#475569"} /><Text style={styles.curatorLinkText}>{session.pushNotifications.isBusy ? "Updating…" : session.pushNotifications.isOptedIn ? "Drop alerts on" : "Drop alerts off"}</Text></Pressable>
          </>
        )}
        {session.lastSolveLoaded && session.lastSolve && !isSolved && <View style={styles.lastSolveCard}><View style={styles.lastSolveHeader}><Ionicons name="time-outline" size={14} color="#FBBF24" /><Text style={styles.lastSolveTitle}>Last solve</Text><Pressable onPress={session.clearLastSolve} style={styles.lastSolveDismiss}><Ionicons name="close" size={12} color="rgba(255,247,237,0.3)" /></Pressable></View><Text style={styles.lastSolveFigure}>{session.lastSolve.figureName}</Text><View style={styles.lastSolveStats}><View style={styles.lastSolveStat}><Text style={styles.lastSolveStatValue}>{formatScore(session.lastSolve.score)}</Text><Text style={styles.lastSolveStatLabel}>score</Text></View><View style={styles.lastSolveStat}><Text style={styles.lastSolveStatValue}>{session.lastSolve.memoriesViewed}</Text><Text style={styles.lastSolveStatLabel}>memories</Text></View><View style={styles.lastSolveStat}><Text style={styles.lastSolveStatValue}>{session.lastSolve.guessesUsed}</Text><Text style={styles.lastSolveStatLabel}>guesses</Text></View></View></View>}
        {session.playerHistory && session.playerHistory.length > 0 && <View style={styles.historyCard}><Pressable style={styles.historyToggle} onPress={() => setHistoryOpen((o) => !o)}><Ionicons name="list-outline" size={14} color="#FBBF24" /><Text style={styles.historyTitle}>My history ({session.playerHistory.length})</Text><Ionicons name={historyOpen ? "chevron-up" : "chevron-down"} size={14} color="rgba(255,247,237,0.3)" /></Pressable>{historyOpen && <View style={styles.historyList}>{session.playerHistory.map((entry) => (<View key={entry._id} style={styles.historyRow}><View style={styles.historyRowLeft}><Text style={styles.historyFigure}>{entry.figureName ?? entry.episodeSlug}</Text><Text style={styles.historyDate}>{new Date(entry.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</Text></View><View style={styles.historyRowRight}>{entry.status === "solved" ? (<><Text style={styles.historyScore}>{entry.score != null ? formatScore(entry.score) : "-"}</Text><Text style={styles.historyMeta}>{entry.memoriesViewed}m · {entry.guessesUsed}g</Text></>) : (<Text style={styles.historyExhausted}>Exhausted</Text>)}</View></View>))}</View>}</View>}
        <TooltipOverlay activeBadge={session.tooltip.activeBadge} onDismiss={session.tooltip.hide} definitions={{ score: { title: "Score breakdown", description: "Each solve starts at 10,000 points. Every memory opened reduces the ceiling by 2,000, each clue inspected by 500, each wrong guess by 2,500, and each second by 2. Restraint and speed maximize your score." }, clues: { title: "Clues opened", description: "Clues are hidden details embedded in each scene's imagery. Opening a clue reveals information about the figure but reduces your max score by 500 points per clue." }, guesses: { title: "Guesses remaining", description: "You have 5 guesses per episode. Each wrong guess deducts 2,500 points and may lock additional content behind deeper memories. Use them wisely." }, mint: { title: "Score minted on Mantle", description: "Your solve score is recorded as a permanent on-chain credential on the Mantle blockchain. Each mint requires a small gas fee and creates an immutable record tied to your wallet. Tap to view the transaction on the explorer." }, streak: { title: "Streak recorded on Mantle", description: "Your current and best streak are recorded on-chain alongside your score. Streaks track consecutive daily solves and reset if you miss a day. Tap to view the transaction on the explorer." } }} accentColor="#FBBF24" />
        <ActionToast visible={guessing.toastVisible && !toastDismissed} message={guessing.toastMessage} type={guessing.toastType} onDismiss={() => setToastDismissed(true)} />
      </ScrollView>
      {(isSolved || isExhausted) && !guessing.revealDismissed && guessing.revealFigure && (() => { const figure = session.figures.find((f) => f._id === guessing.revealFigure?.figureId); return (<EnhancedIdentityReveal figureName={guessing.solvedFigure?.name ?? ""} era={figure?.era ?? ""} region={figure?.region ?? ""} tags={figure?.tags ?? []} imageUrl={solvedSceneImageUrl} onContinue={() => guessing.setRevealDismissed(true)} />); })()}
      <SmartAccountUpgradeOverlay isVisible={delegate.state.showUpgradeOverlay} isUpgrading={session.wallet.smartAccount.isUpgrading} isUpgraded={session.wallet.smartAccount.isUpgraded} error={session.wallet.smartAccount.error} onDismiss={() => delegate.setShowUpgradeOverlay(false)} />
    </View>
  );
}

export default function Index() { return <IndexInner />; }
