import { useMemo } from "react";

import { PanoramaScene, type Scene } from "@/components/who-ware/panorama-scene";
import { SceneCanvas } from "@/components/who-ware/scene-3d/SceneCanvas";
import { detectSceneQuality } from "@/lib/scene-quality";

interface MemorySceneProps {
  scene: Scene;
  sceneIndex: number;
  totalScenes: number;
  onHotspotOpen?: (label: string) => void;
  onGenerateHint?: (clueLabel: string) => void;
  activeHint?: string | null;
  isHintGenerating?: boolean;
  /** Override the detected renderer mode. Used by tests and future settings. */
  forceMode?: "three-d" | "panorama";
}

/**
 * MemoryScene is the single entry point for rendering a daily memory.
 *
 * It picks the renderer based on capability detection and delegates to
 * either the 3D canvas (Phase 1+) or the existing panorama renderer.
 *
 * Phase 0 behavior: forces the panorama branch. The 3D branch is wired
 * (the SceneCanvas placeholder exists) but the orchestrator defaults to
 * panorama so existing behaviour is unchanged.
 */
export function MemoryScene({
  scene,
  sceneIndex,
  totalScenes,
  onHotspotOpen,
  onGenerateHint,
  activeHint,
  isHintGenerating,
  forceMode,
}: MemorySceneProps) {
  const quality = useMemo(() => detectSceneQuality(), []);
  const mode = forceMode ?? quality.mode;

  if (mode === "three-d") {
    return (
      <SceneCanvas
        scene={scene}
        sceneIndex={sceneIndex}
        totalScenes={totalScenes}
        height={430}
        onHotspotOpen={onHotspotOpen}
      />
    );
  }

  return (
    <PanoramaScene
      scene={scene}
      sceneIndex={sceneIndex}
      totalScenes={totalScenes}
      onHotspotOpen={onHotspotOpen}
      onGenerateHint={onGenerateHint}
      activeHint={activeHint}
      isHintGenerating={isHintGenerating}
    />
  );
}

export type { Scene } from "@/components/who-ware/panorama-scene";