import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { theme } from "@/lib/theme";

interface TodaysRoomStatsProps {
  episodeId: string;
}

/**
 * "Today's Room" — a social stats panel showing aggregate community
 * interaction patterns for the active episode. Creates a shared daily
 * conversation without exposing individual player data.
 *
 * Shown after solve/exhaust in the column shell, between the result
 * card and the on-chain badges.
 */
export function TodaysRoomStats({ episodeId }: TodaysRoomStatsProps) {
  const stats = useQuery(api.analytics.getTodaysRoomStats, {
    episodeId: episodeId as Id<"episodes">,
  });

  if (!stats || stats.totalAttempts === 0) {
    return null;
  }

  return (
    <Animated.View entering={FadeInDown.duration(500).springify().damping(16)} style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="people-outline" size={16} color={theme.accent} />
        <Text style={styles.headerText}>Today's Room</Text>
      </View>
      <Text style={styles.subhead}>
        How {stats.totalAttempts} {stats.totalAttempts === 1 ? "player" : "players"}{" "}
        approached this room
      </Text>

      <View style={styles.statsGrid}>
        <StatTile
          icon="checkmark-circle-outline"
          label="Solved"
          value={`${stats.totalSolved}/${stats.totalAttempts}`}
          sub={`${stats.solveRate}%`}
        />
        <StatTile
          icon="layers-outline"
          label="Avg memories"
          value={`${stats.averageMemoriesUsed}`}
          sub={`median ${stats.medianMemoriesUsed}`}
        />
        <StatTile
          icon="finger-print"
          label="Avg guesses"
          value={`${stats.averageGuessesUsed}`}
          sub={`of 5`}
        />
        <StatTile
          icon="trophy-outline"
          label="Avg score"
          value={stats.averageScore > 0 ? stats.averageScore.toLocaleString() : "—"}
          sub="pts"
        />
      </View>

      {stats.fastestSolveMs > 0 ? (
        <View style={styles.highlightRow}>
          <Ionicons name="flash-outline" size={13} color={theme.accent} />
          <Text style={styles.highlightText}>
            Fastest solve: {formatTime(stats.fastestSolveMs)}
          </Text>
        </View>
      ) : null}

      {stats.mostCommonFirstClue ? (
        <View style={styles.highlightRow}>
          <Ionicons name="search-outline" size={13} color={theme.accent} />
          <Text style={styles.highlightText}>
            Most touched first: {stats.mostCommonFirstClue}
          </Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

function StatTile({
  icon,
  label,
  value,
  sub,
}: {
  icon: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <View style={styles.statTile}>
      <Ionicons name={icon as "checkmark-circle-outline"} size={14} color={theme.inkAlpha55} />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statSub}>{sub}</Text>
    </View>
  );
}

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  if (minutes > 0) {
    return `${minutes}:${remainder.toString().padStart(2, "0")}`;
  }
  return `${seconds}s`;
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    gap: 12,
    borderRadius: 28,
    borderCurve: "continuous",
    backgroundColor: theme.inkAlpha4,
    borderWidth: 1,
    borderColor: theme.inkAlpha8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerText: {
    color: theme.ink,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  subhead: {
    color: theme.inkAlpha60,
    fontSize: 13,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  statTile: {
    flex: 1,
    minWidth: 130,
    gap: 3,
    padding: 12,
    borderRadius: 16,
    backgroundColor: theme.inkAlpha6,
    borderWidth: 1,
    borderColor: theme.inkAlpha8,
  },
  statLabel: {
    color: theme.inkAlpha50,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  statValue: {
    color: theme.ink,
    fontSize: 18,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  statSub: {
    color: theme.inkAlpha45,
    fontSize: 11,
    fontWeight: "700",
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  highlightText: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: "700",
  },
});
