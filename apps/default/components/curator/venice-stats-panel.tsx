import { api } from "@/convex/_generated/api";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { TappableMetric } from "@/components/shared/tappable-metric";

export function VeniceStatsPanel() {
  const stats = useQuery(api.venice.getVeniceStats);

  if (!stats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="rgba(167, 139, 250, 0.6)" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="pulse" size={14} color="#A78BFA" />
          <Text style={styles.headerTitle}>Venice AI Activity</Text>
        </View>
        <View style={styles.headerBadge}>
          <View style={styles.headerDot} />
          <Text style={styles.headerBadgeText}>Live</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <TappableMetric
          variant="badge"
          icon="film"
          iconColor="#A78BFA"
          label="Episodes Generated"
          value={stats.totalEpisodesGenerated.toLocaleString()}
        />
        <TappableMetric
          variant="badge"
          icon="chatbubbles"
          iconColor="#22C55E"
          label="Hints Provided"
          value={stats.totalHintsProvided.toLocaleString()}
          sublabel={`${stats.cachedHintsAvailable} cached`}
        />
        <TappableMetric
          variant="badge"
          icon="image"
          iconColor="#FBBF24"
          label="Images Rendered"
          value={stats.totalImagesRendered.toLocaleString()}
        />
      </View>

      <View style={styles.footer}>
        <Ionicons name="flash" size={10} color="rgba(167, 139, 250, 0.4)" />
        <Text style={styles.footerText}>
          All assets generated autonomously via Venice AI API
        </Text>
      </View>
    </View>
  );
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
  loadingContainer: {
    padding: 32,
    alignItems: "center",
    borderRadius: 18,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.12)",
    backgroundColor: "rgba(167, 139, 250, 0.04)",
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
  headerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(34, 197, 94, 0.1)",
  },
  headerDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#22C55E",
  },
  headerBadgeText: {
    color: "#22C55E",
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  grid: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
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
    color: "rgba(167, 139, 250, 0.4)",
    fontSize: 9,
    fontWeight: "600",
  },
});
