import { theme } from "@/lib/theme";
import { ErrorBoundary } from "@/components/shared/error-boundary";
import { MemoryScene } from "@/components/who-ware/memory-scene";
import { DIFFICULTY_PALETTE } from "@/components/who-ware/result-share-card";
import type { Scene } from "@/components/who-ware/panorama-scene";
import { getSceneImageSource } from "@/components/who-ware/scene-media";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import {
  clearStoredSceneMode,
  detectSceneQuality,
  setStoredSceneMode,
} from "@/lib/scene-quality";

interface ImmersionThresholdProps {
  /** Today's first scene — live room behind the enter gate. */
  scene?: Scene | null;
  imageKey?: string;
  imageUrl?: string;
  isEntering: boolean;
  /** Current sound preference. The toggle in the top-right mutates this. */
  soundEnabled: boolean;
  onToggleSound: () => void;
  /** Single entry callback — sound toggle is already reflected in soundEnabled. */
  onEnter: () => void;
  /** Spoiler-free case metadata for the episode plate. */
  caseMeta?: {
    episodeNumber: number;
    difficulty?: "iconic" | "field" | "research";
    /** Live tick of ms remaining until today's signal collapses. */
    closesAt?: number | null;
    /** Live streak that dies if today goes unsolved — loss-framed on the plate. */
    streakAtRisk?: number;
  } | null;
  onOpenHowTo?: () => void;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/** Live 1s ticker for the threshold countdown. */
function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled]);
  return now;
}

/**
 * Place-first entry gate. Live room already running; brand + single Enter over it.
 * Sound is a top-right toggle, not a fork in the entry path. No wallet, score,
 * or rules chrome — those are reachable from inside the room.
 */
export function ImmersionThreshold({
  scene,
  imageKey,
  imageUrl,
  isEntering,
  soundEnabled,
  onToggleSound,
  onEnter,
  caseMeta,
  onOpenHowTo,
}: ImmersionThresholdProps) {
  const { height: windowHeight } = useWindowDimensions();
  const sceneHeight = Math.max(480, Math.round(windowHeight));
  const backdrop = getSceneImageSource(imageKey ?? scene?.imageKey, 0, imageUrl ?? scene?.imageUrl);
  const hasLiveScene = !!scene;
  const now = useNow(!!caseMeta?.closesAt);
  const insets = useSafeAreaInsets();
  // Web-only premium toggle: opt into the 3D room. Defaults to off on web.
  const [threeDEnabled, setThreeDEnabled] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    setThreeDEnabled(detectSceneQuality().mode === "three-d");
  }, []);
  const toggle3D = () => {
    if (Platform.OS !== "web") return;
    if (threeDEnabled) {
      clearStoredSceneMode();
      setThreeDEnabled(false);
    } else {
      setStoredSceneMode("three-d");
      setThreeDEnabled(true);
    }
  };
  const closesIn = caseMeta?.closesAt != null ? caseMeta.closesAt - now : null;
  const difficultyStyle = caseMeta?.difficulty
    ? DIFFICULTY_PALETTE[caseMeta.difficulty] ?? DIFFICULTY_PALETTE.iconic
    : null;

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
        {caseMeta ? (
          <View style={styles.plate}>
            <View style={styles.plateRow}>
              <Text style={styles.plateEp}>
                Episode {String(caseMeta.episodeNumber).padStart(2, "0")}
              </Text>
              <Text style={styles.plateToday}>· Today</Text>
            </View>
            {difficultyStyle ? (
              <View style={[styles.plateDiff, { backgroundColor: difficultyStyle.bg }]}>
                <Text style={[styles.plateDiffText, { color: difficultyStyle.fg }]}>
                  {difficultyStyle.label}
                </Text>
              </View>
            ) : null}
            {closesIn != null && closesIn > 0 ? (
              <View style={styles.plateCountdown}>
                <Ionicons name="hourglass-outline" size={12} color={theme.accent} />
                <Text style={styles.plateCountdownText}>
                  Collapses in {formatRemaining(closesIn)}
                </Text>
              </View>
            ) : null}
            {caseMeta.streakAtRisk ? (
              <View style={styles.plateStreak}>
                <Ionicons name="flame" size={12} color="#FB923C" />
                <Text style={styles.plateStreakText}>
                  {caseMeta.streakAtRisk}-day streak on the line
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
        <Text style={styles.brand}>WhoWare</Text>
        <Text style={styles.line}>Someone changed history{"\n"}from this room.</Text>
      </Animated.View>

      {/* Top-right toggles. Sound + (web-only) 3D room opt-in. */}
      <Animated.View
        entering={FadeInUp.duration(500).delay(400)}
        style={[styles.topRightWrap, { top: Math.max(14, insets.top + 8) }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={soundEnabled ? "Mute sound" : "Unmute sound"}
          onPress={onToggleSound}
          style={({ pressed }) => [styles.toggleChip, pressed && styles.pressed]}
          hitSlop={8}
        >
          <Ionicons
            name={soundEnabled ? "volume-high-outline" : "volume-mute-outline"}
            size={18}
            color={theme.inkAlpha72}
          />
        </Pressable>
        {Platform.OS === "web" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={threeDEnabled ? "Use 2D room" : "Use 3D room"}
            onPress={toggle3D}
            style={({ pressed }) => [
              styles.toggleChip,
              styles.toggleChip3D,
              threeDEnabled && styles.toggleChip3DOn,
              pressed && styles.pressed,
            ]}
            hitSlop={8}
          >
            <Ionicons name="cube-outline" size={16} color={threeDEnabled ? theme.accent : theme.inkAlpha55} />
            <Text style={[styles.toggleChipLabel, threeDEnabled && styles.toggleChipLabelOn]}>3D</Text>
          </Pressable>
        ) : null}
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
              accessibilityLabel="Enter the room"
              onPress={onEnter}
              style={({ pressed }) => [styles.primary, pressed && styles.pressed]}
            >
              <Text style={styles.primaryText}>Enter</Text>
            </Pressable>
            {onOpenHowTo ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="How to play"
                onPress={onOpenHowTo}
                style={({ pressed }) => [styles.tertiary, pressed && styles.pressed]}
              >
                <Ionicons name="help-circle-outline" size={15} color={theme.inkAlpha72} />
                <Text style={styles.tertiaryText}>How to play</Text>
              </Pressable>
            ) : null}
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
  plate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  plateRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 7,
  },
  plateEp: {
    color: theme.ink,
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.6,
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  plateToday: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  plateDiff: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
    borderCurve: "continuous",
  },
  plateDiffText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  plateCountdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderCurve: "continuous",
    backgroundColor: "rgba(8, 5, 2, 0.55)",
    borderWidth: 1,
    borderColor: theme.accentAlpha24,
  },
  plateCountdownText: {
    color: theme.ink,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    fontVariant: ["tabular-nums"],
  },
  plateStreak: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderCurve: "continuous",
    backgroundColor: "rgba(251, 146, 60, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(251, 146, 60, 0.35)",
  },
  plateStreakText: {
    color: "#FB923C",
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.3,
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
  topRightWrap: {
    position: "absolute",
    right: 14,
    flexDirection: "row",
    gap: 8,
  },
  toggleChip: {
    minWidth: 40,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "rgba(8, 5, 2, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 240, 214, 0.12)",
  },
  toggleChip3D: {
    minWidth: 0,
  },
  toggleChip3DOn: {
    borderColor: theme.accentAlpha35,
    backgroundColor: theme.accentAlpha12,
  },
  toggleChipLabel: {
    color: theme.inkAlpha55,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  toggleChipLabelOn: {
    color: theme.accent,
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
  tertiary: {
    minHeight: 40,
    borderRadius: 16,
    borderCurve: "continuous",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  tertiaryText: {
    color: theme.inkAlpha72,
    fontSize: 13.5,
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
