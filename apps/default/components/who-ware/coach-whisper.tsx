import { theme } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";

interface CoachWhisperProps {
  message: string | null;
  onDismiss: () => void;
  /** Bottom offset above the action dock / Name identity button. */
  bottom?: number;
}

/** One-shot progressive coach line over the room. */
export function CoachWhisper({ message, onDismiss, bottom = 108 }: CoachWhisperProps) {
  if (!message) return null;

  return (
    <Animated.View
      entering={FadeInDown.duration(400)}
      exiting={FadeOut.duration(220)}
      style={[styles.wrap, { bottom }]}
      pointerEvents="box-none"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss tip"
        onPress={onDismiss}
        style={styles.chip}
      >
        <Ionicons name="sparkles" size={12} color={theme.accent} />
        <Text style={styles.text}>{message}</Text>
        <Ionicons name="close" size={14} color={theme.inkAlpha55} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 20,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: 420,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: "rgba(12, 8, 4, 0.78)",
    borderWidth: 1,
    borderColor: theme.accentAlpha28,
  },
  text: {
    flexShrink: 1,
    color: theme.inkAlpha84,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
});
