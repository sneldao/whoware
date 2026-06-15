import { api } from "@/convex/_generated/api";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { TooltipOverlay, useTooltip } from "./tooltip";

type LeaderTab = "hints" | "speed" | "solvers" | "episodes";

const TABS: {
  key: LeaderTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
}[] = [
  { key: "hints", label: "Most Hints", icon: "search", accent: "#A78BFA" },
  { key: "speed", label: "Fastest Solves", icon: "flash", accent: "#22C55E" },
  { key: "solvers", label: "Top Solvers", icon: "trophy", accent: "#FBBF24" },
  { key: "episodes", label: "Episodes", icon: "film", accent: "#F472B6" },
];

function formatValue(key: LeaderTab, value: number): string {
  if (key === "speed") {
    const totalSeconds = Math.floor(value / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  }
  return `${value}`;
}

function formatValueLabel(key: LeaderTab): string {
  if (key === "hints") return "clues";
  if (key === "speed") return "time";
  if (key === "solvers") return "solves";
  return ""; // episodes tab uses secondary text instead
}

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) {
    return <Ionicons name="trophy" size={16} color="#FBBF24" />;
  }
  if (rank === 2) {
    return <Ionicons name="medal" size={14} color="#94A3B8" />;
  }
  if (rank === 3) {
    return <Ionicons name="medal" size={14} color="#CD7F32" />;
  }
  return <Text style={styles.rankNum}>{rank}</Text>;
}

const SORT_OPTIONS: { key: "solves" | "hints" | "speed"; label: string }[] = [
  { key: "solves", label: "Top Solves" },
  { key: "hints", label: "Most Hints" },
  { key: "speed", label: "Fastest" },
];

export function CuratorLeaderboard() {
  const [activeTab, setActiveTab] = useState<LeaderTab>("hints");
  const [episodeSort, setEpisodeSort] = useState<"solves" | "hints" | "speed">("solves");
  const weeklyLeaders = useQuery(api.analytics.getWeeklyLeaders);
  const episodeBreakdowns = useQuery(api.analytics.getEpisodeBreakdowns);

  const showPlayerTab = activeTab === "hints" || activeTab === "speed" || activeTab === "solvers";

  const playerData = showPlayerTab && weeklyLeaders
    ? weeklyLeaders[activeTab === "hints" ? "mostHints" : activeTab === "speed" ? "fastestSolves" : "topSolvers"]
    : [];

  const rawEpisodeData = activeTab === "episodes" ? (episodeBreakdowns ?? []) : [];

  // Sort episode data based on toggle
  const episodeData = [...rawEpisodeData].sort((a, b) => {
    if (episodeSort === "hints") return b.mostHintsUsed - a.mostHintsUsed;
    if (episodeSort === "speed") return a.fastestSolveMs - b.fastestSolveMs;
    return b.totalSolves - a.totalSolves;
  });
  const maxAvgScore = Math.max(...episodeData.map((e) => e.averageScore), 0);

  const tooltip = useTooltip(3000);

  const tooltipAccent =
    activeTab === "episodes"
      ? "#F472B6"
      : activeTab === "hints"
        ? "#A78BFA"
        : activeTab === "speed"
          ? "#22C55E"
          : "#FBBF24";

  const loading = activeTab === "episodes" ? !episodeBreakdowns : !weeklyLeaders;
  const accent = TABS.find((t) => t.key === activeTab)?.accent ?? "#A78BFA";

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="podium" size={14} color="#A78BFA" />
          <Text style={styles.headerTitle}>Weekly Leaders</Text>
        </View>
        <View style={styles.countBadge}>
          <Text style={styles.countBadgeText}>This week</Text>
        </View>
      </View>

      {/* Tab bar */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={({ pressed }) => [
              styles.tab,
              activeTab === tab.key && { backgroundColor: `${tab.accent}15`, borderColor: `${tab.accent}30` },
              pressed && styles.pressed,
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={12}
              color={activeTab === tab.key ? tab.accent : "rgba(255, 247, 237, 0.35)"}
            />
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.key && { color: tab.accent, fontWeight: "900" },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Episode sort toggle */}
      {activeTab === "episodes" && episodeData.length > 0 ? (
        <View style={styles.sortRow}>
          {SORT_OPTIONS.map((opt) => {
            const isActive = episodeSort === opt.key;
            return (
              <Pressable
                key={opt.key}
                style={({ pressed }) => [
                  styles.sortChip,
                  isActive && {
                    backgroundColor: "#F472B615",
                    borderColor: "#F472B630",
                  },
                  pressed && styles.pressed,
                ]}
                onPress={() => setEpisodeSort(opt.key)}
              >
                <Text style={[styles.sortChipText, isActive && { color: "#F472B6", fontWeight: "900" }]}>
                  {opt.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {/* List */}
      <View style={styles.list}>
        {loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size="small" color="rgba(167, 139, 250, 0.6)" />
          </View>
        ) : showPlayerTab ? (
          playerData.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="analytics-outline" size={24} color="rgba(255, 247, 237, 0.12)" />
              <Text style={styles.emptyTitle}>No data yet this week</Text>
              <Text style={styles.emptyText}>
                Leaderboards populate as players solve episodes
              </Text>
            </View>
          ) : (
            playerData.slice(0, 8).map((entry) => (
              <View key={`${entry.playerName}-${entry.rank}`} style={styles.row}>
                <View style={styles.rankCol}>
                  <RankIcon rank={entry.rank} />
                </View>
                <View style={styles.nameCol}>
                  <Text style={styles.playerName}>{entry.playerName}</Text>
                  {entry.secondary ? (
                    <Text style={styles.secondary}>{entry.secondary}</Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={() => tooltip.show(activeTab)}
                  style={({ pressed }) => [pressed && styles.pressed]}
                >
                <View style={[styles.valueCol, { backgroundColor: `${accent}10`, borderColor: `${accent}20` }]}>
                  <Text style={[styles.valueText, { color: accent }]}>
                    {formatValue(activeTab, entry.value)}
                  </Text>
                  <Text style={styles.valueLabel}>{formatValueLabel(activeTab)}</Text>
                </View>
                </Pressable>
              </View>
            ))
          )
        ) : (
          /* Episodes tab */
          episodeData.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="film-outline" size={24} color="rgba(255, 247, 237, 0.12)" />
              <Text style={styles.emptyTitle}>No episodes solved this week</Text>
              <Text style={styles.emptyText}>
                Episode breakdowns appear once players start solving
              </Text>
            </View>
          ) : (
            episodeData.slice(0, 8).map((entry, i) => (
                <View key={entry.episodeId} style={styles.episodeRow}>
                  <View style={styles.rankCol}>
                    <RankIcon rank={i + 1} />
                  </View>
                  <View style={styles.nameCol}>
                    <Text style={styles.playerName} numberOfLines={1}>
                      {entry.figureName}
                    </Text>
                    <Text style={styles.secondary}>
                      {entry.slug} · {entry.totalSolves} solve{entry.totalSolves !== 1 ? "s" : ""}
                    </Text>
                  </View>
                  <View style={styles.episodeBadgeCol}>
                    {/* Hints badge — glows when sorting by hints */}
                    <Pressable
                      onPress={() => tooltip.show("hints")}
                      style={({ pressed }) => [pressed && styles.pressed]}
                    >
                    <View
                      style={[
                        styles.episodeBadge,
                        episodeSort === "hints"
                          ? {
                              backgroundColor: "#A78BFA30",
                              borderColor: "#A78BFA60",
                              elevation: 3,
                              shadowColor: "#A78BFA",
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.4,
                              shadowRadius: 4,
                            }
                          : { backgroundColor: "#A78BFA15", borderColor: "#A78BFA20" },
                      ]}
                    >
                      <Ionicons name="search" size={9} color={episodeSort === "hints" ? "#C4B5FD" : "#A78BFA"} />
                      <Text
                        style={[
                          styles.episodeBadgeText,
                          { color: episodeSort === "hints" ? "#C4B5FD" : "#A78BFA" },
                        ]}
                      >
                        {entry.mostHintsUsed}
                      </Text>
                    </View>
                    </Pressable>
                    {/* Score badge — glows on highest average score */}
                    <Pressable
                      onPress={() => tooltip.show("score")}
                      style={({ pressed }) => [pressed && styles.pressed]}
                    >
                    <View
                      style={[
                        styles.episodeBadge,
                        entry.averageScore >= maxAvgScore && maxAvgScore > 0
                          ? {
                              backgroundColor: "#FBBF2430",
                              borderColor: "#FBBF2460",
                              elevation: 3,
                              shadowColor: "#FBBF24",
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.4,
                              shadowRadius: 4,
                            }
                          : { backgroundColor: "#FBBF2410", borderColor: "#FBBF2415" },
                      ]}
                    >
                      <Ionicons name="star" size={9} color={entry.averageScore >= maxAvgScore && maxAvgScore > 0 ? "#FDE68A" : "#FBBF24"} />
                      <Text
                        style={[
                          styles.episodeBadgeText,
                          { color: entry.averageScore >= maxAvgScore && maxAvgScore > 0 ? "#FDE68A" : "#FBBF24" },
                        ]}
                      >
                        {entry.averageScore.toLocaleString()}
                      </Text>
                      <Text
                        style={{
                          color: "rgba(255, 247, 237, 0.3)",
                          fontSize: 7,
                          fontWeight: "700",
                          textTransform: "uppercase",
                        }}
                      >
                        avg
                      </Text>
                    </View>
                    </Pressable>
                    {/* Speed badge — glows when sorting by speed */}
                    <Pressable
                      onPress={() => tooltip.show("speed")}
                      style={({ pressed }) => [pressed && styles.pressed]}
                    >
                    <View
                      style={[
                        styles.episodeBadge,
                        episodeSort === "speed"
                          ? {
                              backgroundColor: "#22C55E30",
                              borderColor: "#22C55E60",
                              elevation: 3,
                              shadowColor: "#22C55E",
                              shadowOffset: { width: 0, height: 1 },
                              shadowOpacity: 0.4,
                              shadowRadius: 4,
                            }
                          : { backgroundColor: "#22C55E15", borderColor: "#22C55E20" },
                      ]}
                    >
                      <Ionicons name="flash" size={9} color={episodeSort === "speed" ? "#86EFAC" : "#22C55E"} />
                      <Text
                        style={[
                          styles.episodeBadgeText,
                          { color: episodeSort === "speed" ? "#86EFAC" : "#22C55E" },
                        ]}
                      >
                        {formatElapsedSeconds(entry.fastestSolveMs)}
                      </Text>
                    </View>
                    </Pressable>
                  </View>
                </View>
              ))
          )
        )}
      </View>

      {/* Tooltip overlay */}
      <TooltipOverlay
        activeBadge={tooltip.activeBadge}
        onDismiss={tooltip.hide}
        definitions={{
          hints: {
            title: "Most hints used",
            description: "The highest number of clues a player inspected in a single solve for this episode. More clues inspected means a lower final score.",
          },
          score: {
            title: "Average score",
            description: "The mean score across all correct solves this week for this episode. Scores range from 0 to 10,000 based on restraint.",
          },
          speed: {
            title: "Fastest solve",
            description: "The quickest correct guess for this episode. Lower time means fewer memories opened, clues inspected, and guesses used.",
          },
          solvers: {
            title: "Top solvers",
            description: "Players ranked by total correct guesses this week. More solves indicates consistent mastery across multiple episodes.",
          },
        }}
        accentColor={tooltipAccent}
      />

      <View style={styles.footer}>
        <Ionicons name="time" size={10} color="rgba(167, 139, 250, 0.3)" />
        <Text style={styles.footerText}>
          {showPlayerTab
            ? "Rolling 7-day window · correct solves only"
            : `Sorted by ${episodeSort === "hints" ? "most hints used" : episodeSort === "speed" ? "fastest solve time" : "total solves"} · stats per episode`}
        </Text>
      </View>
    </View>
  );
}

function formatElapsedSeconds(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 18,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.12)",
    backgroundColor: "rgba(167, 139, 250, 0.04)",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(167, 139, 250, 0.08)",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#A78BFA",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(251, 191, 36, 0.1)",
  },
  countBadgeText: {
    color: "#FBBF24",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  tabRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 8,
    borderRadius: 10,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.06)",
    backgroundColor: "rgba(255, 247, 237, 0.03)",
  },
  tabLabel: {
    color: "rgba(255, 247, 237, 0.5)",
    fontSize: 10,
    fontWeight: "700",
  },
  list: {
    paddingHorizontal: 14,
    paddingBottom: 8,
    gap: 4,
  },
  loadingRow: {
    padding: 32,
    alignItems: "center",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderCurve: "continuous",
    backgroundColor: "rgba(0, 0, 0, 0.15)",
  },
  episodeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderCurve: "continuous",
    backgroundColor: "rgba(0, 0, 0, 0.15)",
  },
  rankCol: {
    width: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  rankNum: {
    color: "rgba(255, 247, 237, 0.4)",
    fontSize: 12,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  nameCol: {
    flex: 1,
    gap: 1,
  },
  playerName: {
    color: "#FFF7ED",
    fontSize: 13,
    fontWeight: "800",
  },
  secondary: {
    color: "rgba(255, 247, 237, 0.35)",
    fontSize: 9,
    fontWeight: "700",
  },
  valueCol: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderCurve: "continuous",
    borderWidth: 1,
  },
  valueText: {
    fontSize: 13,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  valueLabel: {
    color: "rgba(255, 247, 237, 0.3)",
    fontSize: 8,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  episodeBadgeCol: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 4,
  },
  episodeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderCurve: "continuous",
    borderWidth: 1,
  },
  episodeBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  sortRow: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  sortChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.06)",
    backgroundColor: "rgba(255, 247, 237, 0.03)",
  },
  sortChipText: {
    color: "rgba(255, 247, 237, 0.5)",
    fontSize: 10,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    padding: 24,
    gap: 6,
  },
  emptyTitle: {
    color: "rgba(255, 247, 237, 0.5)",
    fontSize: 13,
    fontWeight: "800",
  },
  emptyText: {
    color: "rgba(255, 247, 237, 0.25)",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(167, 139, 250, 0.06)",
  },
  footerText: {
    color: "rgba(167, 139, 250, 0.3)",
    fontSize: 9,
    fontWeight: "600",
  },
  pressed: {
    opacity: 0.72,
  },
});
