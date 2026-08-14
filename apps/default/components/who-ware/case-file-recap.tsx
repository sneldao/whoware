import { theme } from "@/lib/theme";
import { DIFFICULTY_PALETTE } from "@/components/who-ware/result-share-card";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

export interface CaseFileStat {
  label: string;
  value: string;
  accent?: boolean;
}

interface CaseFileRecapProps {
  episodeNumber: number;
  difficulty?: "iconic" | "field" | "research";
  stats: CaseFileStat[];
  /** Spoiler-free proximity feedback from this session's latest guess, if any. */
  lastProximity?: string | null;
  onResume: () => void;
  onDismiss: () => void;
}

/**
 * "Where you left off" overlay for returning mid-run players.
 *
 * Renders over the live room when a player comes back with an active run:
 * one glance re-establishes the case state (memories, clues, guesses left)
 * before they re-enter the fiction. Player-generated facts only — never
 * the answer or server-held reveal data.
 */
export function CaseFileRecap({
  episodeNumber,
  difficulty,
  stats,
  lastProximity,
  onResume,
  onDismiss,
}: CaseFileRecapProps) {
  const difficultyStyle = difficulty
    ? DIFFICULTY_PALETTE[difficulty] ?? DIFFICULTY_PALETTE.iconic
    : null;

  return (
    // Modal scrim: blocks room interaction until the player resumes or dismisses.
    <View style={styles.backdrop}>
      <Animated.View entering={FadeInDown.duration(450)} style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.kicker}>Case file</Text>
          <View style={styles.chips}>
            <View style={styles.chip}>
              <Text style={styles.chipText}>Episode {String(episodeNumber).padStart(2, "0")}</Text>
            </View>
            {difficultyStyle ? (
              <View style={[styles.chip, { backgroundColor: difficultyStyle.bg }]}>
                <Text style={[styles.chipText, { color: difficultyStyle.fg }]}>
                  {difficultyStyle.label}
                </Text>
              </View>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss case file"
            onPress={onDismiss}
            hitSlop={8}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          >
            <Ionicons name="close" size={16} color={theme.inkAlpha70} />
          </Pressable>
        </View>

        <Text style={styles.title}>Where you left off</Text>

        <View style={styles.statsGrid}>
          {stats.map((stat) => (
            <View key={stat.label} style={styles.stat}>
              <Text style={styles.statLabel}>{stat.label}</Text>
              <Text style={[styles.statValue, stat.accent && styles.statValueAccent]}>
                {stat.value}
              </Text>
            </View>
          ))}
        </View>

        {lastProximity ? (
          <View style={styles.proximity}>
            <Ionicons name="navigate-outline" size={14} color={theme.accent} />
            <Text style={styles.proximityText} numberOfLines={2}>
              Last guess: {lastProximity}
            </Text>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={onResume}
          style={({ pressed }) => [styles.resumeBtn, pressed && styles.pressed]}
        >
          <Ionicons name="footsteps" size={17} color={theme.inkOnAccent} />
          <Text style={styles.resumeText}>Step back in</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: 64,
    paddingHorizontal: 20,
    backgroundColor: "rgba(8, 5, 2, 0.62)",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    gap: 14,
    padding: 22,
    borderRadius: 26,
    borderCurve: "continuous",
    backgroundColor: "rgba(12, 8, 4, 0.94)",
    borderWidth: 1,
    borderColor: theme.inkAlpha20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  kicker: {
    color: theme.accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 2.2,
    textTransform: "uppercase",
  },
  chips: {
    flexDirection: "row",
    gap: 6,
    flex: 1,
  },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderCurve: "continuous",
    backgroundColor: theme.inkAlpha8,
  },
  chipText: {
    color: theme.inkAlpha80,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.inkAlpha6,
  },
  title: {
    color: theme.ink,
    fontSize: 24,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  stat: {
    flexGrow: 1,
    flexBasis: 84,
    gap: 3,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: theme.inkAlpha4,
    borderWidth: 1,
    borderColor: theme.inkAlpha07,
  },
  statLabel: {
    color: theme.inkAlpha50,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  statValue: {
    color: theme.ink,
    fontSize: 17,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  statValueAccent: {
    color: theme.accent,
  },
  proximity: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: theme.accentAlpha8,
    borderWidth: 1,
    borderColor: theme.accentAlpha20,
  },
  proximityText: {
    color: theme.inkAlpha84,
    fontSize: 12.5,
    fontWeight: "700",
    flex: 1,
  },
  resumeBtn: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: theme.accent,
  },
  resumeText: {
    color: theme.inkOnAccent,
    fontSize: 15.5,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.72,
  },
});
