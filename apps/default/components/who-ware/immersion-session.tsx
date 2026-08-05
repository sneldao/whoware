import { theme } from "@/lib/theme";
import { detectSceneQuality } from "@/lib/scene-quality";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { EnhancedSceneTransition } from "@/components/who-ware/enhanced-scene-transition";
import { MemoryScene } from "@/components/who-ware/memory-scene";
import { PlayChrome, type PlayChromeMetrics } from "@/components/who-ware/play-chrome";
import type {
  ActionState,
  ExtrasState,
  GuessState,
  SceneState,
} from "@/components/who-ware/views/props";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInDown, FadeOut } from "react-native-reanimated";

export interface ImmersionSessionProps {
  chromeUnlocked: boolean;
  scene: SceneState;
  actions: ActionState;
  guess: GuessState;
  extras: ExtrasState;
  metrics: PlayChromeMetrics;
  onNameIdentity: () => void;
}

/**
 * Continuous room for an active run. MemoryScene mounts once; chrome unlock
 * only toggles overlay density (whisper/coach → HUD).
 */
export function ImmersionSession({
  chromeUnlocked,
  scene,
  actions,
  guess,
  extras,
  metrics,
  onNameIdentity,
}: ImmersionSessionProps) {
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [whisperVisible, setWhisperVisible] = useState(false);
  const [coachVisible, setCoachVisible] = useState(false);
  const sceneHeight = Math.max(480, Math.round(windowHeight));

  useEffect(() => {
    if (chromeUnlocked) {
      setWhisperVisible(false);
      setCoachVisible(false);
      return;
    }
    const whisperTimer = setTimeout(() => setWhisperVisible(true), 1500);
    const coachTimer = setTimeout(() => setCoachVisible(true), 2800);
    return () => {
      clearTimeout(whisperTimer);
      clearTimeout(coachTimer);
    };
  }, [scene.scene.title, chromeUnlocked]);

  const coachMessage =
    Platform.OS === "web" && detectSceneQuality().mode === "three-d"
      ? "Drag to look, then touch a glow."
      : "Touch a glow when you're ready.";

  return (
    <View style={styles.root}>
      <ErrorBoundary
        label="ImmersionScene"
        fallback={(reset) => (
          <View style={styles.fallback}>
            <Pressable onPress={reset} style={styles.nameButton}>
              <Text style={styles.nameButtonText}>Reload scene</Text>
            </Pressable>
          </View>
        )}
      >
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
            height={sceneHeight}
            fill
            onHotspotOpen={scene.onHotspotOpen}
            onGenerateHint={scene.onGenerateHint}
            activeHint={scene.activeHint}
            isHintGenerating={scene.isHintGenerating}
          />
        </EnhancedSceneTransition>
      </ErrorBoundary>

      {!chromeUnlocked ? (
        <>
          {whisperVisible ? (
            <Animated.View
              entering={FadeIn.duration(900)}
              exiting={FadeOut.duration(300)}
              style={[styles.whisper, { top: Math.max(20, insets.top + 12) }]}
              pointerEvents="none"
            >
              <Text style={styles.whisperText}>
                {scene.scene.location} · {scene.scene.era}
              </Text>
            </Animated.View>
          ) : null}

          {coachVisible ? (
            <Animated.View
              entering={FadeInDown.duration(500)}
              exiting={FadeOut.duration(250)}
              style={styles.coachWrap}
            >
              <Pressable
                accessibilityRole="button"
                onPress={() => setCoachVisible(false)}
                style={styles.coach}
              >
                <Ionicons name="radio-button-on" size={12} color={theme.accent} />
                <Text style={styles.coachText}>{coachMessage}</Text>
              </Pressable>
            </Animated.View>
          ) : null}

          <View style={[styles.bottomBar, { bottom: Math.max(24, insets.bottom + 16) }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Name identity"
              onPress={onNameIdentity}
              style={({ pressed }) => [styles.nameButton, pressed && styles.pressed]}
            >
              <Ionicons name="finger-print" size={16} color={theme.ink} />
              <Text style={styles.nameButtonText}>Name identity</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <PlayChrome
          layout="overlay"
          scene={scene}
          actions={actions}
          guess={guess}
          extras={extras}
          metrics={metrics}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#080502",
  },
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  whisper: {
    position: "absolute",
    top: 28,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  whisperText: {
    color: theme.inkAlpha55,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.35)",
    overflow: "hidden",
  },
  coachWrap: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 96,
    alignItems: "center",
  },
  coach: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(12, 8, 4, 0.72)",
    borderWidth: 1,
    borderColor: theme.accentAlpha28,
  },
  coachText: {
    color: theme.inkAlpha84,
    fontSize: 13,
    fontWeight: "700",
  },
  bottomBar: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 28,
    alignItems: "center",
  },
  nameButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.inkAlpha25,
    backgroundColor: "rgba(12, 8, 4, 0.55)",
  },
  nameButtonText: {
    color: theme.ink,
    fontSize: 14,
    fontWeight: "800",
  },
  pressed: {
    opacity: 0.75,
  },
});
