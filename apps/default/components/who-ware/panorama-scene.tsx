import { theme } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useRef, useState } from "react";
import { PanResponder, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { ClueDetailPanel } from "@/components/who-ware/clue-detail-panel";
import { MemoryMediaStrip } from "@/components/who-ware/memory-media-strip";
import { getSceneImageSource } from "@/components/who-ware/scene-media";
import { useGyroscopeParallax } from "@/hooks/use-gyroscope-parallax";

export interface Clue {
  label: string;
  detail: string;
  x: number;
  y: number;
}

export interface SceneProp {
  id: string;
  kind: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: number;
  clueLabel?: string;
}

export interface SceneLighting {
  ambient: number;
  keyColor: string;
  keyIntensity: number;
  fillColor?: string;
  fillIntensity?: number;
}

export interface Scene {
  title: string;
  location: string;
  era: string;
  palette: string[];
  panoramaPrompt: string;
  imageKey?: string;
  imageAspectRatio?: string;
  detailImageKeys?: string[];
  mediaKind?: "image" | "motion" | "video";
  motionPrompt?: string;
  ambientText: string;
  clues: Clue[];
  imageUrl?: string;
  props?: SceneProp[];
  lighting?: SceneLighting;
}

interface PanoramaSceneProps {
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
  /** Panorama frame height. Defaults to 430. */
  height?: number;
  /** Edge-to-edge room — no card chrome or below-fold media. */
  fill?: boolean;
}

export function PanoramaScene({
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
}: PanoramaSceneProps) {
  const [activeClue, setActiveClue] = useState<Clue | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const colors = useMemo(() => normalizePalette(scene.palette), [scene.palette]);
  const imageSource = getSceneImageSource(scene.imageKey, sceneIndex, scene.imageUrl);

  const shimmerX = useSharedValue(0);
  const haloPulse = useSharedValue(0);
  const parallaxX = useSharedValue(0);
  const parallaxY = useSharedValue(0);
  useEffect(() => {
    shimmerX.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
    haloPulse.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [shimmerX, haloPulse]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -100 + shimmerX.value * 200 }],
  }));

  const haloAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + haloPulse.value * 0.4 }],
    opacity: 0.6 - haloPulse.value * 0.4,
  }));

  // Parallax: image shifts more than glow layers for depth
  const parallaxImageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: parallaxX.value * 12 }, { translateY: parallaxY.value * 8 }],
  }));

  const parallaxGlowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: parallaxX.value * 6 }, { translateY: parallaxY.value * 4 }],
  }));

  const parallaxGlowRightStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: parallaxX.value * -6 }, { translateY: parallaxY.value * -4 }],
  }));

  // Gyroscope tilt-to-look on native (complements drag on both platforms)
  useGyroscopeParallax(parallaxX, parallaxY, fill);

  // Pan responder for parallax depth — drag on the panorama shifts layers
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, gestureState) => {
        // Only capture horizontal drags (not taps on hotspots)
        return Math.abs(gestureState.dx) > 3 && Math.abs(gestureState.dy) < 20;
      },
      onPanResponderMove: (_e, gestureState) => {
        parallaxX.value = Math.max(-1, Math.min(1, gestureState.dx / 200));
        parallaxY.value = Math.max(-1, Math.min(1, gestureState.dy / 300));
      },
      onPanResponderRelease: () => {
        // Ease back to center
        parallaxX.value = withTiming(0, { duration: 800, easing: Easing.out(Easing.ease) });
        parallaxY.value = withTiming(0, { duration: 800, easing: Easing.out(Easing.ease) });
      },
    }),
  ).current;

  useEffect(() => {
    setActiveClue(null);
    setImageLoaded(false);
    onDismissHint?.(); // Clear the hint when the scene changes
  }, [scene.title, onDismissHint]);

  function handleCluePress(clue: Clue) {
    if (activeClue?.label !== clue.label) {
      onDismissHint?.(); // Fresh slate when switching to a different clue
    }
    setActiveClue(clue);
    onHotspotOpen?.(clue.label);
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  return (
    <View style={fill ? styles.fillRoot : styles.card}>
      <View
        style={[
          styles.panorama,
          { height, backgroundColor: colors[0] },
          fill && styles.panoramaFill,
        ]}
        {...panResponder.panHandlers}
      >
        {imageSource ? (
          <Animated.Image
            source={imageSource}
            style={[styles.memoryImage, parallaxImageStyle]}
            contentFit="cover"
            transition={150}
            onLoad={() => setImageLoaded(true)}
          />
        ) : null}
        {!imageLoaded ? (
          <View style={[StyleSheet.absoluteFill, styles.shimmerContainer]} pointerEvents="none">
            <Animated.View style={[styles.shimmerBar, shimmerStyle]} />
          </View>
        ) : null}
        <Animated.View style={[styles.glow, styles.glowLeft, { backgroundColor: colors[1] }, parallaxGlowStyle]} />
        <Animated.View style={[styles.glow, styles.glowRight, { backgroundColor: colors[2] }, parallaxGlowRightStyle]} />
        <View style={styles.vignette} />
        <View style={styles.scanline} />

        {scene.clues.map((clue) => (
          <Pressable
            key={clue.label}
            accessibilityRole="button"
            accessibilityLabel={`Inspect ${clue.label}`}
            onPress={() => handleCluePress(clue)}
            style={[styles.hotspot, { left: `${clue.x}%`, top: `${clue.y}%` }]}
          >
            <Animated.View style={[styles.hotspotHalo, haloAnimatedStyle]} />
            <View style={styles.hotspotDot} />
          </Pressable>
        ))}

        {!fill ? (
          <View style={styles.sceneMeta}>
            <Text style={styles.sceneCounter}>
              Memory {sceneIndex + 1} / {totalScenes}
            </Text>
            <Text style={styles.sceneTitle}>{scene.title}</Text>
            <Text style={styles.sceneLocation}>
              {scene.location} · {scene.era}
            </Text>
          </View>
        ) : null}

        {fill && activeClue ? (
          <View style={styles.fillClue}>
            <ClueDetailPanel
              clue={activeClue}
              hintLabel="Ask the memory (AI hint)"
              onGenerateHint={onGenerateHint}
              activeHint={activeHint}
              activeHintTier={activeHintTier}
              isHintGenerating={isHintGenerating}
              hintUsedForScene={hintUsedForScene ? hintUsedForScene(sceneIndex) : undefined}
              hasHintTier={hasHintTierForScene ? (tier) => hasHintTierForScene(sceneIndex, tier) : undefined}
              canRequestHint={canRequestHintForClue ? canRequestHintForClue(activeClue.label) : undefined}
              onDismissHint={onDismissHint}
            />
          </View>
        ) : null}
      </View>

      {!fill ? (
        <>
          <View style={styles.transmissionCard}>
            <Text style={styles.transmissionLabel}>Body memory</Text>
            <Text style={styles.ambient}>{scene.ambientText}</Text>
          </View>

          <MemoryMediaStrip
            imageKey={scene.imageKey}
            detailImageKeys={scene.detailImageKeys}
            sceneIndex={sceneIndex}
            motionPrompt={scene.motionPrompt}
            imageUrl={scene.imageUrl}
          />

          {activeClue ? (
            <ClueDetailPanel
              clue={activeClue}
              hintLabel="Ask the memory (AI hint)"
              onGenerateHint={onGenerateHint}
              activeHint={activeHint}
              activeHintTier={activeHintTier}
              isHintGenerating={isHintGenerating}
              hintUsedForScene={hintUsedForScene ? hintUsedForScene(sceneIndex) : undefined}
              hasHintTier={hasHintTierForScene ? (tier) => hasHintTierForScene(sceneIndex, tier) : undefined}
              canRequestHint={canRequestHintForClue ? canRequestHintForClue(activeClue.label) : undefined}
              onDismissHint={onDismissHint}
            />
          ) : (
            <View style={styles.hintRow}>
              <Ionicons name="radio-button-on" size={16} color="#D97706" />
              <Text style={styles.hint}>Tap a glowing fragment for a clue — each one costs score.</Text>
            </View>
          )}
        </>
      ) : null}
    </View>
  );
}

function normalizePalette(palette: string[]): [string, string, string] {
  return [palette[0] ?? theme.inkOnAccent, palette[1] ?? theme.warmBrown, palette[2] ?? theme.parchment];
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
  },
  fillRoot: {
    flex: 1,
  },
  panorama: {
    height: 430,
    overflow: "hidden",
    borderRadius: 32,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(248, 231, 201, 0.18)",
  },
  panoramaFill: {
    borderRadius: 0,
    borderWidth: 0,
    flex: 1,
  },
  fillClue: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 120,
  },
  memoryImage: {
    ...StyleSheet.absoluteFillObject,
  },
  glow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    opacity: 0.28,
  },
  glowLeft: {
    left: -70,
    top: 40,
  },
  glowRight: {
    right: -80,
    bottom: 20,
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.2)",
  },
  scanline: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: theme.inkAlpha8,
  },
  shimmerContainer: {
    overflow: "hidden",
    justifyContent: "center",
  },
  shimmerBar: {
    width: 100,
    height: "100%",
    backgroundColor: theme.inkAlpha6,
  },
  sceneMeta: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 20,
    gap: 5,
  },
  sceneCounter: {
    color: theme.accent,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.3,
    textTransform: "uppercase",
  },
  sceneTitle: {
    color: theme.ink,
    fontSize: 25,
    fontWeight: "900",
    letterSpacing: -0.7,
  },
  sceneLocation: {
    color: theme.inkAlpha78,
    fontSize: 14,
    fontWeight: "700",
  },
  hotspot: {
    position: "absolute",
    width: 48,
    height: 48,
    marginLeft: -24,
    marginTop: -24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: theme.accentAlpha14,
    borderWidth: 1,
    borderColor: theme.accentAlpha78,
  },
  hotspotHalo: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.accentAlpha18,
  },
  hotspotDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.accent,
  },
  ambient: {
    color: theme.inkAlpha84,
    fontSize: 16,
    lineHeight: 24,
  },
  transmissionCard: {
    padding: 16,
    gap: 6,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: theme.inkAlpha6,
    borderWidth: 1,
    borderColor: "rgba(248, 231, 201, 0.1)",
  },
  transmissionLabel: {
    color: theme.accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  hint: {
    flex: 1,
    color: theme.inkAlpha58,
    fontSize: 14,
    fontWeight: "700",
  },
});
