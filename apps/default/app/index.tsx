import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { MAX_GUESSES_PER_RUN, MEMORY_PENALTY, HOTSPOT_PENALTY, GUESS_PENALTY } from "@/convex/scoring";
import { Ionicons } from "@expo/vector-icons";
import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GuessPanel, type FigureOption } from "@/components/who-ware/guess-panel";
import { CinematicHero } from "@/components/who-ware/cinematic-hero";
import { ClueLedger } from "@/components/who-ware/clue-ledger";
import { IdentityCountdown } from "@/components/who-ware/identity-countdown";
import { EnhancedIdentityReveal } from "@/components/who-ware/enhanced-identity-reveal";
import { IdentityHintButton } from "@/components/who-ware/identity-hint-button";
import { Leaderboard } from "@/components/who-ware/leaderboard";
import { OnChainBadge } from "@/components/who-ware/on-chain-badge";
import { PanoramaScene } from "@/components/who-ware/panorama-scene";
import { ResultShareCard } from "@/components/who-ware/result-share-card";
import { OnboardingFlow } from "@/components/who-ware/onboarding-flow";
import { EnhancedSceneTransition } from "@/components/who-ware/enhanced-scene-transition";
import { StreakBanner } from "@/components/who-ware/streak-banner";
import { IdentitySection } from "@/components/who-ware/identity-section";
import { ScoreTrajectory } from "@/components/who-ware/score-trajectory";
import { ActionToast } from "@/components/who-ware/action-toast";
import type { Scene } from "@/components/who-ware/panorama-scene";
import { useStreak } from "@/lib/use-streak";
import { hasCompletedOnboarding, markOnboardingComplete } from "@/lib/onboarding";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useWallet } from "@/hooks/use-wallet";
import { useVeniceHint } from "@/hooks/use-venice-hint";
import { useIdentity } from "@/hooks/use-identity";
import { useGameSounds } from "@/hooks/use-game-sounds";
import { commitGuessOnChain, revealGuessOnChain, generateGuessSalt } from "@/lib/wallet";
import { getEnvironment, buildMintDelegation, getDelegationTypedData, signWithMetaMask, sendViaSmartAccount } from "@/lib/smart-account";
import { SmartAccountUpgradeOverlay } from "@/components/who-ware/smart-account-upgrade-overlay";
import { SmartAccountBadge } from "@/components/who-ware/smart-account-badge";
import { TooltipOverlay, useTooltip } from "@/components/curator/tooltip";
import { TappableMetric } from "@/components/shared/tappable-metric";
import { useLastSolve } from "@/lib/use-last-solve";
import * as Haptics from "expo-haptics";

const PLAYER_NAME_KEY = "whoware.player.name";
const DEFAULT_PLAYER_NAME = "Player";

export default function Index() {
  const insets = useSafeAreaInsets();
  const [onboardingDone, setOnboardingDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    hasCompletedOnboarding().then((done) => {
      if (!cancelled) setOnboardingDone(done);
    });
    return () => { cancelled = true; };
  }, []);

  if (!onboardingDone) {
    return <OnboardingFlow onComplete={() => { markOnboardingComplete(); setOnboardingDone(true); }} />;
  }

  return <GameContent insets={insets} />;
}

function GameContent({ insets }: { insets: ReturnType<typeof useSafeAreaInsets> }) {
  const identity = useIdentity();
  const pushNotifications = usePushNotifications(identity.identityId ?? null);
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
  const archiveCount = useQuery(api.archive.listClosed, {})?.length ?? 0;

  const seedCatalog = useMutation(api.figures.seedCatalog);
  const startRunMutation = useMutation(api.runs.startRun);
  const enterSceneMutation = useMutation(api.runs.enterScene);
  const openHotspotMutation = useMutation(api.runs.openHotspot);
  const submitGuessMutation = useMutation(api.runs.submitGuess);

  const { streak, recordSolve } = useStreak();
  const gameSounds = useGameSounds();
  const { lastSolve, loaded: lastSolveLoaded, saveLastSolve, clearLastSolve } = useLastSolve();
  const playerHistory = useQuery(
    api.runs.getPlayerHistory,
    identity.identityId ? { identityId: identity.identityId } : "skip",
  );
  const [historyOpen, setHistoryOpen] = useState(false);
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
  const [commitState, setCommitState] = useState<{
    guess: string;
    salt: string;
    txHash: string | null;
    isCommitting: boolean;
    hasCommitted: boolean;
  } | null>(null);
  const [activeHint, setActiveHint] = useState<string | null>(null);
  const [mintTxHash, setMintTxHash] = useState<string | null>(null);
  const [streakTxHash, setStreakTxHash] = useState<string | null>(null);
  const [isMinting, setIsMinting] = useState(false);
  const [isStreakUpdating, setIsStreakUpdating] = useState(false);
  const hasMintedRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);
  const [localHotspots, setLocalHotspots] = useState<string[]>([]);
  const [discoveredClues, setDiscoveredClues] = useState<Array<{ sceneIndex: number; sceneTitle: string; label: string; detail: string }>>([]);
  const [revealDismissed, setRevealDismissed] = useState(false);
  const [solvedFigure, setSolvedFigure] = useState<{ name: string; figureId?: Id<"figures"> } | null>(null);
  const [showUpgradeOverlay, setShowUpgradeOverlay] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"info" | "warning" | "success" | "error">("info");
  const [delegationHash, setDelegationHash] = useState<string | null>(null);
  const [userOpHash, setUserOpHash] = useState<string | null>(null);
  const [isDelegating, setIsDelegating] = useState(false);

  function showToast(message: string, type: "info" | "warning" | "success" | "error" = "info") {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
  }

  const tooltip = useTooltip();
  const wallet = useWallet();
  const { isUpgraded: isSmartAccountUpgraded, isUpgrading: isSmartAccountUpgrading, upgrade: upgradeToSmartAccount } = wallet.smartAccount;

  // Show upgrade overlay when upgrade starts
  useEffect(() => {
    if (isSmartAccountUpgrading) {
      setShowUpgradeOverlay(true);
    }
  }, [isSmartAccountUpgrading]);

  // Auto-dismiss overlay when upgrade completes
  useEffect(() => {
    if (isSmartAccountUpgraded && showUpgradeOverlay) {
      const timer = setTimeout(() => setShowUpgradeOverlay(false), 4000);
      return () => clearTimeout(timer);
    }
  }, [isSmartAccountUpgraded, showUpgradeOverlay]);
  const { getHint, isGenerating: isHintGenerating } = useVeniceHint();
  const mintScoreOnChain = useAction(api.mantle.mintScore);
  const prepareMint = useAction(api.mantle.prepareMint);
  const updateStreakOnChain = useAction(api.mantle.updateStreak);
  const submitDelegation = useMutation(api.delegation.submitDelegation);
  const delegationManagerAddress = useQuery(api.delegation.getDelegationManagerAddress);

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
      } catch {
        // Idempotent — ignore duplicate seed attempts.
      }
    }
    void seed();
    return () => {
      cancelled = true;
    };
  }, [seedCatalog]);

  useEffect(() => {
    setIsGuessPanelOpen(false);
    setSolvedRun(null);
    setActiveHint(null);
    setMintTxHash(null);
    setStreakTxHash(null);
    setIsMinting(false);
    setIsStreakUpdating(false);
    hasMintedRef.current = false;
    setLocalHotspots([]);
    setDiscoveredClues([]);
    setRevealDismissed(false);
    setSolvedFigure(null);
    setCommitState(null);
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
      gameSounds.playClueFound();
      showToast(`−${HOTSPOT_PENALTY.toLocaleString()} pts from max score`, "warning");
      const hotspotKey = `${sceneIndex}:${label}`;
      setLocalHotspots((current) => (current.includes(hotspotKey) ? current : [...current, hotspotKey]));

      // Track the clue for the ledger
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
    [episode, sceneIndex, openHotspotMutation, playerName, identity.identityId, discoveredClues],
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
      showToast(`−${MEMORY_PENALTY.toLocaleString()} pts from max score`, "warning");
      gameSounds.playSceneEnter();
      if (Platform.OS !== "web") {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
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

      if (wallet.address && !hasMintedRef.current) {
        hasMintedRef.current = true;
        const episodeDay = Math.max(1, Math.floor(episode.dropsAt / 86400000));

        // Reveal on-chain if competitive mode and we committed
        if (episode.competitiveMode && commitState?.hasCommitted && wallet.address) {
          await revealGuessOnChain(wallet.address, episodeDay, commitState.guess, commitState.salt);
        }

        // ERC-7710 delegation: if smart account is upgraded, grant delegation to oracle
        if (isSmartAccountUpgraded && wallet.smartAccount && delegationManagerAddress) {
          setIsDelegating(true);
          try {
            const env = getEnvironment();
            const oracleAddr = "0xfb8a7B42070334CB196e94E542cEA13655e2f394" as `0x${string}`;
            const scoreContract = "0xd6ad76bed934ea5e5b25d635fba7889e782e691a" as `0x${string}`;
            const delegation = buildMintDelegation(env, wallet.address as `0x${string}`, oracleAddr, scoreContract);
            const typedData = getDelegationTypedData(delegation, env);

            const userSignature = await signWithMetaMask(wallet.address as `0x${string}`, typedData as any);
            if (userSignature) {
              const signedDelegation = { ...delegation, signature: userSignature };
              const result = await submitDelegation({ delegation: signedDelegation as any });
              if (result) {
                setDelegationHash(result.txHash);
                showToast("🔑 ERC-7710 delegation granted on-chain", "success");
              }
            }
          } catch (e) {
            console.error("Delegation flow failed:", e);
          }
          setIsDelegating(false);
        }

        setIsMinting(true);
        const smartAccountObj = wallet.smartAccount.smartAccount;
        if (isSmartAccountUpgraded && smartAccountObj) {
          prepareMint({
            playerAddress: wallet.address,
            episodeDay,
            score: finalScore,
            memoriesViewed: activeRun.memoriesViewed,
            cluesOpened: hotspotsOpened,
            guessesUsed: result.guessesUsed,
          })
            .then(async (prepared) => {
              if (prepared) {
                const uoHash = await sendViaSmartAccount(
                  smartAccountObj,
                  prepared.to as `0x${string}`,
                  prepared.data as `0x${string}`,
                );
                if (uoHash) {
                  setUserOpHash(uoHash);
                  showToast("🧠 Mint submitted via smart account", "success");
                }
                setMintTxHash(uoHash);
              } else {
                setMintTxHash(null);
              }
            })
            .catch(() => {})
            .finally(() => setIsMinting(false));
        } else {
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
            })
            .catch(() => {})
            .finally(() => setIsMinting(false));
        }

        setIsStreakUpdating(true);
        updateStreakOnChain({
          playerAddress: wallet.address,
          currentStreak: updatedStreak.current,
          bestStreak: updatedStreak.best,
          lastSolvedDay: Math.floor(solvedAt / 86400000),
          totalSolved: updatedStreak.totalSolved,
        })
          .then((txHash) => {
            setStreakTxHash(txHash);
          })
          .catch(() => {})
          .finally(() => setIsStreakUpdating(false));
      }
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
  const revealFigure = useMemo(() => {
    if (solvedFigure) return solvedFigure;
    if (isExhausted && episode?.figureId) {
      const f = figures.find((fig) => fig._id === episode.figureId);
      if (f) return { name: f.canonicalName, figureId: f._id };
    }
    return null;
  }, [solvedFigure, isExhausted, episode?.figureId, figures]);

  const handleShareResult = useCallback(async () => {
    const url = Platform.OS === "web" ? window.location.href : "https://whoware.vercel.app";
    try {
      await navigator.share({ title: "WhoWare", text: "I solved today's WhoWare!", url });
    } catch {
      // Share cancelled or not supported
    }
  }, []);

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
              <View style={styles.brandTextCol}>
                <Text style={styles.brand}>WhoWare</Text>
                <Text style={styles.drop}>Daily embodied history ritual</Text>
              </View>
              {archiveCount > 0 && (
                <Pressable style={styles.archiveBadge} href="/archive">
                  <Ionicons name="archive-outline" size={11} color="#FFF7ED" />
                  <Text style={styles.archiveBadgeText}>{archiveCount}</Text>
                </Pressable>
              )}
            </View>
            <IdentitySection
              walletAddress={wallet.address}
              isWalletConnected={wallet.isConnected}
              isCorrectChain={wallet.isCorrectChain}
              isSmartAccountUpgraded={isSmartAccountUpgraded}
              isSmartAccountUpgrading={isSmartAccountUpgrading}
              isMinting={isMinting}
              isMinted={!!mintTxHash}
              isStreakUpdating={isStreakUpdating}
              hasStreakTx={!!streakTxHash}
              type={hasEnteredMemory ? "during" : "start"}
              onConnect={wallet.connect}
              onUpgrade={upgradeToSmartAccount}
              onSwitchChain={wallet.switchChain}
            />
            <Text style={styles.headline}>Someone changed history{"\n"}from this room.</Text>
            <Text style={styles.subhead}>{status}</Text>
            <IdentityCountdown isSolved={isSolved} dropsAt={countdownTarget} statusLabel={countdownLabel} />

            {runFinished && archiveCount > 0 && (
              <View style={styles.suggestionsCard}>
                <Pressable style={styles.suggestionRow} href="/archive">
                  <Ionicons name="archive-outline" size={14} color="#A78BFA" />
                  <Text style={styles.suggestionText}>{archiveCount} past episode{archiveCount !== 1 ? 's' : ''} to explore</Text>
                </Pressable>
                <Pressable style={styles.suggestionRow} href="/curator">
                  <Ionicons name="layers" size={14} color="#A78BFA" />
                  <Text style={styles.suggestionText}>How episodes are made</Text>
                </Pressable>
              </View>
            )}

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
              <>
                <View style={styles.scoreStrip}>
                  <TappableMetric label="Score" value={lastScore != null ? `${formatScore(lastScore)} pts` : "—"} onPress={() => tooltip.show("score")} />
                  <TappableMetric label="Clues opened" value={`${hotspotsOpened}`} onPress={() => tooltip.show("clues")} />
                  <TappableMetric label="Guesses" value={`${guessesLeft}/${guessCap}`} onPress={() => tooltip.show("guesses")} />
                </View>
                {lastScore != null && (
                  <ScoreTrajectory
                    currentScore={lastScore}
                    maxPotential={10_000}
                    label="Score trajectory"
                  />
                )}
              </>
            )}
          </View>
        </View>

        {isSolved && solvedRun && (
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
              guessesUsed={solvedRun.guessesUsed}
              hotspotsOpened={solvedRun.hotspotsOpened}
              difficulty={episode.difficulty}
              figureEra={solvedFigure ? figures.find((f) => f._id === solvedFigure.figureId)?.era : undefined}
              figureRegion={solvedFigure ? figures.find((f) => f._id === solvedFigure.figureId)?.region : undefined}
            />
            <View style={styles.onChainRow}>
              {isSmartAccountUpgraded && (
                <OnChainBadge txHash={delegationHash} isMinting={isDelegating} mintingLabel="Granting ERC-7710 delegation…" verifiedLabel="ERC-7710 delegation live" onTooltipPress={() => tooltip.show("delegation")} />
              )}
              <OnChainBadge txHash={mintTxHash} isMinting={isMinting} mintingLabel="Minting score…" verifiedLabel="Score on Mantle" onTooltipPress={() => tooltip.show("mint")} />
              <OnChainBadge txHash={streakTxHash} isMinting={isStreakUpdating} mintingLabel="Updating streak…" verifiedLabel="Streak on Mantle" onTooltipPress={() => tooltip.show("streak")} />
            </View>
            {isSmartAccountUpgraded && (
              <SmartAccountBadge isUpgraded={true} isUpgrading={false} onUpgrade={async () => true} />
            )}
          </>
        )}
        {isSolved && (
          <View style={styles.nextActionsRow}>
            <Pressable style={styles.nextActionButton} href="/archive">
              <Ionicons name="archive-outline" size={14} color="#FFF7ED" />
              <Text style={styles.nextActionText}>Archive</Text>
            </Pressable>
            <Pressable style={styles.nextActionButton} onPress={handleShareResult}>
              <Ionicons name="share-outline" size={14} color="#FFF7ED" />
              <Text style={styles.nextActionText}>Share</Text>
            </Pressable>
            <Pressable style={styles.nextActionButton} onPress={() => setHistoryOpen(true)}>
              <Ionicons name="list-outline" size={14} color="#FFF7ED" />
              <Text style={styles.nextActionText}>History</Text>
            </Pressable>
            <Pressable style={styles.nextActionButton}>
              <Ionicons name="calendar-outline" size={14} color="#FFF7ED" />
              <Text style={styles.nextActionText}>Tomorrow</Text>
            </Pressable>
          </View>
        )}
        {isExhausted && (
          <View style={styles.exhaustedCard}>
            <Text style={styles.exhaustedTitle}>Case exhausted</Text>
            <Text style={styles.exhaustedSub}>All guesses exhausted. The identity is revealed above — the archive holds what remains.</Text>
            <View style={styles.nextActionsRow}>
              <Pressable style={styles.nextActionButton} href="/archive">
                <Ionicons name="archive-outline" size={14} color="#FFF7ED" />
                <Text style={styles.nextActionText}>Learn more in archive</Text>
              </Pressable>
              <Pressable style={styles.nextActionButton}>
                <Ionicons name="calendar-outline" size={14} color="#FFF7ED" />
                <Text style={styles.nextActionText}>Try again tomorrow</Text>
              </Pressable>
            </View>
          </View>
        )}

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
            <EnhancedSceneTransition
              sceneIndex={sceneIndex}
              title={currentScene.title}
              location={currentScene.location}
              era={currentScene.era}
              palette={currentScene.palette}
            >
              <PanoramaScene
                scene={currentScene}
                sceneIndex={accessiblePosition}
                totalScenes={accessibleScenes.length}
                onHotspotOpen={handleOpenHotspot}
                onGenerateHint={handleGenerateHint}
                activeHint={activeHint}
                isHintGenerating={isHintGenerating}
              />
            </EnhancedSceneTransition>

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

            <ClueLedger
              clues={discoveredClues}
              totalCluesAvailable={accessibleScenes.length * 3}
            />

            {episode && !isSolved && !isExhausted ? (
              <IdentityHintButton
                episodeId={episode._id}
                scenesRevealed={memoriesViewed}
                streak={streak.current}
                isRunActive={!isSolved && !isExhausted}
              />
            ) : null}

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

            {archiveCount > 0 ? (
              <Pressable style={styles.curatorLink} href="/archive">
                <Ionicons name="archive-outline" size={14} color="#475569" />
                <Text style={styles.curatorLinkText}>Archive · {archiveCount}</Text>
              </Pressable>
            ) : null}

            {/* Venice AI Pipeline showcase */}
            <View style={styles.venicePipelineCard}>
              <View style={styles.venicePipelineHeader}>
                <View style={styles.venicePipelineIcon}>
                  <Ionicons name="layers" size={16} color="#A78BFA" />
                </View>
                <View style={styles.venicePipelineInfo}>
                  <Text style={styles.venicePipelineTitle}>Autonomous Agent Pipeline</Text>
                  <Text style={styles.venicePipelineSub}>
                    Scenes · Images · Hints · Calibration — all generated by Venice AI
                  </Text>
                </View>
              </View>
              <View style={styles.venicePipelineSteps}>
                <StepBadge icon="search" label="Select" color="#A78BFA" />
                <Ionicons name="arrow-forward" size={10} color="rgba(255,247,237,0.2)" />
                <StepBadge icon="sparkles" label="Write" color="#A78BFA" />
                <Ionicons name="arrow-forward" size={10} color="rgba(255,247,237,0.2)" />
                <StepBadge icon="shield-checkmark" label="Verify" color="#22C55E" />
                <Ionicons name="arrow-forward" size={10} color="rgba(255,247,237,0.2)" />
                <StepBadge icon="trending-up" label="Calibrate" color="#FBBF24" />
                <Ionicons name="arrow-forward" size={10} color="rgba(255,247,237,0.2)" />
                <StepBadge icon="image" label="Render" color="#A78BFA" />
              </View>
              <Pressable
                href="/curator"
                style={({ pressed }) => [styles.venicePipelineAction, pressed && styles.pressed]}
              >
                <Text style={styles.venicePipelineActionText}>Open AI Curator Studio</Text>
                <Ionicons name="arrow-forward" size={14} color="#111827" />
              </Pressable>
            </View>

            <Pressable style={styles.curatorLink} href="/analytics">
              <Ionicons name="pulse-outline" size={14} color="#475569" />
              <Text style={styles.curatorLinkText}>Pulse</Text>
            </Pressable>

            <Pressable
              style={styles.curatorLink}
              onPress={pushNotifications.toggleNotifications}
              disabled={pushNotifications.isBusy}
            >
              <Ionicons
                name={pushNotifications.isOptedIn ? "notifications" : "notifications-off-outline"}
                size={14}
                color={pushNotifications.isOptedIn ? "#FBBF24" : "#475569"}
              />
              <Text style={styles.curatorLinkText}>
                {pushNotifications.isBusy
                  ? "Updating…"
                  : pushNotifications.isOptedIn
                    ? "Drop alerts on"
                    : "Drop alerts off"}
              </Text>
            </Pressable>
          </>
        )}

        {lastSolveLoaded && lastSolve && !isSolved && (
          <View style={styles.lastSolveCard}>
            <View style={styles.lastSolveHeader}>
              <Ionicons name="time-outline" size={14} color="#FBBF24" />
              <Text style={styles.lastSolveTitle}>Last solve</Text>
              <Pressable onPress={clearLastSolve} style={styles.lastSolveDismiss}>
                <Ionicons name="close" size={12} color="rgba(255,247,237,0.3)" />
              </Pressable>
            </View>
            <Text style={styles.lastSolveFigure}>{lastSolve.figureName}</Text>
            <View style={styles.lastSolveStats}>
              <View style={styles.lastSolveStat}>
                <Text style={styles.lastSolveStatValue}>{formatScore(lastSolve.score)}</Text>
                <Text style={styles.lastSolveStatLabel}>score</Text>
              </View>
              <View style={styles.lastSolveStat}>
                <Text style={styles.lastSolveStatValue}>{lastSolve.memoriesViewed}</Text>
                <Text style={styles.lastSolveStatLabel}>memories</Text>
              </View>
              <View style={styles.lastSolveStat}>
                <Text style={styles.lastSolveStatValue}>{lastSolve.guessesUsed}</Text>
                <Text style={styles.lastSolveStatLabel}>guesses</Text>
              </View>
            </View>
          </View>
        )}

        {playerHistory && playerHistory.length > 0 && (
          <View style={styles.historyCard}>
            <Pressable style={styles.historyToggle} onPress={() => setHistoryOpen((o) => !o)}>
              <Ionicons name="list-outline" size={14} color="#FBBF24" />
              <Text style={styles.historyTitle}>My history ({playerHistory.length})</Text>
              <Ionicons
                name={historyOpen ? "chevron-up" : "chevron-down"}
                size={14}
                color="rgba(255,247,237,0.3)"
              />
            </Pressable>
            {historyOpen && (
              <View style={styles.historyList}>
                {playerHistory.map((entry) => (
                  <View key={entry._id} style={styles.historyRow}>
                    <View style={styles.historyRowLeft}>
                      <Text style={styles.historyFigure}>{entry.figureName ?? entry.episodeSlug}</Text>
                      <Text style={styles.historyDate}>
                        {new Date(entry.startedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </Text>
                    </View>
                    <View style={styles.historyRowRight}>
                      {entry.status === "solved" ? (
                        <>
                          <Text style={styles.historyScore}>{entry.score != null ? formatScore(entry.score) : "-"}</Text>
                          <Text style={styles.historyMeta}>
                            {entry.memoriesViewed}m · {entry.guessesUsed}g
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.historyExhausted}>Exhausted</Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        <TooltipOverlay
          activeBadge={tooltip.activeBadge}
          onDismiss={tooltip.hide}
          definitions={{
            score: {
              title: "Score breakdown",
              description: "Each solve starts at 10,000 points. Every memory opened reduces the ceiling by 2,000, each clue inspected by 500, each wrong guess by 2,500, and each second by 2. Restraint and speed maximize your score.",
            },
            clues: {
              title: "Clues opened",
              description: "Clues are hidden details embedded in each scene's imagery. Opening a clue reveals information about the figure but reduces your max score by 500 points per clue.",
            },
            guesses: {
              title: "Guesses remaining",
              description: "You have 5 guesses per episode. Each wrong guess deducts 2,500 points and may lock additional content behind deeper memories. Use them wisely.",
            },
            mint: {
              title: "Score minted on Mantle",
              description: "Your solve score is recorded as a permanent on-chain credential on the Mantle blockchain. Each mint requires a small gas fee and creates an immutable record tied to your wallet. Tap to view the transaction on the explorer.",
            },
            streak: {
              title: "Streak recorded on Mantle",
              description: "Your current and best streak are recorded on-chain alongside your score. Streaks track consecutive daily solves and reset if you miss a day. Tap to view the transaction on the explorer.",
            },
          }}
          accentColor="#FBBF24"
        />

        <ActionToast
          visible={toastVisible}
          message={toastMessage}
          type={toastType}
          onDismiss={() => setToastVisible(false)}
        />
      </ScrollView>

      {(isSolved || isExhausted) && !revealDismissed && revealFigure && (() => {
        const figure = figures.find((f) => f._id === revealFigure.figureId);
        return (
          <EnhancedIdentityReveal
            figureName={solvedFigure.name}
            era={figure?.era ?? ""}
            region={figure?.region ?? ""}
            tags={figure?.tags ?? []}
            imageUrl={solvedSceneImageUrl}
            onContinue={() => setRevealDismissed(true)}
          />
        );
      })()}

      <SmartAccountUpgradeOverlay
        isVisible={showUpgradeOverlay}
        isUpgrading={isSmartAccountUpgrading}
        isUpgraded={isSmartAccountUpgraded}
        error={wallet.smartAccount.error}
        onDismiss={() => setShowUpgradeOverlay(false)}
      />
    </View>
  );
}

function StepBadge({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <View style={styles.stepBadge}>
      <Ionicons name={icon as any} size={10} color={color} />
      <Text style={[styles.stepBadgeLabel, { color }]}>{label}</Text>
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
  stepBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255, 247, 237, 0.04)",
  },
  stepBadgeLabel: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  venicePipelineCard: {
    padding: 16,
    gap: 12,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: "rgba(167, 139, 250, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.15)",
  },
  venicePipelineHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  venicePipelineIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(167, 139, 250, 0.12)",
  },
  venicePipelineInfo: {
    flex: 1,
    gap: 2,
  },
  venicePipelineTitle: {
    color: "#FFF7ED",
    fontSize: 15,
    fontWeight: "900",
  },
  venicePipelineSub: {
    color: "rgba(255, 247, 237, 0.4)",
    fontSize: 11,
    fontWeight: "600",
    lineHeight: 15,
  },
  venicePipelineSteps: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  venicePipelineAction: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: "#A78BFA",
  },
  venicePipelineActionText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "900",
  },
  curatorLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: 12,
    marginTop: 8,
  },
  onChainRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  curatorLinkText: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "500",
  },
  lastSolveCard: {
    padding: 16,
    gap: 10,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: "rgba(251, 191, 36, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.15)",
  },
  lastSolveHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  lastSolveTitle: {
    flex: 1,
    color: "#FBBF24",
    fontSize: 13,
    fontWeight: "900",
  },
  lastSolveDismiss: {
    padding: 4,
  },
  lastSolveFigure: {
    color: "#FFF7ED",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  lastSolveStats: {
    flexDirection: "row",
    gap: 16,
  },
  lastSolveStat: {
    gap: 2,
  },
  lastSolveStatValue: {
    color: "#FFF7ED",
    fontSize: 18,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  lastSolveStatLabel: {
    color: "rgba(255, 247, 237, 0.4)",
    fontSize: 11,
    fontWeight: "700",
  },
  historyCard: {
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.06)",
    overflow: "hidden",
  },
  historyToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 16,
  },
  historyTitle: {
    flex: 1,
    color: "#FFF7ED",
    fontSize: 13,
    fontWeight: "900",
  },
  historyList: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.03)",
  },
  historyRowLeft: {
    flex: 1,
    gap: 2,
  },
  historyFigure: {
    color: "#FFF7ED",
    fontSize: 14,
    fontWeight: "900",
  },
  historyDate: {
    color: "rgba(255, 247, 237, 0.35)",
    fontSize: 11,
    fontWeight: "600",
  },
  historyRowRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  historyScore: {
    color: "#FBBF24",
    fontSize: 15,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  historyMeta: {
    color: "rgba(255, 247, 237, 0.35)",
    fontSize: 11,
    fontWeight: "600",
  },
  historyExhausted: {
    color: "rgba(239, 68, 68, 0.6)",
    fontSize: 12,
    fontWeight: "700",
  },
  brandTextCol: {
    flex: 1,
  },
  archiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(251, 191, 36, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.2)",
  },
  archiveBadgeText: {
    color: "#FFF7ED",
    fontSize: 12,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  suggestionsCard: {
    padding: 14,
    gap: 10,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(167, 139, 250, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.12)",
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  suggestionText: {
    color: "rgba(255, 247, 237, 0.7)",
    fontSize: 13,
    fontWeight: "700",
  },
  nextActionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  nextActionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.1)",
  },
  nextActionText: {
    color: "#FFF7ED",
    fontSize: 12,
    fontWeight: "800",
  },
  exhaustedCard: {
    padding: 18,
    gap: 12,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: "rgba(239, 68, 68, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.15)",
  },
  exhaustedTitle: {
    color: "#FCA5A5",
    fontSize: 16,
    fontWeight: "900",
  },
  exhaustedSub: {
    color: "rgba(255, 247, 237, 0.55)",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
  },
});
