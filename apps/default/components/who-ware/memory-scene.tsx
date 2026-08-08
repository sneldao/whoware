import { lazy, Suspense, useMemo } from "react";
import { ActivityIndicator, View } from "react-native";

import { PanoramaScene, type Scene } from "@/components/who-ware/panorama-scene";
import { detectSceneQuality } from "@/lib/scene-quality";
import { theme } from "@/lib/theme";

const LazySceneCanvas = lazy(() =>
  import("@/components/who-ware/scene-3d/SceneCanvas").then((m) => ({
    default: m.SceneCanvas,
  })),
);

interface MemorySceneProps {
  scene: Scene;
  sceneIndex: number;
  totalScenes: number;
  onHotspotOpen?: (label: string) => void;
  onGenerateHint?: (clueLabel: string, tier?: "socratic" | "era" | "proximity") => void;
  activeHint?: string | null;
  activeHintTier?: "socratic" | "era" | "proximity" | null;
  hintUsedForScene?: (sceneIndex: number) => boolean;
  hasHintTierForScene?: (sceneIndex: number, tier: "socratic" | "era" | "proximity") => boolean;
  canRequestHintForClue?: (clueLabel: string) => boolean;
  isHintGenerating?: boolean;
  onDismissHint?: () => void;
  /** Frame height in px. Immersion uses viewport height; stacked play defaults to 430. */
  height?: number;
  /** Edge-to-edge room (no panorama card chrome). */
  fill?: boolean;
  /** Override the detected renderer mode. Used by tests and future settings. */
  forceMode?: "three-d" | "panorama";
}

/**
 * MemoryScene picks the renderer from capability detection and delegates
 * to the 3D canvas (lazy-loaded) or the panorama fallback.
 */
export function MemoryScene({
  scene,
  sceneIndex,
  totalScenes,
  onHotspotOpen,
  onGenerateHint,
  activeHint,
  activeHintTier,
  hintUsedForScene,
  hasHintTierForScene,
  canRequestHintForClue,
  isHintGenerating,
  onDismissHint,
  height = 430,
  fill = false,
  forceMode,
}: MemorySceneProps) {
  const quality = useMemo(() => detectSceneQuality(), []);
  const mode = forceMode ?? quality.mode;

  if (mode === "three-d") {
    return (
      <Suspense
        fallback={
          <View style={{ height, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator color={theme.accent} />
          </View>
        }
      >
        <LazySceneCanvas
          scene={scene}
          sceneIndex={sceneIndex}
          totalScenes={totalScenes}
          height={height}
          fill={fill}
          onHotspotOpen={onHotspotOpen}
          onGenerateHint={onGenerateHint}
          activeHint={activeHint}
          activeHintTier={activeHintTier}
          hintUsedForScene={hintUsedForScene}
          hasHintTierForScene={hasHintTierForScene}
          canRequestHintForClue={canRequestHintForClue}
          isHintGenerating={isHintGenerating}
          onDismissHint={onDismissHint}
        />
      </Suspense>
    );
  }

  return (
    <PanoramaScene
      scene={scene}
      sceneIndex={sceneIndex}
      totalScenes={totalScenes}
      height={height}
      fill={fill}
      onHotspotOpen={onHotspotOpen}
      onGenerateHint={onGenerateHint}
      activeHint={activeHint}
      activeHintTier={activeHintTier}
      hintUsedForScene={hintUsedForScene}
      hasHintTierForScene={hasHintTierForScene}
      canRequestHintForClue={canRequestHintForClue}
      isHintGenerating={isHintGenerating}
      onDismissHint={onDismissHint}
    />
  );
}

export type { Scene } from "@/components/who-ware/panorama-scene";
