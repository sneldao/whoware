import { ReactNode, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

interface SceneTransitionProps {
  sceneIndex: number;
  title: string;
  location: string;
  era: string;
  children: ReactNode;
}

type TransitionPhase = "visible" | "fading-out" | "title-card" | "fading-in";

export function SceneTransition({
  sceneIndex,
  title,
  location,
  era,
  children,
}: SceneTransitionProps) {
  const opacity = useSharedValue(1);
  const [phase, setPhase] = useState<TransitionPhase>("visible");
  const [currentIndex, setCurrentIndex] = useState(sceneIndex);

  useEffect(() => {
    if (sceneIndex === currentIndex) return;

    // Start transition sequence
    setPhase("fading-out");

    // Fade to black
    opacity.value = withTiming(0, { duration: 300 }, (finished) => {
      if (finished) {
        runOnJS(setPhase)("title-card");
        runOnJS(setCurrentIndex)(sceneIndex);
      }
    });

    // Show title card, then fade in
    const titleTimer = setTimeout(() => {
      setPhase("fading-in");
      opacity.value = withTiming(1, { duration: 400 }, (finished) => {
        if (finished) {
          runOnJS(setPhase)("visible");
        }
      });
    }, 1500); // 300ms fade-out + 1200ms title card

    return () => clearTimeout(titleTimer);
  }, [sceneIndex, currentIndex, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.sceneContainer, animatedStyle]}>
        {children}
      </Animated.View>

      {phase === "title-card" && (
        <View style={styles.titleCard}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.location}>{location}</Text>
          <Text style={styles.era}>{era}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  sceneContainer: {
    flex: 1,
  },
  titleCard: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
    padding: 32,
  },
  title: {
    color: "#f8fafc",
    fontSize: 28,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  location: {
    color: "#94a3b8",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 4,
  },
  era: {
    color: "#64748b",
    fontSize: 14,
    textAlign: "center",
  },
});
