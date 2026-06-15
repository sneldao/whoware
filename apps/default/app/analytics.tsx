import { Ionicons } from "@expo/vector-icons";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TooltipOverlay, useTooltip } from "@/components/curator/tooltip";
import { TappableMetric } from "@/components/shared/tappable-metric";

export default function AnalyticsPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const stats = useQuery(api.analytics.getGlobalStats);
  const leaderboard = useQuery(api.analytics.getStreakLeaderboard);
  const recentSolves = useQuery(api.analytics.getRecentSolves);
  const tooltip = useTooltip();

  const STAT_DEFINITIONS: Record<string, { title: string; description: string }> = {
    totalSolves: {
      title: "Total Solves",
      description: "The total number of correct guesses submitted by all players. Each solve represents a completed episode.",
    },
    uniquePlayers: {
      title: "Unique Players",
      description: "The number of distinct players who have submitted at least one correct guess this season.",
    },
    avgScore: {
      title: "Average Score",
      description: "The mean score across all correct solves. Scores range from 0 to 10,000 and reward restraint — fewer clues opened and faster guesses earn higher points.",
    },
    totalRuns: {
      title: "Total Runs",
      description: "The total number of game sessions started, including incomplete ones. A higher run count than solve count means players are engaging but not always finishing.",
    },
    onChainMints: {
      title: "On-Chain Mints",
      description: "The number of solve records minted as NFTs on the Mantle blockchain. Each mint permanently records a player's achievement as an on-chain credential.",
    },
    archiveUnlocks: {
      title: "Archive Unlocks",
      description: "The number of closed episodes unlocked via USDC payment on Polygon Amoy. Players pay to access past episodes they missed.",
    },
    episodes: {
      title: "Episodes",
      description: "The total number of episodes in the catalog, including those in staging, draft, or live status. Curated and generated via Venice AI.",
    },
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 28 }]}
      >
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={20} color="#FFF7ED" />
          </Pressable>
          <View>
            <Text style={styles.title}>WhoWare Pulse</Text>
            <Text style={styles.subtitle}>Live game metrics</Text>
          </View>
        </View>

        {stats ? (
          <View style={styles.statsGrid}>
            <TappableMetric variant="card" label="Total Solves" value={formatNumber(stats.totalSolves)} icon="checkmark-circle" iconColor="#86EFAC" onPress={() => tooltip.show("totalSolves")} />
            <TappableMetric variant="card" label="Unique Players" value={formatNumber(stats.uniqueSolvers)} icon="people" iconColor="#93C5FD" onPress={() => tooltip.show("uniquePlayers")} />
            <TappableMetric variant="card" label="Avg Score" value={formatNumber(stats.averageScore)} icon="star" iconColor="#FBBF24" onPress={() => tooltip.show("avgScore")} />
            <TappableMetric variant="card" label="Total Runs" value={formatNumber(stats.totalRuns)} icon="play" iconColor="#C084FC" onPress={() => tooltip.show("totalRuns")} />
            <TappableMetric variant="card" label="On-Chain Mints" value={formatNumber(stats.totalMints)} icon="cube" iconColor="#FB923C" onPress={() => tooltip.show("onChainMints")} />
            <TappableMetric variant="card" label="Archive Unlocks" value={formatNumber(stats.totalArchiveUnlocks)} icon="lock-open" iconColor="#F472B6" onPress={() => tooltip.show("archiveUnlocks")} />
            <TappableMetric variant="card" label="Episodes" value={formatNumber(stats.episodeCount)} icon="layers" iconColor="#67E8F9" onPress={() => tooltip.show("episodes")} />
          </View>
        ) : (
          <View style={styles.loadingBox}>
            <Text style={styles.loadingText}>Loading stats…</Text>
          </View>
        )}

        <TooltipOverlay
          activeBadge={tooltip.activeBadge}
          onDismiss={tooltip.hide}
          definitions={STAT_DEFINITIONS}
          accentColor="#FBBF24"
        />

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Solvers</Text>
          {leaderboard && leaderboard.length > 0 ? (
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableCell, styles.tableCellRank]}>#</Text>
                <Text style={[styles.tableCell, styles.tableCellName]}>Player</Text>
                <Text style={[styles.tableCell, styles.tableCellSolves]}>Solves</Text>
                <Text style={[styles.tableCell, styles.tableCellScore]}>Best</Text>
              </View>
              {leaderboard.map((entry, i) => (
                <View key={`${entry.playerName}-${i}`} style={styles.tableRow}>
                  <Text style={[styles.tableCell, styles.tableCellRank, styles.tableCellValue]}>{i + 1}</Text>
                  <Text style={[styles.tableCell, styles.tableCellName, styles.tableCellValue]} numberOfLines={1}>
                    {entry.playerName}
                  </Text>
                  <Text style={[styles.tableCell, styles.tableCellSolves, styles.tableCellValue]}>{entry.totalSolves}</Text>
                  <Text style={[styles.tableCell, styles.tableCellScore, styles.tableCellValue]}>{formatNumber(entry.bestScore)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No solves yet</Text>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Solves</Text>
          {recentSolves && recentSolves.length > 0 ? (
            <View style={styles.feed}>
              {recentSolves.map((solve, i) => (
                <View key={`${solve.playerName}-${solve.guessedAt}-${i}`} style={styles.feedItem}>
                  <View style={styles.feedIcon}>
                    <Ionicons name="checkmark" size={14} color="#86EFAC" />
                  </View>
                  <View style={styles.feedContent}>
                    <Text style={styles.feedPlayer}>{solve.playerName}</Text>
                    <Text style={styles.feedMeta}>
                      {solve.scenesRevealed} scenes · {formatNumber(solve.score)} pts
                    </Text>
                  </View>
                  <Text style={styles.feedTime}>{timeAgo(solve.guessedAt)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>No recent solves</Text>
          )}
        </View>

        <Pressable style={styles.gameBridgeButton} href="/">
          <Ionicons name="arrow-back" size={16} color="#111827" />
          <Text style={styles.gameBridgeText}>Back to today's puzzle</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#070A12",
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    gap: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 247, 237, 0.08)",
  },
  title: {
    color: "#FFF7ED",
    fontSize: 26,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  subtitle: {
    color: "rgba(255, 247, 237, 0.5)",
    fontSize: 13,
    fontWeight: "800",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  loadingBox: {
    padding: 30,
    alignItems: "center",
  },
  loadingText: {
    color: "rgba(255, 247, 237, 0.5)",
    fontSize: 14,
    fontWeight: "800",
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: "#FBBF24",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  table: {
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.08)",
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "rgba(255, 247, 237, 0.03)",
  },
  tableRow: {
    flexDirection: "row",
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 247, 237, 0.05)",
  },
  tableCell: {
    color: "rgba(255, 247, 237, 0.45)",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  tableCellValue: {
    textTransform: "none",
    color: "#FFF7ED",
    fontSize: 14,
  },
  tableCellRank: {
    width: 30,
  },
  tableCellName: {
    flex: 1,
  },
  tableCellSolves: {
    width: 50,
    textAlign: "center",
  },
  tableCellScore: {
    width: 60,
    textAlign: "right",
  },
  feed: {
    gap: 8,
  },
  feedItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.06)",
  },
  feedIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(134, 239, 172, 0.12)",
  },
  feedContent: {
    flex: 1,
    gap: 2,
  },
  feedPlayer: {
    color: "#FFF7ED",
    fontSize: 14,
    fontWeight: "800",
  },
  feedMeta: {
    color: "rgba(255, 247, 237, 0.45)",
    fontSize: 12,
    fontWeight: "700",
  },
  feedTime: {
    color: "rgba(255, 247, 237, 0.35)",
    fontSize: 11,
    fontWeight: "800",
  },
  emptyText: {
    color: "rgba(255, 247, 237, 0.35)",
    fontSize: 14,
    fontWeight: "700",
    padding: 16,
  },
  gameBridgeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "#FBBF24",
    marginBottom: 20,
  },
  gameBridgeText: {
    color: "#111827",
    fontSize: 15,
    fontWeight: "900",
  },
});
