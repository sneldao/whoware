import { api } from "@/convex/_generated/api";
import { Ionicons } from "@expo/vector-icons";
import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GuessPanel } from "@/components/who-ware/guess-panel";
import { CinematicHero } from "@/components/who-ware/cinematic-hero";
import { IdentityCountdown } from "@/components/who-ware/identity-countdown";
import { Leaderboard } from "@/components/who-ware/leaderboard";
import { OnChainBadge } from "@/components/who-ware/on-chain-badge";
import { PanoramaScene } from "@/components/who-ware/panorama-scene";
import { ResultShareCard } from "@/components/who-ware/result-share-card";
import { StreakBanner } from "@/components/who-ware/streak-banner";
import { WalletConnect } from "@/components/who-ware/wallet-connect";
import type { Scene } from "@/components/who-ware/panorama-scene";
import { useStreak } from "@/lib/use-streak";
import { useWallet } from "@/hooks/use-wallet";
import { useVeniceHint } from "@/hooks/use-venice-hint";

const INITIAL_GUESSES = 3;
const EPISODE_EPOCH_MS = Date.UTC(2025, 0, 1);

export default function Index() {
  const insets = useSafeAreaInsets();
  const ensureDemoEpisode = useMutation(api.episodes.ensureDemoEpisode);
  const submitGuess = useMutation(api.episodes.submitGuess);
  const episode = useQuery(api.episodes.getActive);
  const { streak, recordSolve } = useStreak();
  const [playerName, setPlayerName] = useState("Player");
  const leaderboardSnapshot = useQuery(
    api.episodes.leaderboard,
    episode ? { episodeId: episode._id, playerName: playerName.trim() || "Player" } : "skip",
  );

  const [hasEnteredMemory, setHasEnteredMemory] = useState(false);
  const [isGuessPanelOpen, setIsGuessPanelOpen] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [guessesLeft, setGuessesLeft] = useState(INITIAL_GUESSES);
  const [isSolved, setIsSolved] = useState(false);
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null);
  const [openedHotspots, setOpenedHotspots] = useState<string[]>([]);
  const [lastScore, setLastScore] = useState<number | null>(null);
  const [solvedRun, setSolvedRun] = useState<{ elapsedMs: number; score: number } | null>(null);
  const [status, setStatus] = useState("You open your eyes in another life. Enter the first memory when you are ready.");
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const [mintTxHash, setMintTxHash] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState(false);

  const wallet = useWallet();
  const { getHint, isGenerating: isHintGenerating } = useVeniceHint();
  const mintScoreOnChain = useAction(api.mantle.mintScore);
  const updateStreakOnChain = useAction(api.mantle.updateStreak);

  useEffect(() => {
    void ensureDemoEpisode();
  }, [ensureDemoEpisode]);

  useEffect(() => {
    setHasEnteredMemory(false);
    setIsGuessPanelOpen(false);
    setSceneIndex(0);
    setGuessesLeft(INITIAL_GUESSES);
    setIsSolved(false);
    setRunStartedAt(null);
    setOpenedHotspots([]);
    setLastScore(null);
    setSolvedRun(null);
    setActiveHint(null);
    setMintTxHash(null);
    setIsMinting(false);
    setStatus("You open your eyes in another life. Enter the first memory when you are ready.");
  }, [episode?._id]);

  const visibleScenes = useMemo<Scene[]>(() => {
    if (!episode || !hasEnteredMemory) return [];
    return episode.scenes.slice(0, sceneIndex + 1);
  }, [episode, hasEnteredMemory, sceneIndex]);

  const handleEnterMemory = useCallback(() => {
    setHasEnteredMemory(true);
    setRunStartedAt((current) => current ?? Date.now());
    setStatus("The first memory resolves around you. Look carefully before asking the room for help.");
  }, []);

  const handleGuessNow = useCallback(() => {
    setRunStartedAt((current) => current ?? Date.now());
    setIsGuessPanelOpen((current) => !current);
    setStatus("You can name the identity before opening a memory. Unassisted solves keep the highest score ceiling.");
  }, []);

  const handleOpenHotspot = useCallback(
    (label: string) => {
      const hotspotKey = `${sceneIndex}:${label}`;
      setOpenedHotspots((current) => (current.includes(hotspotKey) ? current : [...current, hotspotKey]));
    },
    [sceneIndex],
  );

  const handleUnlockNextMemory = useCallback(() => {
    if (!episode || sceneIndex >= episode.scenes.length - 1 || isSolved) return;
    setRunStartedAt((current) => current ?? Date.now());
    setSceneIndex((current) => Math.min(current + 1, episode.scenes.length - 1));
    setStatus("You surrender certainty for another memory. The answer is closer, but the score ceiling falls.");
  }, [episode, isSolved, sceneIndex]);

  async function handleGuess(guess: string, submittedPlayerName: string) {
    if (!episode || isSolved || guessesLeft <= 0) return;

    const memoriesViewed = hasEnteredMemory ? sceneIndex + 1 : 0;
    const guessesUsed = INITIAL_GUESSES - guessesLeft + 1;
    const localScore = estimateScore(memoriesViewed, openedHotspots.length, guessesUsed, runStartedAt);
    const result = await submitGuess({
      episodeId: episode._id,
      playerName: submittedPlayerName,
      guess,
      scenesRevealed: memoriesViewed,
      hotspotsOpened: openedHotspots.length,
      guessesUsed,
      startedAt: runStartedAt ?? Date.now(),
      walletAddress: wallet.address ?? undefined,
    });

    const scoredResult = extractScore(result) ?? localScore;
    setLastScore(scoredResult);

    if (result.isCorrect) {
      setIsSolved(true);
      setIsGuessPanelOpen(false);
      const solvedAt = Date.now();
      void recordSolve(solvedAt);
      const elapsedMs = extractElapsed(result) ?? Math.max(0, solvedAt - (runStartedAt ?? solvedAt));
      setSolvedRun({ elapsedMs, score: scoredResult });
      setStatus(`Identity anchored — you were ${result.answer}. Final score: ${formatScore(scoredResult)}.`);

      if (wallet.address) {
        setIsMinting(true);
        const episodeDay = Math.max(1, Math.floor((episode.activeAt - EPISODE_EPOCH_MS) / 86400000) + 1);
        mintScoreOnChain({
          playerAddress: wallet.address,
          episodeDay,
          score: scoredResult,
          memoriesViewed,
          cluesOpened: openedHotspots.length,
          guessesUsed,
        }).then((txHash) => {
          setMintTxHash(txHash);
          setIsMinting(false);
        }).catch(() => setIsMinting(false));

        updateStreakOnChain({
          playerAddress: wallet.address,
          currentStreak: streak.current,
          bestStreak: streak.best,
          lastSolvedDay: Math.floor(solvedAt / 86400000),
          totalSolved: streak.current,
        }).catch(() => {});
      }

      return;
    }

    const nextGuessesLeft = Math.max(guessesLeft - 1, 0);
    setGuessesLeft(nextGuessesLeft);

    if (nextGuessesLeft <= 0) {
      setStatus("The signal fades. The archive closes around the wrong name.");
      return;
    }

    if (!hasEnteredMemory) {
      setStatus("That name does not fit yet. Open the first memory or spend another unassisted guess.");
      return;
    }

    if (sceneIndex < episode.scenes.length - 1) {
      setSceneIndex(sceneIndex + 1);
      setStatus("The body rejects that name. A deeper memory surfaces.");
      return;
    }

    setStatus("That name does not fit. You have reached the last memory.");
  }

  if (episode === undefined) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#FBBF24" />
        <Text style={styles.loadingText}>Opening today’s archive…</Text>
      </View>
    );
  }

  if (episode === null) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#FBBF24" />
        <Text style={styles.loadingText}>Preparing the first episode…</Text>
      </View>
    );
  }

  const currentScene = episode.scenes[sceneIndex] ?? episode.scenes[0];

  if (!currentScene) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#FBBF24" />
        <Text style={styles.loadingText}>Generating today’s memories…</Text>
      </View>
    );
  }

  const hasMoreMemories = sceneIndex < episode.scenes.length - 1;
  const memoriesViewed = hasEnteredMemory ? sceneIndex + 1 : 0;
  const scorePreview = estimateScore(memoriesViewed, openedHotspots.length, INITIAL_GUESSES - guessesLeft + 1, runStartedAt);
  const totalMemories = episode.scenes.length;
  const revealProgress = isSolved ? 1 : Math.min(0.85, memoriesViewed / Math.max(1, totalMemories) * 0.65 + openedHotspots.length * 0.04);
  const episodeNumber = Math.max(1, Math.floor((episode.activeAt - EPISODE_EPOCH_MS) / 86400000) + 1);
  const solvedSceneImageKey = episode.scenes[episode.scenes.length - 1]?.imageKey ?? currentScene.imageKey;
  const solvedToday = isSolved && streak.current > 0;

  async function handleGenerateHint(clueLabel: string) {
    setActiveHint(null);
    const hint = await getHint({
      sceneAmbientText: currentScene.ambientText,
      clueLabel,
      sceneLocation: currentScene.location,
      sceneEra: currentScene.era,
    });
    setActiveHint(hint);
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 28 }]}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.hero}>
          <CinematicHero
            imageKey={currentScene.imageKey}
            revealProgress={revealProgress}
            isSolved={isSolved}
            solvedImageKey={solvedSceneImageKey}
          />
          <View style={styles.heroContent}>
            <View style={styles.brandRow}>
              <View style={styles.logoMark}>
                <Ionicons name="eye" size={22} color="#111827" />
              </View>
              <View>
                <Text style={styles.brand}>WhoWare</Text>
                <Text style={styles.drop}>Daily embodied history ritual</Text>
              </View>
            </View>
            <WalletConnect
              address={wallet.address}
              isConnected={wallet.isConnected}
              isCorrectChain={wallet.isCorrectChain}
              isConnecting={wallet.isConnecting}
              onConnect={wallet.connect}
              onSwitchChain={wallet.switchChain}
            />
            <Text style={styles.headline}>Someone changed history{"\n"}from this room.</Text>
            <Text style={styles.subhead}>{status}</Text>
            <IdentityCountdown isSolved={isSolved} />

            <StreakBanner current={streak.current} best={streak.best} solvedToday={solvedToday} />

            {!hasEnteredMemory ? (
              <View style={styles.introActions}>
                <Pressable accessibilityRole="button" onPress={handleGuessNow} style={({ pressed }) => [styles.secondaryIntroButton, pressed && styles.pressed]}>
                  <Ionicons name="finger-print" size={18} color="#FFF7ED" />
                  <Text style={styles.secondaryIntroButtonText}>{isGuessPanelOpen ? "Hide guess" : "Guess without a memory"}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" onPress={handleEnterMemory} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                  <Text style={styles.primaryButtonText}>Enter first memory</Text>
                  <Ionicons name="arrow-forward" size={18} color="#111827" />
                </Pressable>
              </View>
            ) : (
              <View style={styles.scoreStrip}>
                <MetricPill label="Potential" value={`${formatScore(lastScore ?? scorePreview)} pts`} />
                <MetricPill label="Clues opened" value={`${openedHotspots.length}`} />
                <MetricPill label="Guesses" value={`${guessesLeft}/${INITIAL_GUESSES}`} />
              </View>
            )}
          </View>
        </View>

        {isSolved && solvedRun ? (
          <ResultShareCard
            episodeNumber={episodeNumber}
            memoriesViewed={memoriesViewed}
            cluesOpened={openedHotspots.length}
            elapsedMs={solvedRun.elapsedMs}
            score={solvedRun.score}
            rank={leaderboardSnapshot?.playerRank?.rank ?? null}
            rankedCount={leaderboardSnapshot?.rankedCount ?? 0}
            streak={streak.current}
          />
          <OnChainBadge txHash={mintTxHash} isMinting={isMinting} />
        ) : null}

        {!hasEnteredMemory ? (
          <>
            {isGuessPanelOpen ? (
              <GuessPanel
                options={episode.answerOptions}
                guessesLeft={guessesLeft}
                isSolved={isSolved}
                playerName={playerName}
                onPlayerNameChange={setPlayerName}
                onSubmit={handleGuess}
              />
            ) : null}

            <View style={styles.ritualCard}>
              <View style={styles.ritualHeader}>
                <Ionicons name="sparkles" size={18} color="#FBBF24" />
                <Text style={styles.ritualTitle}>Score by restraint</Text>
              </View>
              <Text style={styles.ritualText}>
                Guess before opening a memory for the highest possible score. Each visual memory, inspected detail, wrong guess, and extra second lowers the final leaderboard ceiling.
              </Text>
            </View>
          </>
        ) : (
          <>
            <PanoramaScene
              scene={currentScene}
              sceneIndex={sceneIndex}
              totalScenes={episode.scenes.length}
              onHotspotOpen={handleOpenHotspot}
              onGenerateHint={handleGenerateHint}
              activeHint={activeHint}
              isHintGenerating={isHintGenerating}
            />

            <View style={styles.actionBar}>
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsGuessPanelOpen((current) => !current)}
                style={({ pressed }) => [styles.actionButton, styles.guessButton, pressed && styles.pressed]}
              >
                <Ionicons name="finger-print" size={18} color="#111827" />
                <Text style={styles.guessButtonText}>{isGuessPanelOpen ? "Hide guesses" : "Name identity"}</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                disabled={!hasMoreMemories || isSolved}
                onPress={handleUnlockNextMemory}
                style={({ pressed }) => [styles.actionButton, styles.secondaryButton, (!hasMoreMemories || isSolved) && styles.disabledButton, pressed && styles.pressed]}
              >
                <Text style={styles.secondaryButtonText}>{hasMoreMemories ? "Unlock next memory" : "All memories open"}</Text>
              </Pressable>
            </View>

            <View style={styles.sceneRail}>
              {visibleScenes.map((scene, index) => (
                <Pressable
                  key={scene.title}
                  accessibilityRole="button"
                  onPress={() => setSceneIndex(index)}
                  style={[styles.scenePill, sceneIndex === index && styles.scenePillActive]}
                >
                  <Text style={[styles.scenePillText, sceneIndex === index && styles.scenePillTextActive]}>{index + 1}</Text>
                </Pressable>
              ))}
            </View>

            {isGuessPanelOpen || isSolved || guessesLeft <= 0 ? (
              <GuessPanel
                options={episode.answerOptions}
                guessesLeft={guessesLeft}
                isSolved={isSolved}
                playerName={playerName}
                onPlayerNameChange={setPlayerName}
                onSubmit={handleGuess}
              />
            ) : null}

            <Leaderboard
              entries={leaderboardSnapshot?.entries ?? []}
              playerRank={leaderboardSnapshot?.playerRank ?? null}
              rankedCount={leaderboardSnapshot?.rankedCount ?? 0}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

interface MetricPillProps {
  label: string;
  value: string;
}

function MetricPill({ label, value }: MetricPillProps) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function estimateScore(memoriesViewed: number, hotspotsOpened: number, guessesUsed: number, startedAt: number | null): number {
  const elapsedMs = startedAt ? Math.max(0, Date.now() - startedAt) : 0;
  const timePenalty = Math.floor(elapsedMs / 10000) * 10;
  return Math.max(0, 10000 - memoriesViewed * 1200 - hotspotsOpened * 250 - Math.max(0, guessesUsed - 1) * 600 - timePenalty);
}

function formatScore(score: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(score);
}

function extractScore(result: unknown): number | null {
  if (!isRecord(result)) return null;
  return typeof result.score === "number" ? result.score : null;
}

function extractElapsed(result: unknown): number | null {
  if (!isRecord(result)) return null;
  return typeof result.elapsedMs === "number" ? result.elapsedMs : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#070A12",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    gap: 18,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#070A12",
  },
  loadingText: {
    color: "#FFF7ED",
    fontSize: 16,
    fontWeight: "800",
  },
  hero: {
    gap: 18,
    padding: 20,
    borderRadius: 32,
    borderCurve: "continuous",
    backgroundColor: "#1C1106",
    borderWidth: 1,
    borderColor: "rgba(248, 231, 201, 0.13)",
    overflow: "hidden",
  },
  heroContent: {
    gap: 18,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 16,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBBF24",
  },
  brand: {
    color: "#FFF7ED",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  drop: {
    color: "rgba(255, 247, 237, 0.5)",
    fontSize: 13,
    fontWeight: "800",
  },
  headline: {
    color: "#FFF7ED",
    fontSize: 42,
    lineHeight: 44,
    fontWeight: "900",
    letterSpacing: -1.7,
  },
  subhead: {
    color: "rgba(255, 247, 237, 0.72)",
    fontSize: 16,
    lineHeight: 23,
    fontWeight: "700",
  },
  primaryButton: {
    minHeight: 54,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "#FBBF24",
  },
  primaryButtonText: {
    color: "#111827",
    fontSize: 16,
    fontWeight: "900",
  },
  introActions: {
    gap: 10,
  },
  secondaryIntroButton: {
    minHeight: 52,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.13)",
  },
  secondaryIntroButtonText: {
    color: "#FFF7ED",
    fontSize: 16,
    fontWeight: "900",
  },
  scoreStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  metricPill: {
    flexGrow: 1,
    minWidth: 96,
    padding: 12,
    gap: 3,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.1)",
  },
  metricLabel: {
    color: "rgba(255, 247, 237, 0.48)",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  metricValue: {
    color: "#FFF7ED",
    fontSize: 15,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  actionBar: {
    flexDirection: "row",
    gap: 10,
  },
  actionButton: {
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 18,
    borderCurve: "continuous",
  },
  guessButton: {
    flex: 1,
    backgroundColor: "#FBBF24",
  },
  guessButtonText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "900",
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "rgba(255, 247, 237, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.12)",
  },
  secondaryButtonText: {
    color: "#FFF7ED",
    fontSize: 14,
    fontWeight: "900",
  },
  disabledButton: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.72,
  },
  sceneRail: {
    flexDirection: "row",
    gap: 10,
  },
  scenePill: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.1)",
  },
  scenePillActive: {
    backgroundColor: "#FBBF24",
  },
  scenePillText: {
    color: "rgba(255, 247, 237, 0.72)",
    fontSize: 16,
    fontWeight: "900",
  },
  scenePillTextActive: {
    color: "#111827",
  },
  ritualCard: {
    padding: 18,
    gap: 10,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.2)",
  },
  ritualHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ritualTitle: {
    color: "#FBBF24",
    fontSize: 16,
    fontWeight: "900",
  },
  ritualText: {
    color: "rgba(255, 247, 237, 0.68)",
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },
});
