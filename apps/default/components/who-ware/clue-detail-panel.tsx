import { theme } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { HintOverlay } from "@/components/who-ware/hint-overlay";
import { VeniceAiBadge } from "@/components/who-ware/venice-ai-badge";

export interface ClueDetail {
  label: string;
  detail: string;
}

interface ClueDetailPanelProps {
  clue: ClueDetail;
  onGenerateHint?: (clueLabel: string) => void;
  activeHint?: string | null;
  isHintGenerating?: boolean;
}

/** Shared clue payoff UI used by both panorama and 3D scene paths. */
export function ClueDetailPanel({
  clue,
  onGenerateHint,
  activeHint,
  isHintGenerating,
}: ClueDetailPanelProps) {
  return (
    <View style={styles.cluePanel}>
      <View style={styles.clueHeader}>
        <Ionicons name="search" size={18} color={theme.parchment} />
        <Text style={styles.clueTitle}>{clue.label}</Text>
      </View>
      <Text style={styles.clueText}>{clue.detail}</Text>
      {onGenerateHint ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => onGenerateHint(clue.label)}
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
          <HintOverlay hint={activeHint ?? null} isGenerating={isHintGenerating ?? false} clueLabel={clue.label} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
    color: theme.parchment,
    fontSize: 16,
    fontWeight: "900",
  },
  clueText: {
    color: theme.inkAlpha78,
    fontSize: 15,
    lineHeight: 22,
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
  pressed: {
    opacity: 0.72,
  },
});
