import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { useAction, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { theme } from "@/lib/theme";

interface IdentityHintButtonProps {
  episodeId: Id<"episodes">;
  scenesRevealed: number;
  streak: number;
  isRunActive: boolean;
}

/**
 * Progressive "identity nudge" button. Unlocks once the player has viewed at
 * least 3 scenes OR carries a streak of 1+, to discourage early crutches.
 * Renders nothing when the run is already solved/exhausted.
 */
export function IdentityHintButton({
  episodeId,
  scenesRevealed,
  streak,
  isRunActive,
}: IdentityHintButtonProps) {
  const generateIdentityHint = useAction(api.venice.generateIdentityHint);
  const cached = useQuery(api.venice.getIdentityHint, { episodeId });
  const [hint, setHint] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isUnlocked = scenesRevealed >= 3 || streak >= 1;

  useEffect(() => {
    if (cached && !hint) setHint(cached);
  }, [cached, hint]);

  if (!isRunActive) return null;

  if (!isUnlocked) {
    return (
      <View style={[styles.container, styles.locked]}>
        <Ionicons name="lock-closed" size={14} color={theme.inkAlpha40} />
        <Text style={styles.lockedText}>
          Identity nudge unlocks after {3 - scenesRevealed > 0 ? 3 - scenesRevealed : 0} more{" "}
          {scenesRevealed === 2 ? "memory" : "memories"}
        </Text>
      </View>
    );
  }

  async function handleRequest() {
    if (hint || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await generateIdentityHint({ episodeId });
      setHint(result);
    } catch {
      setError("The signal slipped. Tap to try again.");
    } finally {
      setIsLoading(false);
    }
  }

  if (hint) {
    return (
      <View style={styles.container}>
        <View style={styles.hintHeader}>
          <Ionicons name="compass-outline" size={14} color={theme.accent} />
          <Text style={styles.hintLabel}>Identity nudge</Text>
        </View>
        <Text style={styles.hintText}>{hint}</Text>
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={handleRequest}
      disabled={isLoading}
      style={({ pressed }) => [styles.button, pressed && styles.pressed, isLoading && styles.busy]}
    >
      {isLoading ? (
        <ActivityIndicator color={theme.inkInverted} size="small" />
      ) : (
        <Ionicons name="compass-outline" size={16} color={theme.inkInverted} />
      )}
      <Text style={styles.buttonText}>
        {error ? error : isLoading ? "Listening…" : "Ask the memory who it was"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 14,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: theme.accentAlpha8,
    borderWidth: 1,
    borderColor: theme.accentAlpha22,
    gap: 8,
  },
  locked: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.inkAlpha4,
    borderColor: theme.inkAlpha8,
    gap: 8,
  },
  lockedText: {
    flex: 1,
    color: theme.inkAlpha40,
    fontSize: 12,
    fontWeight: "700",
  },
  hintHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hintLabel: {
    color: theme.accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  hintText: {
    color: theme.ink,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 50,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: theme.accent,
  },
  buttonText: {
    color: theme.inkInverted,
    fontSize: 14,
    fontWeight: "900",
  },
  busy: {
    opacity: 0.7,
  },
  pressed: {
    opacity: 0.8,
  },
});
