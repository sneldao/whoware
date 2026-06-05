import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { MAX_GUESSES_PER_RUN } from "@/convex/scoring";
import { Ionicons } from "@expo/vector-icons";
import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GuessPanel, type FigureOption } from "@/components/who-ware/guess-panel";
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
import { useIdentity } from "@/hooks/use-identity";

const PLAYER_NAME_KEY = "whoware.player.name";
const DEFAULT_PLAYER_NAME = "Player";

export default function Index() {
  const insets = useSafeAreaInsets();

  const identity = useIdentity();
  const episode = useQuery(api.daily.getCurrentDrop);
  const nextDrop = useQuery(api.daily.getNextDrop);
  const guessCap = MAX_GUESSES_PER_RUN;
  const run = useQuery(
    api.runs.getActiveRun,
    episode && identity.identityId
      ? { episodeId: episode._id, identityId: identity.identityId }
      : "skip",
  );
  const figures = useQuery(api.figures.search, { query: "", limit: 10 }) ?? [];

  const seedCatalog = useMutation(api.figures.seedCatalog);
  const ensureDemoEpisode = useMutation(api.episodes.ensureDemoEpisode);
  const startRunMutation = useMutation(api.runs.startRun);
  const enterSceneMutation = useMutation(api.runs.enterScene);
  const openHotspotMutation = useMutation(api.runs.openHotspot);
  const submitGuessMutation = useMutation(api.runs.submitGuess);

  const { streak, recordSolve } = useStreak();
  const [playerName, setPlayerName] = useState(DEFAULT_PLAYER_NAME);
  const [playerNameLoaded, setPlayerNameLoaded] = useState(false);

  const leaderboardSnapshot = useQuery(
    api.episodes.leaderboard,
    episode && identity.identityId
      ? {
          episodeId: episode._id,
          playerName: playerName.trim() || DEFAULT_PLAYER_NAME,
          identityId: identity.identityId,
        }
      : "skip",
  );

  const [isGuessPanelOpen, setIsGuessPanelOpen] = useState(false);
  const [sceneIndex, setSceneIndex] = useState(0);
  const [solvedRun, setSolvedRun] = useState<{ elapsedMs: number; score: number } | null>(null);
  const [status, setStatus] = useState("You open your eyes in another life. Enter the first memory when you are ready.");
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const [mintTxHash, setMintTxHash] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [localHotspots, setLocalHotspots] = useState<string[]>([]);

  const wallet = useWallet();
  const { getHint, isGenerating: isHintGenerating } = useVeniceHint();
  const mintScoreOnChain = useAction(api.mantle.mintScore);
  const updateStreakOnChain = useAction(api.mantle.updateStreak);

  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(PLAYER_NAME_KEY).then((stored) => {
      if (cancelled) return;
      if (stored) setPlayerName(stored);
      setPlayerNameLoaded(true);
    }).catch(() => {
      if (cancelled) return;
      setPlayerNameLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!playerNameLoaded) return;
    AsyncStorage.setItem(PLAYER_NAME_KEY, playerName).catch(() => {});
  }, [playerName, playerNameLoaded]);

  useEffect(() => {
    let cancelled = false;
    async function seed() {
      try {
        await seedCatalog();
        if (cancelled) return;
        await ensureDemoEpisode();
      } catch {
        // Idempotent — ignore duplicate seed attempts.
      }
    }
    void seed();
    return () => {
      cancelled = true;
    };
  }, [seedCatalog, ensureDemoEpisode]);

  useEffect(() => {
    setIsGuessPanelOpen(false);
    setSolvedRun(null);
    setActiveHint(null);
    setMintTxHash(null);
    setIsMinting(false);
    setLocalHotspots([]);
    setStatus("You open your eyes in another life. Enter the first memory when you are ready.");
  }, [episode?._id, identity.identityId]);

  useEffect(() => {
    if (run) setSceneIndex(run.currentSceneIndex);
  }, [run?.currentSceneIndex]);

  const hasEnteredMemory = (run?.memoriesViewed ?? 0) > 0;
  const isSolved = run?.status === "solved";
  const isExhausted = run?.status === "exhausted";
  const guessesUsed = run?.guessesUsed ?? 0;
  const guessesLeft = Math.max(0, guessCap - guessesUsed);
  const hotspotsOpened = run?.hotspotsOpened ?? localHotspots.length;
  const lastScore = run?.score ?? null;

  const countdownTarget = isSolved || isExhausted
    ? (nextDrop?.dropsAt ?? null)
    : (episode?.closesAt ?? nextDrop?.dropsAt ?? null);
  const countdownLabel = episode?.closesAt && !isSolved && !isExhausted
    ? "Today's signal collapses in"
    : isSolved
      ? "Next body opens in"
      : "Next drop opens in";

  const figureOptions = useMemo<FigureOption[]>(
    () =>
      figures.map((f: { _id: Id<"figures">; canonicalName: string }) => ({
        figureId: f._id,
        displayName: f.canonicalName,
      })),
    [figures],
  );

  async function ensureRun() {
    if (!episode || !identity.identityId) {
      throw new Error("Episode or identity not ready");
    }
    const existing = runRef.current;
    if (existing) return existing;
    const fresh = await startRunMutation({
      episodeId: episode._id,
      identityId: identity.identityId,
      playerName: playerName.trim() || DEFAULT_PLAYER_NAME,
    });
    runRef.current = fresh;
    return fresh;
  }

  const handleEnterMemory = useCallback(async () => {
    if (!episode || isBusy) return;
    setIsBusy(true);
    try {
      const activeRun = await ensureRun();
      await enterSceneMutation({ runId: activeRun._id, sceneIndex: 0 });
      setStatus("The first memory resolves around you. Look carefully before asking the room for help.");
    } catch {
      // ignore
    } finally {
      setIsBusy(false);
    }
  }, [episode, isBusy, enterSceneMutation, playerName]);

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
  }, [episode, isBusy, playerName]);

  const handleOpenHotspot = useCallback(
    async (label: string) => {
      if (!episode) return;
      const hotspotKey = `${sceneIndex}:${label}`;
      setLocalHotspots((current) => (current.includes(hotspotKey) ? current : [...current, hotspotKey]));
      try {
        const activeRun = await ensureRun();
        await openHotspotMutation({ runId: activeRun._id, sceneIndex, hotspotLabel: label });
      } catch {
        // ignore
      }
    },
    [episode, sceneIndex, openHotspotMutation, playerName, identity.identityId],
  );

  const handleUnlockNextMemory = useCallback(async () => {
    if (!episode || isSolved || isBusy) return;
    const finished = run?.status === "solved" || run?.status === "exhausted";
    let nextIndex = -1;
    for (let i = sceneIndex + 1; i < episode.scenes.length; i++) {
      const s = episode.scenes[i] as { isMercy?: boolean };
      if (!s.isMercy || finished) { nextIndex = i; break; }
    }
    if (nextIndex < 0) return;
    setIsBusy(true);
    try {
      const activeRun = await ensureRun();
      await enterSceneMutation({ runId: activeRun._id, sceneIndex: nextIndex });
      setStatus("You surrender certainty for another memory. The answer is closer, but the score ceiling falls.");
    } catch {
      // ignore
    } finally {
      setIsBusy(false);
    }
  }, [episode, isSolved, isBusy, sceneIndex, enterSceneMutation, run?.status, identity.identityId]);

  function hasMoreMemories(): boolean {
    if (!episode) return false;
    const finished = run?.status === "solved" || run?.status === "exhausted";
    for (let i = sceneIndex + 1; i < episode.scenes.length; i++) {
      const s = episode.scenes[i] as { isMercy?: boolean };
      if (!s.isMercy || finished) return true;
    }
    return false;
  }

  async function handleGuess(_guessText: string, _figureId: string, submittedPlayerName: string) {
    if (!episode || isSolved || guessesLeft <= 0 || !identity.identityId) return;

    const figureId = _figureId as Id<"figures">;
    const activeRun = await ensureRun();

    if (!hasEnteredMemory) {
      await enterSceneMutation({ runId: activeRun._id, sceneIndex: 0 });
    }

    const result = await submitGuessMutation({
      runId: activeRun._id,
      figureId,
      playerName: submittedPlayerName,
      walletAddress: wallet.address ?? undefined,
    });

    if (result.isCorrect) {
      setIsGuessPanelOpen(false);
      const solvedAt = Date.now();
      void recordSolve(solvedAt);
      const finalScore = result.score ?? 0;
      setSolvedRun({ elapsedMs: result.elapsedMs, score: finalScore });
      const identityLabel = result.answer ?? "the figure";
      setStatus(`Identity anchored — you were ${identityLabel}. Final score: ${formatScore(finalScore)}.`);

      if (wallet.address) {
        setIsMinting(true);
        const episodeDay = Math.max(1, Math.floor(episode.dropsAt / 86400000));
        mintScoreOnChain({
          playerAddress: wallet.address,
          episodeDay,
          score: finalScore,
          memoriesViewed: activeRun.memoriesViewed,
          cluesOpened: hotspotsOpened,
          guessesUsed: result.guessesUsed,
        })
          .then((txHash) => {
            setMintTxHash(txHash);
            setIsMinting(false);
          })
          .catch(() => setIsMinting(false));

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
  }

  const waitingForBoot = !identity.isLoaded || episode === undefined || run === undefined;
  if (waitingForBoot) {
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

  const memoriesViewed = run?.memoriesViewed ?? 0;
  const totalMemories = episode.scenes.length;
  const revealProgress = isSolved
    ? 1
    : Math.min(0.85, (memoriesViewed / Math.max(1, totalMemories)) * 0.65 + hotspotsOpened * 0.04);
  const episodeNumber = parseInt(episode.slug.replace(/\D/g, ""), 10) || 1;
  const solvedSceneImageKey = episode.scenes[episode.scenes.length - 1]?.imageKey ?? currentScene.imageKey;
  const solvedSceneImageUrl = episode.scenes[episode.scenes.length - 1]?.imageUrl ?? currentScene.imageUrl;
  const solvedToday = isSolved && streak.current > 0;
  const runFinished = isSolved || isExhausted;

  const accessibleScenes = useMemo(() => {
    if (!episode) return [];
    return episode.scenes.filter((scene: { isMercy?: boolean }) => runFinished || !scene.isMercy);
  }, [episode, runFinished]);

  const nextAccessibleIndex = useMemo(() => {
    if (!episode) return -1;
    for (let i = sceneIndex + 1; i < episode.scenes.length; i++) {
      const s = episode.scenes[i] as { isMercy?: boolean };
      if (!s.isMercy || runFinished) return i;
    }
    return -1;
  }, [episode, sceneIndex, runFinished]);

  const moreMemoriesAvailable = nextAccessibleIndex >= 0;

  const accessiblePosition = useMemo(() => {
    if (!episode) return 0;
    const idx = accessibleScenes.findIndex(
      (s: { title: string }) => s.title === episode.scenes[sceneIndex]?.title,
    );
    return idx >= 0 ? idx : 0;
  }, [episode, accessibleScenes, sceneIndex]);

  const visibleScenes = useMemo<{ scene: Scene; episodeIndex: number }[]>(() => {
    if (!episode || !hasEnteredMemory) return [];
    return accessibleScenes
      .map((raw: { title: string; location: string; era: string; palette: string[]; panoramaPrompt: string; imageKey?: string; imageAspectRatio?: string; detailImageKeys?: string[]; mediaKind?: "image" | "motion" | "video"; motionPrompt?: string; ambientText: string; clues: { label: string; detail: string; x: number; y: number }[] }) => {
        const episodeIndex = episode.scenes.findIndex((s: { title: string }) => s.title === raw.title);
        if (episodeIndex < 0 || episodeIndex > sceneIndex) return null;
        return {
          scene: {
            title: raw.title,
            location: raw.location,
            era: raw.era,
            palette: raw.palette,
            panoramaPrompt: raw.panoramaPrompt,
            imageKey: raw.imageKey,
            imageAspectRatio: raw.imageAspectRatio,
            detailImageKeys: raw.detailImageKeys,
            mediaKind: raw.mediaKind,
            motionPrompt: raw.motionPrompt,
            ambientText: raw.ambientText,
            clues: raw.clues,
          },
          episodeIndex,
        };
      })
      .filter((entry): entry is { scene: Scene; episodeIndex: number } => entry !== null);
  }, [episode, hasEnteredMemory, sceneIndex, accessibleScenes]);

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
            imageUrl={currentScene.imageUrl}
            solvedImageUrl={solvedSceneImageUrl}
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
            <IdentityCountdown isSolved={isSolved} dropsAt={countdownTarget} statusLabel={countdownLabel} />

            <StreakBanner current={streak.current} best={streak.best} solvedToday={solvedToday} />

            {!hasEnteredMemory ? (
              <View style={styles.introActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleGuessNow}
                  disabled={isBusy}
                  style={({ pressed }) => [styles.secondaryIntroButton, pressed && styles.pressed, isBusy && styles.disabledButton]}
                >
                  <Ionicons name="finger-print" size={18} color="#FFF7ED" />
                  <Text style={styles.secondaryIntroButtonText}>{isGuessPanelOpen ? "Hide guess" : "Guess without a memory"}</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={handleEnterMemory}
                  disabled={isBusy}
                  style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, isBusy && styles.disabledButton]}
                >
                  <Text style={styles.primaryButtonText}>{isBusy ? "Entering memory…" : "Enter first memory"}</Text>
                  <Ionicons name="arrow-forward" size={18} color="#111827" />
                </Pressable>
              </View>
            ) : (
              <View style={styles.scoreStrip}>
                <MetricPill label="Score" value={lastScore != null ? `${formatScore(lastScore)} pts` : "—"} />
                <MetricPill label="Clues opened" value={`${hotspotsOpened}`} />
                <MetricPill label="Guesses" value={`${guessesLeft}/${guessCap}`} />
              </View>
            )}
          </View>
        </View>

        {isSolved && solvedRun ? (
          <>
            <ResultShareCard
              episodeNumber={episodeNumber}
              memoriesViewed={memoriesViewed}
              cluesOpened={hotspotsOpened}
              elapsedMs={solvedRun.elapsedMs}
              score={solvedRun.score}
              rank={leaderboardSnapshot?.playerRank?.rank ?? null}
              rankedCount={leaderboardSnapshot?.rankedCount ?? 0}
              streak={streak.current}
            />
            <OnChainBadge txHash={mintTxHash} isMinting={isMinting} />
          </>
        ) : null}

        {!hasEnteredMemory ? (
          <>
            {isGuessPanelOpen ? (
              <GuessPanel
                figures={figureOptions}
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
              sceneIndex={accessiblePosition}
              totalScenes={accessibleScenes.length}
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
                disabled={!moreMemoriesAvailable || isSolved || isBusy}
                onPress={handleUnlockNextMemory}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.secondaryButton,
                  (!moreMemoriesAvailable || isSolved) && styles.disabledButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.secondaryButtonText}>{moreMemoriesAvailable ? "Unlock next memory" : "All memories open"}</Text>
              </Pressable>
            </View>

            <View style={styles.sceneRail}>
              {visibleScenes.map(({ episodeIndex: epiIdx }, railIndex) => (
                <Pressable
                  key={episode.scenes[epiIdx]?.title ?? railIndex}
                  accessibilityRole="button"
                  onPress={() => setSceneIndex(epiIdx)}
                  style={[styles.scenePill, sceneIndex === epiIdx && styles.scenePillActive]}
                >
                  <Text style={[styles.scenePillText, sceneIndex === epiIdx && styles.scenePillTextActive]}>{railIndex + 1}</Text>
                </Pressable>
              ))}
            </View>

            {isGuessPanelOpen || isSolved || isExhausted || guessesLeft <= 0 ? (
              <GuessPanel
                figures={figureOptions}
                guessesLeft={guessesLeft}
                isSolved={isSolved || isExhausted}
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

            <Pressable style={styles.curatorLink} href="/curator">
              <Ionicons name="construct-outline" size={14} color="#475569" />
              <Text style={styles.curatorLinkText}>Curator</Text>
            </Pressable>
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

function formatScore(score: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(score);
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
  curatorLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    marginTop: 8,
  },
  curatorLinkText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "500",
  },
});
