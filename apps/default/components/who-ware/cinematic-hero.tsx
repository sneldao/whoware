import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { getSceneImageSource } from "@/components/who-ware/scene-media";

const mysteryFigure = require("../../../../assets/images/whoware-mystery-figure.png");

interface CinematicHeroProps {
  imageKey: string | undefined;
  revealProgress: number;
  isSolved: boolean;
  solvedImageKey?: string | undefined;
  imageUrl?: string;
  solvedImageUrl?: string;
}

/**
 * Full-bleed cinematic backdrop for the landing. Today's first memory drifts
 * behind a warm sepia wash (Ken Burns), and the unidentified figure resolves
 * from shadow as the player makes progress.
 */
export function CinematicHero({ imageKey, revealProgress, isSolved, solvedImageKey, imageUrl, solvedImageUrl }: CinematicHeroProps) {
  const drift = useSharedValue(0);
  const figurePulse = useSharedValue(0);
  const backdrop = getSceneImageSource(imageKey, 0, imageUrl);
  const clampedProgress = Math.max(0, Math.min(1, revealProgress));

  useEffect(() => {
    drift.value = withRepeat(withTiming(1, { duration: 22000, easing: Easing.inOut(Easing.ease) }), -1, true);
    figurePulse.value = withRepeat(withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [drift, figurePulse]);

  const backdropStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: 1.08 + drift.value * 0.12 },
      { translateX: -10 + drift.value * 20 },
      { translateY: 6 - drift.value * 14 },
    ],
  }));

  const figureStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + figurePulse.value * 0.03 }],
    opacity: 0.78 + figurePulse.value * 0.16,
  }));

  // Heavy shadow at the start, resolving toward a clear portrait as progress climbs.
  const blurRadius = isSolved ? 0 : Math.round(34 - clampedProgress * 28);
  const shroudOpacity = isSolved ? 0 : 0.62 - clampedProgress * 0.5;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[styles.backdropLayer, backdropStyle]}>
        <Image source={backdrop} style={styles.backdropImage} contentFit="cover" transition={400} blurRadius={18} />
      </Animated.View>

      <LinearGradient
        colors={["rgba(38, 23, 8, 0.35)", "rgba(28, 17, 6, 0.72)", "rgba(12, 8, 4, 0.96)"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.sepiaWash} />

      <View style={styles.figureFrame}>
        <Animated.View style={[styles.figureInner, figureStyle]}>
          <Image
            source={isSolved && (solvedImageKey || solvedImageUrl) ? getSceneImageSource(solvedImageKey, 0, solvedImageUrl) : mysteryFigure}
            style={styles.figureImage}
            contentFit="cover"
            transition={500}
            blurRadius={blurRadius}
          />
          <View style={[styles.figureShroud, { opacity: shroudOpacity }]} />
        </Animated.View>
        {isSolved ? (
          <View style={styles.solvedBadge}>
            <Ionicons name="sparkles" size={13} color="#1C1106" />
          </View>
        ) : null}
      </View>

      <View style={styles.vignette} />
      <View style={styles.grain} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  backdropLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropImage: {
    width: "100%",
    height: "100%",
  },
  sepiaWash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(120, 72, 24, 0.22)",
  },
  figureFrame: {
    position: "absolute",
    top: 18,
    right: 18,
    width: 92,
    height: 122,
    borderRadius: 20,
    borderCurve: "continuous",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.4)",
    backgroundColor: "rgba(12, 8, 4, 0.6)",
  },
  figureInner: {
    flex: 1,
  },
  figureImage: {
    width: "100%",
    height: "100%",
  },
  figureShroud: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0B0703",
  },
  solvedBadge: {
    position: "absolute",
    bottom: 7,
    right: 7,
    width: 24,
    height: 24,
    borderRadius: 9,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBBF24",
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 32,
    borderCurve: "continuous",
    borderWidth: 26,
    borderColor: "rgba(8, 5, 2, 0.55)",
  },
  grain: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 240, 214, 0.02)",
  },
});
