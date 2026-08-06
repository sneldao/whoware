import { theme } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";
import type { ClueInsight } from "@/hooks/use-clue-insights";

interface InsightBannerProps {
  insight: ClueInsight;
  onDismiss: () => void;
}

/**
 * A floating banner that appears when the cross-referencing system
 * detects a thematic connection between clues from different memories.
 *
 * This is the "aha" moment — the player sees that two clues from
 * different scenes share a theme, which helps narrow down the figure.
 */
export function InsightBanner({ insight, onDismiss }: InsightBannerProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(500).springify().damping(14)}
      exiting={FadeOutUp.duration(300)}
      style={styles.wrap}
      pointerEvents="box-none"
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss insight"
        onPress={onDismiss}
        style={styles.card}
      >
        <View style={styles.header}>
          <View style={styles.iconBadge}>
            <Ionicons name="git-network" size={14} color={theme.accent} />
          </View>
          <Text style={styles.eyebrow}>Connection found</Text>
          <Ionicons name="close" size={14} color={theme.inkAlpha55} />
        </View>
        <Text style={styles.insightText}>{insight.insight}</Text>
        <View style={styles.clueRow}>
          {insight.clueLabels.slice(0, 3).map((label, i) => (
            <View key={label + i} style={styles.clueChip}>
              <Text style={styles.clueChipText} numberOfLines={1}>{label}</Text>
            </View>
          ))}
          {insight.sceneIndices.length > 2 && (
            <Text style={styles.moreText}>
              {insight.sceneIndices.length} memories
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 120,
    zIndex: 25,
  },
  card: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(12, 8, 4, 0.88)",
    borderWidth: 1,
    borderColor: theme.accentAlpha28,
    gap: 8,
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBadge: {
    width: 26,
    height: 26,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.accentAlpha15,
  },
  eyebrow: {
    flex: 1,
    color: theme.accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  insightText: {
    color: theme.ink,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
    paddingLeft: 34,
  },
  clueRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingLeft: 34,
  },
  clueChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: theme.inkAlpha8,
    maxWidth: 120,
  },
  clueChipText: {
    color: theme.inkAlpha70,
    fontSize: 11,
    fontWeight: "700",
  },
  moreText: {
    color: theme.inkAlpha50,
    fontSize: 11,
    fontWeight: "700",
    alignSelf: "center",
  },
});
