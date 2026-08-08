import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/lib/theme";

interface HintOverlayProps {
  hint: string | null;
  isGenerating: boolean;
  clueLabel: string;
  activeHintTier: "socratic" | "era" | "proximity" | null;
  /** Called when the user dismisses the overlay. */
  onDismiss?: () => void;
}

/**
 * Displays an AI-generated Venice hint for a clue hotspot.
 * Shown in the panorama scene when a clue is tapped.
 * Visibility is controlled by the parent; a close button lets the
 * user collapse the overlay when it obstructs the view.
 */
export function HintOverlay({ hint, isGenerating, clueLabel, activeHintTier, onDismiss }: HintOverlayProps) {
  const tierLabel = activeHintTier && activeHintTier !== "socratic" ? activeHintTier.charAt(0).toUpperCase() + activeHintTier.slice(1) : null;
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={14} color={theme.violet} />
        <Text style={styles.label}>Memory whisper</Text>
        {tierLabel ? (
          <View style={styles.tierBadge}>
            <Text style={styles.tierLabel}>{tierLabel}</Text>
          </View>
        ) : null}
        <Text style={styles.source}>Venice AI</Text>
        {onDismiss ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss hint"
            onPress={onDismiss}
            hitSlop={8}
            style={styles.closeButton}
          >
            <Ionicons name="close" size={16} color="rgba(167, 139, 250, 0.6)" />
          </Pressable>
        ) : null}
      </View>

      {isGenerating ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator size="small" color={theme.violet} />
          <Text style={styles.loadingText}>Probing the memory…</Text>
        </View>
      ) : (
        <Text style={styles.hintText}>{hint}</Text>
      )}

      <Text style={styles.privacyNote}>Privacy-preserving — Venice never stores your queries.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    gap: 8,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(139, 92, 246, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.25)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    flex: 1,
    color: theme.violet,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  source: {
    color: "rgba(167, 139, 250, 0.5)",
    fontSize: 10,
    fontWeight: "800",
  },
  tierBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.15)",
    backgroundColor: "rgba(139, 92, 246, 0.08)",
  },
  tierLabel: {
    color: theme.inkAlpha60,
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  closeButton: {
    marginLeft: 4,
    padding: 2,
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    color: "rgba(167, 139, 250, 0.7)",
    fontSize: 13,
    fontWeight: "700",
  },
  hintText: {
    color: theme.inkAlpha84,
    fontSize: 15,
    lineHeight: 22,
    fontStyle: "italic",
  },
  privacyNote: {
    color: "rgba(167, 139, 250, 0.38)",
    fontSize: 10,
    fontWeight: "700",
  },
});
