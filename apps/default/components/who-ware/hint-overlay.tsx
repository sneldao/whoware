import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { theme } from "@/lib/theme";

interface HintOverlayProps {
  hint: string | null;
  isGenerating: boolean;
  clueLabel: string;
}

/**
 * Displays an AI-generated Venice hint for a clue hotspot.
 * Shown in the panorama scene when a clue is tapped.
 */
export function HintOverlay({ hint, isGenerating, clueLabel }: HintOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (hint || isGenerating) {
      setIsVisible(true);
    }
  }, [hint, isGenerating]);

  if (!isVisible && !isGenerating) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={14} color={theme.violet} />
        <Text style={styles.label}>Memory whisper</Text>
        <Text style={styles.source}>Venice AI</Text>
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
    color: "rgba(255, 247, 237, 0.84)",
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
