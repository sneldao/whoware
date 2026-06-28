import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { useIdentity } from "@/hooks/use-identity";
import { usePushNotifications } from "@/hooks/use-push-notifications";
import { useGameSounds } from "@/hooks/use-game-sounds";
import { useWallet } from "@/hooks/use-wallet";
import { useStreak } from "@/hooks/use-streak";
import { useLastSolve } from "@/hooks/use-last-solve";
import { hasCompletedOnboarding, markOnboardingComplete } from "@/lib/onboarding";
import { useTooltip } from "@/components/curator/tooltip";

const PLAYER_NAME_KEY = "whoware.player.name";
const DEFAULT_PLAYER_NAME = "Player";

export interface UseGameSessionReturn {
  onboardingDone: boolean;
  markOnboardingDone: () => void;
  episode: ReturnType<typeof useQuery<typeof api.daily.getCurrentDrop>>;
  nextDrop: ReturnType<typeof useQuery<typeof api.daily.getNextDrop>>;
  run: ReturnType<typeof useQuery<typeof api.runs.getActiveRun>>;
  figures: NonNullable<ReturnType<typeof useQuery<typeof api.figures.search>>>;
  archiveCount: number;
  playerHistory: ReturnType<typeof useQuery<typeof api.runs.getPlayerHistory>>;
  leaderboardSnapshot: ReturnType<typeof useQuery<typeof api.episodes.leaderboard>>;
  playerName: string;
  setPlayerName: (name: string) => void;
  playerNameLoaded: boolean;
  runRef: React.MutableRefObject<ReturnType<typeof useQuery<typeof api.runs.getActiveRun>>>;
  ensureRun: () => Promise<NonNullable<ReturnType<typeof useQuery<typeof api.runs.getActiveRun>>>>;
  seedCatalog: ReturnType<typeof useMutation<typeof api.figures.seedCatalog>>;
  startRunMutation: ReturnType<typeof useMutation<typeof api.runs.startRun>>;
  enterSceneMutation: ReturnType<typeof useMutation<typeof api.runs.enterScene>>;
  openHotspotMutation: ReturnType<typeof useMutation<typeof api.runs.openHotspot>>;
  submitGuessMutation: ReturnType<typeof useMutation<typeof api.runs.submitGuess>>;
  identity: ReturnType<typeof useIdentity>;
  pushNotifications: ReturnType<typeof usePushNotifications>;
  streak: ReturnType<typeof useStreak>["streak"];
  recordSolve: ReturnType<typeof useStreak>["recordSolve"];
  gameSounds: ReturnType<typeof useGameSounds>;
  lastSolve: ReturnType<typeof useLastSolve>["lastSolve"];
  lastSolveLoaded: ReturnType<typeof useLastSolve>["loaded"];
  saveLastSolve: ReturnType<typeof useLastSolve>["saveLastSolve"];
  clearLastSolve: ReturnType<typeof useLastSolve>["clearLastSolve"];
  insets: ReturnType<typeof useSafeAreaInsets>;
  tooltip: ReturnType<typeof useTooltip>;
  wallet: ReturnType<typeof useWallet>;
}

export function useGameSession(): UseGameSessionReturn {
  const [onboardingDone, setOnboardingDone] = useState(false);
  const identity = useIdentity();
  const pushNotifications = usePushNotifications(identity.identityId ?? null);
  const insets = useSafeAreaInsets();
  const tooltip = useTooltip();
  const wallet = useWallet();
  const gameSounds = useGameSounds();
  const { streak, recordSolve } = useStreak();
  const { lastSolve, loaded: lastSolveLoaded, saveLastSolve, clearLastSolve } = useLastSolve();

  const episode = useQuery(api.daily.getCurrentDrop);
  const nextDrop = useQuery(api.daily.getNextDrop);
  const run = useQuery(
    api.runs.getActiveRun,
    episode && identity.identityId
      ? { episodeId: episode._id, identityId: identity.identityId }
      : "skip",
  );
  const figures = useQuery(api.figures.search, { query: "", limit: 10 }) ?? [];
  const archiveCount = useQuery(api.archive.listClosed, {})?.length ?? 0;

  // Player name must be declared before the leaderboard query that depends on it
  const [playerName, setPlayerName] = useState(DEFAULT_PLAYER_NAME);
  const [playerNameLoaded, setPlayerNameLoaded] = useState(false);

  const playerHistory = useQuery(
    api.runs.getPlayerHistory,
    identity.identityId ? { identityId: identity.identityId } : "skip",
  );
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

  const seedCatalog = useMutation(api.figures.seedCatalog);
  const startRunMutation = useMutation(api.runs.startRun);
  const enterSceneMutation = useMutation(api.runs.enterScene);
  const openHotspotMutation = useMutation(api.runs.openHotspot);
  const submitGuessMutation = useMutation(api.runs.submitGuess);

  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  // Onboarding load
  useEffect(() => {
    let cancelled = false;
    hasCompletedOnboarding().then((done) => {
      if (!cancelled) setOnboardingDone(done);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const markOnboardingDone = useCallback(() => {
    void markOnboardingComplete();
    setOnboardingDone(true);
  }, []);

  // Player name load
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(PLAYER_NAME_KEY)
      .then((stored) => {
        if (cancelled) return;
        if (stored) setPlayerName(stored);
        setPlayerNameLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setPlayerNameLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Player name persist
  useEffect(() => {
    if (!playerNameLoaded) return;
    AsyncStorage.setItem(PLAYER_NAME_KEY, playerName).catch(() => {});
  }, [playerName, playerNameLoaded]);

  // Seed catalog once on mount
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

  const ensureRun = useCallback(async () => {
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
  }, [episode, identity.identityId, playerName, startRunMutation]);

  return {
    onboardingDone,
    markOnboardingDone,
    episode,
    nextDrop,
    run,
    figures,
    archiveCount,
    playerHistory,
    leaderboardSnapshot,
    playerName,
    setPlayerName,
    playerNameLoaded,
    runRef,
    ensureRun,
    seedCatalog,
    startRunMutation,
    enterSceneMutation,
    openHotspotMutation,
    submitGuessMutation,
    identity,
    pushNotifications,
    streak,
    recordSolve,
    gameSounds,
    lastSolve,
    lastSolveLoaded,
    saveLastSolve,
    clearLastSolve,
    insets,
    tooltip,
    wallet,
  };
}
