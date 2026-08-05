import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { EnhancedSceneTransition } from "@/components/who-ware/enhanced-scene-transition";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { MemoryScene } from "@/components/who-ware/memory-scene";
import { PlayChrome } from "@/components/who-ware/play-chrome";
import { theme } from "@/lib/theme";
import type { PlayingViewProps } from "./props";
import styles from "@/app/index.styles";

/**
 * Legacy stacked play surface (scene + chrome below).
 * Active runs use ImmersionSession; kept for archive / fallback reuse.
 */
export function PlayingView(props: PlayingViewProps) {
  const { scene, actions, guess, extras } = props;

  return (
    <>
      <ErrorBoundary label="Scene3D" fallback={(reset) => (
        <View style={styles.actionBar}>
          <Pressable onPress={reset} style={({ pressed }) => [styles.actionButton, styles.guessButton, pressed && styles.pressed]}>
            <Ionicons name="refresh" size={18} color={theme.inkOnAccent} />
            <Text style={styles.guessButtonText}>Reload scene</Text>
          </Pressable>
        </View>
      )}>
        <EnhancedSceneTransition
          sceneIndex={scene.sceneIndex}
          title={scene.scene.title}
          location={scene.scene.location}
          era={scene.scene.era}
          palette={scene.scene.palette}
        >
          <MemoryScene
            scene={scene.scene as unknown as Parameters<typeof MemoryScene>[0]["scene"]}
            sceneIndex={scene.sceneIndex}
            totalScenes={scene.totalAccessibleScenes}
            onHotspotOpen={scene.onHotspotOpen}
            onGenerateHint={scene.onGenerateHint}
            activeHint={scene.activeHint}
            isHintGenerating={scene.isHintGenerating}
          />
        </EnhancedSceneTransition>
      </ErrorBoundary>
      <PlayChrome
        layout="stacked"
        scene={scene}
        actions={actions}
        guess={guess}
        extras={extras}
        metrics={{
          scoreDisplay: "—",
          hotspotsOpened: scene.discoveredClues.length,
          guessesLeft: guess.guessesLeft,
          guessCap: guess.guessesLeft,
          onShowScoreTooltip: () => undefined,
          onShowCluesTooltip: () => undefined,
          onShowGuessesTooltip: () => undefined,
        }}
      />
    </>
  );
}
