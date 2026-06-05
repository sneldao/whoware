import { Ionicons } from "@expo/vector-icons";
import { api } from "@/convex/_generated/api";
import { useQuery } from "convex/react";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AnalyticsPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const stats = useQuery(api.analytics.getGlobalStats);
  const leaderboard = useQuery(api.analytics.getStreakLeaderboard);
  const recentSolves = useQuery(api.analytics.getRecentSolves);

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
            <StatCard label="Total Solves" value={stats.totalSolves} icon="checkmark-circle" color="#86EFAC" />
            <StatCard label="Unique Players" value={stats.uniqueSolvers} icon="people" color="#93C5FD" />
            <StatCard label="Avg Score" value={stats.averageScore} icon="star" color="#FBBF24" />
            <StatCard label="Total Runs" value={stats.totalRuns} icon="play" color="#C084FC" />
            <StatCard label="On-Chain Mints" value={stats.totalMints} icon="cube" color="#FB923C" />
            <StatCard label="Archive Unlocks" value={stats.totalArchiveUnlocks} icon="lock-open" color="#F472B6" />
            <StatCard label="Episodes" value={stats.episodeCount} icon="layers" color="#67E8F9" />
          </View>
        ) : (
          <View style={styles.loadingBox}>
            <Text style={styles.loadingText}>Loading stats…</Text>
          </View>
        )}

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
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon as "checkmark-circle"} size={18} color={color} />
      </View>
      <Text style={styles.statValue}>{formatNumber(value)}</Text>
      <Text style={styles.statLabel}>{label}</Text>
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
  statCard: {
    flex: 1,
    minWidth: "45%",
    padding: 14,
    gap: 8,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.08)",
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: {
    color: "#FFF7ED",
    fontSize: 22,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    color: "rgba(255, 247, 237, 0.45)",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
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
});
