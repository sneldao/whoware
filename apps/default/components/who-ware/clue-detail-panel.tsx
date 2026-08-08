import { theme } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { HintOverlay } from "@/components/who-ware/hint-overlay";
import { VeniceAiBadge } from "@/components/who-ware/venice-ai-badge";
import { HINT_PENALTY } from "@/convex/scoring";

export interface ClueDetail {
  label: string;
  detail: string;
}

type HintTier = "socratic" | "era" | "proximity";

interface ClueDetailPanelProps {
  clue: ClueDetail;
  hintLabel: string;
  /** Generate a hint for this clue. tier escalates the nudge (socratic → era → proximity). */
  onGenerateHint?: (clueLabel: string, tier: HintTier) => void;
  activeHint?: string | null;
  activeHintTier?: HintTier | null;
  isHintGenerating?: boolean;
  /** Whether any hint tier has been generated for the current scene. */
  hintUsedForScene?: boolean;
  /** Whether a specific tier was already generated for the current scene. */
  hasHintTier?: (tier: HintTier) => boolean;
  /** The hint button is disabled when no clue has been opened in the current scene. */
  canRequestHint?: boolean;
  /** Dismiss the hint overlay — clears the active hint in the parent. */
  onDismissHint?: () => void;
}

const TIER_ORDER: HintTier[] = ["socratic", "era", "proximity"];

const TIER_CONFIG: Record<HintTier, { label: string; cost: string }> = {
  socratic: { label: "Whisper", cost: `−${HINT_PENALTY} pts` },
  era: { label: "Era nudge", cost: `−${HINT_PENALTY} pts` },
  proximity: { label: "Proximity", cost: `−${HINT_PENALTY} pts` },
};

/** Shared clue payoff UI used by both panorama and 3D scene paths. */
export function ClueDetailPanel({
  clue,
  hintLabel,
  onGenerateHint,
  activeHint,
  activeHintTier,
  isHintGenerating,
  hintUsedForScene,
  hasHintTier,
  canRequestHint,
  onDismissHint,
}: ClueDetailPanelProps) {
  const anyTierGenerated = hintUsedForScene ?? false;
  const tierGenerated = (t: HintTier) => hasHintTier?.(t) ?? false;

  return (
    <View style={styles.cluePanel}>
      <View style={styles.clueHeader}>
        <Ionicons name="search" size={18} color={theme.parchment} />
        <Text style={styles.clueTitle}>{clue.label}</Text>
      </View>
      <Text style={styles.clueText}>{clue.detail}</Text>

      {/* Hint generation / tier escalation */}
      {onGenerateHint ? (
        <View style={styles.hintSection}>
          {anyTierGenerated ? (
            // Tier escalation row — view generated tiers, escalate to the next
            <View style={styles.tierEscalation}>
              {TIER_ORDER.map((t, i) => {
                const generated = tierGenerated(t);
                const isActive = activeHint != null && activeHintTier === t;
                const prevGenerated = i === 0 || tierGenerated(TIER_ORDER[i - 1]);
                const canUse = generated || prevGenerated;
                const disabled = isHintGenerating || !canUse;

                return (
                  <Pressable
                    key={t}
                    accessibilityRole="button"
                    accessibilityLabel={
                      generated
                        ? `View ${TIER_CONFIG[t].label} hint`
                        : canUse
                          ? `Unlock ${TIER_CONFIG[t].label} hint for ${TIER_CONFIG[t].cost}`
                          : `${TIER_CONFIG[t].label} locked — unlock the previous tier first`
                    }
                    onPress={() => onGenerateHint(clue.label, t)}
                    disabled={disabled && !generated}
                    style={({ pressed }) => [
                      styles.tierButton,
                      isActive && styles.tierActive,
                      !canUse && styles.tierLocked,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Ionicons
                      name={
                        isActive
                          ? "checkmark-circle"
                          : generated
                            ? "eye-outline"
                            : canUse
                              ? "chevron-up-circle-outline"
                              : "lock-closed-outline"
                      }
                      size={14}
                      color={
                        isActive
                          ? theme.violet
                          : generated
                            ? "rgba(167, 139, 250, 0.7)"
                            : canUse
                              ? theme.inkAlpha55
                              : theme.inkAlpha30
                      }
                    />
                    <Text
                      style={[
                        styles.tierLabel,
                        isActive && styles.tierActiveLabel,
                        !canUse && styles.tierLockedLabel,
                      ]}
                    >
                      {TIER_CONFIG[t].label}
                      {!generated && canUse ? ` · ${TIER_CONFIG[t].cost}` : ""}
                    </Text>
                    {isHintGenerating && isActive ? (
                      <ActivityIndicator size={12} color={theme.violet} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            // No hints yet — single socratic button
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={hintLabel}
              onPress={() => onGenerateHint(clue.label, "socratic")}
              disabled={isHintGenerating || !canRequestHint}
              style={({ pressed }) => [
                styles.hintButton,
                pressed && styles.pressed,
                (isHintGenerating || !canRequestHint) && styles.disabledButton,
              ]}
            >
              {isHintGenerating ? (
                <ActivityIndicator size="small" color={theme.violet} />
              ) : (
                <Ionicons name="sparkles" size={16} color={theme.violet} />
              )}
              <Text style={styles.hintButtonText}>
                {isHintGenerating
                  ? "Probing memory…"
                  : canRequestHint
                    ? `${hintLabel} · ${TIER_CONFIG.socratic.cost}`
                    : "Open this clue to unlock the whisper"}
              </Text>
            </Pressable>
          )}
        </View>
      ) : null}

      {activeHint || isHintGenerating ? (
        <>
          {activeHint ? <VeniceAiBadge type="hint" compact /> : null}
          <HintOverlay
            hint={activeHint ?? null}
            isGenerating={isHintGenerating ?? false}
            clueLabel={clue.label}
            activeHintTier={activeHintTier ?? null}
            onDismiss={onDismissHint}
          />
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
  hintSection: {
    paddingVertical: 4,
  },
  tierEscalation: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tierButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.inkAlpha12,
    backgroundColor: theme.inkAlpha04,
  },
  tierActive: {
    borderColor: "rgba(167, 139, 250, 0.45)",
    backgroundColor: "rgba(139, 92, 246, 0.14)",
  },
  tierLocked: {
    opacity: 0.45,
  },
  tierLabel: {
    color: theme.inkAlpha60,
    fontSize: 11,
    fontWeight: "800",
  },
  tierActiveLabel: {
    color: theme.violet,
  },
  tierLockedLabel: {
    color: theme.inkAlpha30,
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
