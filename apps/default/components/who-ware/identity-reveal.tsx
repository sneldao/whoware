import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

interface IdentityRevealProps {
  figureName: string;
  era: string;
  region: string;
  tags: string[];
  imageUrl?: string;
  imageKey?: string;
  onContinue: () => void;
}

export function IdentityReveal({
  figureName,
  era,
  region,
  tags,
  imageUrl,
  onContinue,
}: IdentityRevealProps) {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 400 });
    scale.value = withSequence(
      withSpring(1.05, { damping: 12, stiffness: 100 }),
      withSpring(1, { damping: 15 }),
    );
  }, [opacity, scale]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
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
      <View style={styles.scrim} />

      <Animated.View style={[styles.content, contentStyle]}>
        <View style={styles.iconWrapper}>
          <Ionicons name="person" size={32} color="#FBBF24" />
        </View>

        <Text style={styles.revealLabel}>You were</Text>
        <Text style={styles.figureName}>{figureName}</Text>

        <Text style={styles.context}>
          {region} · {era}
        </Text>

        {tags.length > 0 && (
          <View style={styles.tagRow}>
            {tags.slice(0, 4).map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}

        <Pressable
          style={styles.continueButton}
          onPress={onContinue}
        >
          <Text style={styles.continueText}>View your result</Text>
          <Ionicons name="arrow-forward" size={16} color="#1C1106" />
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.3,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  content: {
    alignItems: "center",
    padding: 32,
    maxWidth: 400,
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  revealLabel: {
    color: "#94a3b8",
    fontSize: 14,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  figureName: {
    color: "#f8fafc",
    fontSize: 36,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  context: {
    color: "#94a3b8",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 32,
  },
  tag: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.3)",
  },
  tagText: {
    color: "#FBBF24",
    fontSize: 12,
    fontWeight: "500",
  },
  continueButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: "#FBBF24",
  },
  continueText: {
    color: "#1C1106",
    fontSize: 15,
    fontWeight: "600",
  },
});
