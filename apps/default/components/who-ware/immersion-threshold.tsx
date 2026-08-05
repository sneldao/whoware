import { theme } from "@/lib/theme";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { MemoryScene } from "@/components/who-ware/memory-scene";
import type { Scene } from "@/components/who-ware/panorama-scene";
import { getSceneImageSource } from "@/components/who-ware/scene-media";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

interface ImmersionThresholdProps {
  /** Today's first scene — live room behind the enter gate. */
  scene?: Scene | null;
  imageKey?: string;
  imageUrl?: string;
  isEntering: boolean;
  onEnterWithSound: () => void;
  onEnterWithoutSound: () => void;
}

/**
 * Place-first entry gate. Live room already running; brand + sound choice over it.
 * No wallet, streak, score, or rules chrome.
 */
export function ImmersionThreshold({
  scene,
  imageKey,
  imageUrl,
  isEntering,
  onEnterWithSound,
  onEnterWithoutSound,
}: ImmersionThresholdProps) {
  const { height: windowHeight } = useWindowDimensions();
  const sceneHeight = Math.max(480, Math.round(windowHeight));
  const backdrop = getSceneImageSource(imageKey ?? scene?.imageKey, 0, imageUrl ?? scene?.imageUrl);
  const hasLiveScene = !!scene;

  return (
    <View style={styles.root}>
      {hasLiveScene ? (
        <View style={styles.liveRoom} pointerEvents="none">
          <ErrorBoundary
            label="ThresholdScene"
            fallback={() => (
              <Image
                source={backdrop}
                style={styles.backdrop}
                contentFit="cover"
                blurRadius={12}
              />
            )}
          >
            <MemoryScene
              scene={scene}
              sceneIndex={0}
              totalScenes={1}
              height={sceneHeight}
              fill
            />
          </ErrorBoundary>
        </View>
      ) : (
        <Image
          source={backdrop}
          style={styles.backdrop}
          contentFit="cover"
          blurRadius={28}
          transition={600}
        />
      )}

      <LinearGradient
        colors={
          hasLiveScene
            ? ["rgba(8,5,2,0.35)", "rgba(8,5,2,0.55)", "rgba(8,5,2,0.92)"]
            : ["rgba(8,5,2,0.55)", "rgba(8,5,2,0.72)", "rgba(8,5,2,0.94)"]
        }
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.grain} pointerEvents="none" />

      <Animated.View entering={FadeIn.duration(800)} style={styles.center} pointerEvents="none">
        <Text style={styles.brand}>WhoWare</Text>
        <Text style={styles.line}>Someone changed history{"\n"}from this room.</Text>
      </Animated.View>

      <Animated.View entering={FadeInUp.duration(700).delay(280)} style={styles.actions}>
        {isEntering ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={theme.accent} />
            <Text style={styles.loadingText}>Opening the room…</Text>
          </View>
        ) : (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enter with sound"
              onPress={onEnterWithSound}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>Enter with sound</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Enter without sound"
              onPress={onEnterWithoutSound}
              style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}
            >
              <Text style={styles.secondaryText}>Enter without sound</Text>
            </Pressable>
          </>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "#080502",
  },
  liveRoom: {
    ...StyleSheet.absoluteFillObject,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: 1.08 }],
  },
  grain: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 240, 214, 0.03)",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 18,
  },
  brand: {
    color: theme.ink,
    fontSize: 42,
    fontWeight: "900",
    letterSpacing: -1.4,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  line: {
    color: theme.inkAlpha72,
    fontSize: 22,
    lineHeight: 30,
    fontWeight: "600",
    letterSpacing: -0.3,
    maxWidth: 340,
    textShadowColor: "rgba(0,0,0,0.45)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  actions: {
    paddingHorizontal: 28,
    paddingBottom: 48,
    gap: 12,
  },
  primary: {
    minHeight: 54,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: theme.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    color: theme.inkOnAccent,
    fontSize: 16,
    fontWeight: "900",
  },
  secondary: {
    minHeight: 48,
    borderRadius: 18,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: theme.inkAlpha20,
    backgroundColor: "rgba(8, 5, 2, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    color: theme.inkAlpha78,
    fontSize: 15,
    fontWeight: "800",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 54,
  },
  loadingText: {
    color: theme.inkAlpha70,
    fontSize: 15,
    fontWeight: "700",
  },
  pressed: {
    opacity: 0.75,
  },
});
