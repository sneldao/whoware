import { theme } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ReactNode, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

interface EnhancedSceneTransitionProps {
  sceneIndex: number;
  title: string;
  location: string;
  era: string;
  palette: string[];
  children: ReactNode;
}

type Phase = "visible" | "fading-out" | "transmitting" | "title-card" | "fading-in";

const TRANSMISSION_PHRASES = [
  "Receiving memory transmission…",
  "Tuning the signal…",
  "Anchoring temporal coordinates…",
  "Resonating with the body…",
  "Establishing neural link…",
];

export function EnhancedSceneTransition({
  sceneIndex,
  title,
  location,
  era,
  palette,
  children,
}: EnhancedSceneTransitionProps) {
  const opacity = useSharedValue(1);
  const scanlineOffset = useSharedValue(0);
  const staticGlitch = useSharedValue(0);
  const [phase, setPhase] = useState<Phase>("visible");
  const [currentIndex, setCurrentIndex] = useState(sceneIndex);
  const [transmissionText, setTransmissionText] = useState("");

  const colors = [
    palette[0] ?? theme.inkOnAccent,
    palette[1] ?? theme.warmBrown,
    palette[2] ?? theme.parchment,
  ];

  const timeoutIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (sceneIndex === currentIndex) return;

    const phrase = TRANSMISSION_PHRASES[Math.floor(Math.random() * TRANSMISSION_PHRASES.length)];
    setTransmissionText(phrase);

    // Start scanline animation
    scanlineOffset.value = withRepeat(
      withTiming(1, { duration: 800, easing: Easing.linear }),
      -1,
      false,
    );

    // Static glitch pulses
    staticGlitch.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 100 }),
        withTiming(0, { duration: 50 }),
        withTiming(0.5, { duration: 80 }),
        withTiming(0, { duration: 120 }),
        withTiming(0.2, { duration: 60 }),
        withTiming(0, { duration: 200 }),
      ),
      3,
      false,
    );

    setPhase("fading-out");

    opacity.value = withTiming(0, { duration: 400 }, (finished) => {
      if (finished) {
        runOnJS(setPhase)("transmitting");
        runOnJS(setCurrentIndex)(sceneIndex);

        // After transmission delay, show title card
        const t1 = setTimeout(() => {
          runOnJS(setPhase)("title-card");

          // Then fade in scene
          const t2 = setTimeout(() => {
            runOnJS(setPhase)("fading-in");
            opacity.value = withTiming(1, { duration: 500 }, (f) => {
              if (f) runOnJS(setPhase)("visible");
            });
          }, 1800);
          timeoutIdsRef.current.push(t2);
        }, 1200);
        timeoutIdsRef.current.push(t1);
      }
    });

    return () => {
      timeoutIdsRef.current.forEach(clearTimeout);
      timeoutIdsRef.current = [];
    };
  }, [sceneIndex, currentIndex, opacity, scanlineOffset, staticGlitch]);

  const sceneStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const scanlineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanlineOffset.value * 100 }],
  }));

  const glitchStyle = useAnimatedStyle(() => ({
    opacity: staticGlitch.value,
  }));

  const isTransitioning = phase !== "visible";

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.sceneWrap, sceneStyle]}>
        {children}
      </Animated.View>

      {isTransitioning ? (
        <View style={[styles.overlay, { backgroundColor: colors[0] }]}>
          {(phase === "transmitting" || phase === "title-card") && (
            <>
              {/* Animated color bleeds */}
              <View style={[styles.colorBleed, styles.bleedTop, { backgroundColor: colors[1] }]} />
              <View style={[styles.colorBleed, styles.bleedBottom, { backgroundColor: colors[2] }]} />

              {/* Scanlines */}
              <Animated.View style={[styles.scanlines, scanlineStyle]} pointerEvents="none">
                {Array.from({ length: 20 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.scanline,
                      { backgroundColor: i % 2 === 0 ? theme.inkAlpha04 : "transparent" },
                    ]}
                  />
                ))}
              </Animated.View>

              {/* Static glitch */}
              <Animated.View style={[styles.glitchOverlay, glitchStyle]} pointerEvents="none" />

              {/* Static noise bars */}
              <View style={styles.noiseBars} pointerEvents="none">
                {Array.from({ length: 8 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.noiseBar,
                      {
                        height: 2 + Math.random() * 6,
                        top: Math.random() * 100,
                        left: `${Math.random() * 80}%`,
                        width: `${20 + Math.random() * 60}%`,
                        opacity: 0.08 + Math.random() * 0.12,
                      },
                    ]}
                  />
                ))}
              </View>
            </>
          )}

          {/* Transmission text */}
          {phase === "transmitting" && (
            <View style={styles.transmissionContainer}>
              <View style={styles.signalIcon}>
                <Ionicons name="radio" size={24} color={colors[2] ?? theme.parchment} />
              </View>
              <Text style={[styles.transmissionText, { color: colors[2] ?? theme.parchment }]}>
                {transmissionText}
              </Text>
              <View style={styles.loadingDots}>
                {[0, 1, 2].map((i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.dot,
                      { backgroundColor: colors[2] ?? theme.parchment },
                    ]}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Title card */}
          {phase === "title-card" && (
            <View style={styles.titleCardContainer}>
              <Text style={[styles.memoryLabel, { color: colors[2] ?? theme.parchment }]}>
                Memory {currentIndex + 1}
              </Text>
              <Text style={[styles.titleText, { color: theme.ink }]}>{title}</Text>
              <Text style={styles.locationText}>{location}</Text>
              <View style={[styles.eraBadge, { backgroundColor: `${colors[1]}44`, borderColor: `${colors[1]}66` }]}>
                <Text style={[styles.eraText, { color: colors[2] ?? theme.parchment }]}>{era}</Text>
              </View>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.pureBlack,
  },
  sceneWrap: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  colorBleed: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 150,
    opacity: 0.2,
  },
  bleedTop: {
    top: -80,
    right: -100,
  },
  bleedBottom: {
    bottom: -60,
    left: -120,
  },
  scanlines: {
    ...StyleSheet.absoluteFillObject,
  },
  scanline: {
    height: 3,
    width: "100%",
  },
  glitchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  noiseBars: {
    ...StyleSheet.absoluteFillObject,
  },
  noiseBar: {
    position: "absolute",
    backgroundColor: theme.ink,
  },
  transmissionContainer: {
    alignItems: "center",
    gap: 16,
    paddingHorizontal: 32,
  },
  signalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.inkAlpha8,
    borderWidth: 1,
    borderColor: theme.inkAlpha15,
  },
  transmissionText: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  loadingDots: {
    flexDirection: "row",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.6,
  },
  titleCardContainer: {
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 32,
  },
  memoryLabel: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  titleText: {
    fontSize: 30,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -0.8,
  },
  locationText: {
    color: theme.inkAlpha65,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
  eraBadge: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  eraText: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
});
