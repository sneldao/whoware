import { useCallback, useEffect, useMemo, useState } from "react";
import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

import type { Scene } from "@/components/who-ware/panorama-scene";
import { MEMORY_PENALTY } from "@/convex/scoring";
import { logger } from "@/lib/logger";
import type { UseGameSessionReturn } from "./use-game-session";

export interface UseSceneProgressionParams {
  session: UseGameSessionReturn;
  isBusy: boolean;
  setIsBusy: (v: boolean) => void;
  setStatus: (s: string) => void;
  showToast: (message: string, type?: "info" | "warning" | "success" | "error") => void;
}

export interface UseSceneProgressionReturn {
  sceneIndex: number;
  setSceneIndex: (i: number) => void;
  accessibleScenes: Array<{ title: string; isMercy?: boolean; [k: string]: any }>;
  nextAccessibleIndex: number;
  accessiblePosition: number;
  visibleScenes: Array<{ scene: Scene; episodeIndex: number }>;
  hasMoreMemories: () => boolean;
  handleUnlockNextMemory: () => Promise<void>;
}

export function useSceneProgression(params: UseSceneProgressionParams): UseSceneProgressionReturn {
  const { session, isBusy, setIsBusy, setStatus, showToast } = params;
  const { episode, run, enterSceneMutation, ensureRun, gameSounds, identity } = session;

  const [sceneIndex, setSceneIndex] = useState(0);

  useEffect(() => {
    if (run) setSceneIndex(run.currentSceneIndex);
  }, [run?.currentSceneIndex]);

  const isSolved = run?.status === "solved";
  const isExhausted = run?.status === "exhausted";
  const hasEnteredMemory = (run?.memoriesViewed ?? 0) > 0;

  const accessibleScenes = useMemo(() => {
    if (!episode) return [];
    return episode.scenes.filter((scene: { isMercy?: boolean }) => isSolved || isExhausted || !scene.isMercy);
  }, [episode, isSolved, isExhausted]);

  const nextAccessibleIndex = useMemo(() => {
    if (!episode) return -1;
    for (let i = sceneIndex + 1; i < episode.scenes.length; i++) {
      const s = episode.scenes[i] as { isMercy?: boolean };
      if (!s.isMercy || isSolved || isExhausted) return i;
    }
    return -1;
  }, [episode, sceneIndex, isSolved, isExhausted]);

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

  function hasMoreMemories(): boolean {
    if (!episode) return false;
    const finished = run?.status === "solved" || run?.status === "exhausted";
    for (let i = sceneIndex + 1; i < episode.scenes.length; i++) {
      const s = episode.scenes[i] as { isMercy?: boolean };
      if (!s.isMercy || finished) return true;
    }
    return false;
  }

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
    } catch (e) {
      logger.warn("useSceneProgression.unlockNextMemory", e);
    } finally {
      setIsBusy(false);
    }
  }, [episode, isSolved, isBusy, sceneIndex, run?.status, enterSceneMutation, ensureRun, gameSounds, setIsBusy, setStatus, showToast, identity.identityId]);

  return {
    sceneIndex,
    setSceneIndex,
    accessibleScenes,
    nextAccessibleIndex,
    accessiblePosition,
    visibleScenes,
    hasMoreMemories,
    handleUnlockNextMemory,
  };
}
