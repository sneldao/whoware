import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  Easing,
} from "react-native-reanimated";

interface EnhancedIdentityRevealProps {
  figureName: string;
  era: string;
  region: string;
  tags: string[];
  imageUrl?: string;
  imageKey?: string;
  onContinue: () => void;
}

export function EnhancedIdentityReveal({
  figureName,
  era,
  region,
  tags,
  imageUrl,
  onContinue,
}: EnhancedIdentityRevealProps) {
  const [displayedName, setDisplayedName] = useState("");
  const [showContent, setShowContent] = useState(false);
  const [showName, setShowName] = useState(false);

  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);
  const particle1 = useSharedValue(0);
  const particle2 = useSharedValue(0);
  const particle3 = useSharedValue(0);

  // Entrance animation sequence
  useEffect(() => {
    opacity.value = withTiming(1, { duration: 500 });
    scale.value = withSequence(
      withSpring(1.05, { damping: 12, stiffness: 100 }),
      withSpring(1, { damping: 15 }),
    );
  }, [opacity, scale]);

  // Staggered content reveal
  useEffect(() => {
    const t1 = setTimeout(() => setShowContent(true), 300);
    const t2 = setTimeout(() => setShowName(true), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Typewriter effect on name
  useEffect(() => {
    if (!showName) return;
    let i = 0;
    setDisplayedName("");
    const interval = setInterval(() => {
      if (i < figureName.length) {
        setDisplayedName(figureName.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [showName, figureName]);

  // Sparkle particles
  useEffect(() => {
    if (!showName) return;
    particle1.value = withDelay(200, withRepeat(
      withSequence(
        withTiming(1, { duration: 600, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 400 }),
      ),
      3,
      false,
    ));
    particle2.value = withDelay(400, withRepeat(
      withSequence(
        withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 300 }),
      ),
      2,
      false,
    ));
    particle3.value = withDelay(600, withRepeat(
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.out(Easing.ease) }),
        withTiming(0, { duration: 500 }),
      ),
      2,
      false,
    ));
  }, [showName, particle1, particle2, particle3]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const particle1Style = useAnimatedStyle(() => ({
    opacity: 1 - particle1.value,
    transform: [
      { translateX: -40 + particle1.value * 80 },
      { translateY: -60 + particle1.value * 50 },
      { scale: 0.5 + particle1.value * 0.5 },
    ],
  }));

  const particle2Style = useAnimatedStyle(() => ({
    opacity: 1 - particle2.value,
    transform: [
      { translateX: 50 - particle2.value * 70 },
      { translateY: -30 + particle2.value * 60 },
      { scale: 0.3 + particle2.value * 0.7 },
    ],
  }));

  const particle3Style = useAnimatedStyle(() => ({
    opacity: 1 - particle3.value,
    transform: [
      { translateX: -20 + particle3.value * 40 },
      { translateY: -80 + particle3.value * 30 },
      { scale: 0.6 + particle3.value * 0.4 },
    ],
  }));

  return (
    <Animated.View style={[styles.overlay, containerStyle]}>
      {imageUrl && (
        <Image
          source={{ uri: imageUrl }}
          style={styles.backdrop}
          contentFit="cover"
          blurRadius={20}
        />
      )}
      <LinearGradient
        colors={["rgba(10, 6, 4, 0.7)", "rgba(10, 6, 4, 0.95)", "rgba(10, 6, 4, 1)"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.content}>
        {/* Sparkle particles */}
        {showName ? (
          <>
            <Animated.View style={[styles.particle, particle1Style]}>
              <Text style={styles.particleText}>✦</Text>
            </Animated.View>
            <Animated.View style={[styles.particle, particle2Style]}>
              <Text style={styles.particleText}>✧</Text>
            </Animated.View>
            <Animated.View style={[styles.particle, particle3Style]}>
              <Text style={styles.particleText}>✦</Text>
            </Animated.View>
          </>
        ) : null}

        {/* Icon */}
        <Animated.View entering={FadeInDown.delay(200).duration(400).springify()} style={styles.iconWrapper}>
          <View style={styles.iconCircle}>
            <Ionicons name="eye" size={28} color="#FBBF24" />
          </View>
        </Animated.View>

        {/* Narrative label */}
        <Animated.View entering={FadeIn.delay(300).duration(500)}>
          <Text style={styles.revealLabel}>The body remembers:</Text>
        </Animated.View>

        {/* Typewriter name */}
        <Animated.View entering={FadeIn.delay(800).duration(300)}>
          <Text style={styles.figureName}>
            {displayedName}
            {showName && displayedName.length < figureName.length ? (
              <Text style={styles.cursor}>|</Text>
            ) : null}
          </Text>
        </Animated.View>

        {/* Context */}
        {showContent ? (
          <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.metaSection}>
            <View style={styles.contextRow}>
              <Ionicons name="globe-outline" size={14} color="rgba(255, 247, 237, 0.5)" />
              <Text style={styles.contextText}>{region} · {era}</Text>
            </View>

            {tags.length > 0 && (
              <View style={styles.tagRow}>
                {tags.slice(0, 5).map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            )}
          </Animated.View>
        ) : null}

        {/* Continue button */}
        {showName && displayedName === figureName ? (
          <Animated.View entering={FadeInDown.delay(600).duration(400).springify()} style={styles.actionsRow}>
            <Pressable
              onPress={onContinue}
              style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}
            >
              <Text style={styles.continueText}>View your result</Text>
              <Ionicons name="arrow-forward" size={18} color="#1C1106" />
            </Pressable>
          </Animated.View>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.2,
  },
  content: {
    alignItems: "center",
    padding: 32,
    maxWidth: 400,
    gap: 12,
  },
  particle: {
    position: "absolute",
  },
  particleText: {
    fontSize: 24,
    color: "#FBBF24",
  },
  iconWrapper: {},
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
    marginBottom: 8,
  },
  revealLabel: {
    color: "rgba(255, 247, 237, 0.6)",
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  figureName: {
    color: "#FFF7ED",
    fontSize: 38,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: -1,
    lineHeight: 44,
  },
  cursor: {
    color: "#FBBF24",
    fontWeight: "300",
    opacity: 0.7,
  },
  metaSection: {
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  contextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  contextText: {
    color: "rgba(255, 247, 237, 0.65)",
    fontSize: 15,
    fontWeight: "700",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(251, 191, 36, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.25)",
  },
  tagText: {
    color: "#FBBF24",
    fontSize: 11,
    fontWeight: "800",
  },
  actionsRow: {
    marginTop: 16,
    width: "100%",
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 54,
    borderRadius: 20,
    backgroundColor: "#FBBF24",
  },
  continueText: {
    color: "#1C1106",
    fontSize: 16,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.72,
  },
});
