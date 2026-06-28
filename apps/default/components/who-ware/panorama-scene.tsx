import { theme } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Haptics from "expo-haptics";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";

import { HintOverlay } from "@/components/who-ware/hint-overlay";
import { MemoryMediaStrip } from "@/components/who-ware/memory-media-strip";
import { VeniceAiBadge } from "@/components/who-ware/venice-ai-badge";
import { getSceneImageSource } from "@/components/who-ware/scene-media";

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
  onGenerateHint?: (clueLabel: string) => void;
  activeHint?: string | null;
  isHintGenerating?: boolean;
}

export function PanoramaScene({ scene, sceneIndex, totalScenes, onHotspotOpen, onGenerateHint, activeHint, isHintGenerating }: PanoramaSceneProps) {
  const [activeClue, setActiveClue] = useState<Clue | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const colors = useMemo(() => normalizePalette(scene.palette), [scene.palette]);
  const imageSource = getSceneImageSource(scene.imageKey, sceneIndex, scene.imageUrl);

  const shimmerX = useSharedValue(0);
  useEffect(() => {
    shimmerX.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      false,
    );
  }, [shimmerX]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -100 + shimmerX.value * 200 }],
  }));

  useEffect(() => {
    setActiveClue(null);
    setImageLoaded(false);
  }, [scene.title]);

  function handleCluePress(clue: Clue) {
    setActiveClue(clue);
    onHotspotOpen?.(clue.label);
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }

  return (
    <View style={styles.card}>
      <View style={[styles.panorama, { backgroundColor: colors[0] }]}>
        {imageSource ? (
          <Image
            source={imageSource}
            style={styles.memoryImage}
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
        <View style={[styles.glow, styles.glowLeft, { backgroundColor: colors[1] }]} />
        <View style={[styles.glow, styles.glowRight, { backgroundColor: colors[2] }]} />
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
            <View style={styles.hotspotHalo} />
            <View style={styles.hotspotDot} />
          </Pressable>
        ))}

        <View style={styles.sceneMeta}>
          <Text style={styles.sceneCounter}>
            Memory {sceneIndex + 1} / {totalScenes}
          </Text>
          <Text style={styles.sceneTitle}>{scene.title}</Text>
          <Text style={styles.sceneLocation}>
            {scene.location} · {scene.era}
          </Text>
        </View>
      </View>

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
        <View style={styles.cluePanel}>
          <View style={styles.clueHeader}>
            <Ionicons name="search" size={18} color="#F8E7C9" />
            <Text style={styles.clueTitle}>{activeClue.label}</Text>
          </View>
          <Text style={styles.clueText}>{activeClue.detail}</Text>
          {onGenerateHint ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => onGenerateHint(activeClue.label)}
              disabled={isHintGenerating}
              style={({ pressed }) => [styles.hintButton, pressed && styles.pressed, isHintGenerating && styles.disabledButton]}
            >
              {isHintGenerating ? (
                <ActivityIndicator size="small" color={theme.violet} />
              ) : (
                <Ionicons name="sparkles" size={16} color={theme.violet} />
              )}
              <Text style={styles.hintButtonText}>
                {isHintGenerating ? "Probing memory…" : "Ask the memory (AI hint)"}
              </Text>
            </Pressable>
          ) : null}
          {activeHint || isHintGenerating ? (
            <>
              {activeHint ? <VeniceAiBadge type="hint" compact /> : null}
              <HintOverlay hint={activeHint ?? null} isGenerating={isHintGenerating ?? false} clueLabel={activeClue.label} />
            </>
          ) : null}
        </View>
      ) : (
        <View style={styles.hintRow}>
          <Ionicons name="radio-button-on" size={16} color="#D97706" />
          <Text style={styles.hint}>Touch luminous fragments only when you need help — each one lowers your final score.</Text>
        </View>
      )}
    </View>
  );
}

function normalizePalette(palette: string[]): [string, string, string] {
  return [palette[0] ?? theme.inkOnAccent, palette[1] ?? "#92400E", palette[2] ?? "#F8E7C9"];
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
  },
  panorama: {
    height: 430,
    overflow: "hidden",
    borderRadius: 32,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(248, 231, 201, 0.18)",
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
    color: "rgba(255, 247, 237, 0.78)",
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
    color: "rgba(255, 247, 237, 0.84)",
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
  cluePanel: {
    padding: 16,
    gap: 9,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: "rgba(120, 53, 15, 0.44)",
    borderWidth: 1,
    borderColor: "rgba(248, 231, 201, 0.16)",
  },
  clueHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  clueTitle: {
    color: "#F8E7C9",
    fontSize: 16,
    fontWeight: "900",
  },
  clueText: {
    color: "rgba(255, 247, 237, 0.78)",
    fontSize: 15,
    lineHeight: 22,
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
  hintButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: "rgba(139, 92, 246, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.25)",
  },
  hintButtonText: {
    color: theme.violet,
    fontSize: 13,
    fontWeight: "800",
  },
  disabledButton: {
    opacity: 0.5,
  },
});
