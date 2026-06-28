import { theme } from "@/lib/theme";
import { api } from "@/convex/_generated/api";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface MetricRowProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  data: number[];
  maxValue: number;
  weeklyTotal: number;
}

function MetricRow({
  label,
  icon,
  color,
  data,
  maxValue,
  weeklyTotal,
}: MetricRowProps) {
  return (
    <View style={styles.metricRow}>
      <View style={styles.metricLabel}>
        <Ionicons name={icon} size={11} color={color} />
        <Text style={[styles.metricLabelText, { color }]}>{label}</Text>
      </View>
      <View style={styles.barRow}>
        {data.map((val, i) => {
          const height = maxValue > 0 ? (val / maxValue) * 100 : 0;
          return (
            <View key={i} style={styles.barCol}>
              <View style={styles.barWrapper}>
                {val > 0 ? (
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(height, 4),
                        backgroundColor: color,
                        opacity: 0.6 + 0.4 * (val / Math.max(maxValue, 1)),
                      },
                    ]}
                  />
                ) : null}
              </View>
              <Text style={styles.barValue}>{val > 0 ? val : ""}</Text>
            </View>
          );
        })}
      </View>
      <Text style={[styles.weeklyTotalText, { color }]}>
        {weeklyTotal}
      </Text>
    </View>
  );
}

export function VeniceWeeklyChart() {
  const weeklyStats = useQuery(api.venice.getVeniceWeeklyStats);

  if (!weeklyStats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="rgba(167, 139, 250, 0.6)" />
      </View>
    );
  }

  const dayLabels = weeklyStats.days.map((d) => d.dayLabel);
  const episodes = weeklyStats.days.map((d) => d.episodes);
  const hints = weeklyStats.days.map((d) => d.hints);
  const images = weeklyStats.days.map((d) => d.images);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="trending-up" size={14} color={theme.violet} />
          <Text style={styles.headerTitle}>7-Day Trend</Text>
        </View>
        <View style={styles.weekTotalBadge}>
          <Text style={styles.weekTotalText}>
            {weeklyStats.weeklyEpisodes + weeklyStats.weeklyHints + weeklyStats.weeklyImages} actions
          </Text>
        </View>
      </View>

      <View style={styles.chartArea}>
        {/* Day labels */}
        <View style={styles.dayLabelRow}>
          <View style={styles.dayLabelSpacer} />
          <View style={styles.dayLabels}>
            {dayLabels.map((label, i) => (
              <Text key={i} style={styles.dayLabelText}>
                {label}
              </Text>
            ))}
          </View>
        </View>

        {/* Metric rows */}
        <MetricRow
          label="Episodes"
          icon="film"
          color={theme.violet}
          data={episodes}
          maxValue={weeklyStats.maxDaily}
          weeklyTotal={weeklyStats.weeklyEpisodes}
        />
        <MetricRow
          label="Hints"
          icon="chatbubbles"
          color={theme.success}
          data={hints}
          maxValue={weeklyStats.maxDaily}
          weeklyTotal={weeklyStats.weeklyHints}
        />
        <MetricRow
          label="Images"
          icon="image"
          color={theme.accent}
          data={images}
          maxValue={weeklyStats.maxDaily}
          weeklyTotal={weeklyStats.weeklyImages}
        />
      </View>

      <View style={styles.footer}>
        <Ionicons name="information-circle" size={10} color="rgba(167, 139, 250, 0.35)" />
        <Text style={styles.footerText}>
          Rolling 7-day window · bars scaled to max daily activity
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
    borderColor: theme.violetIconBg,
    backgroundColor: "rgba(167, 139, 250, 0.04)",
    overflow: "hidden",
  },
  loadingContainer: {
    padding: 32,
    alignItems: "center",
    borderRadius: 18,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: theme.violetIconBg,
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
    color: theme.violet,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  weekTotalBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: theme.accentAlpha10,
  },
  weekTotalText: {
    color: theme.accent,
    fontSize: 9,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  chartArea: {
    padding: 14,
    gap: 10,
  },
  dayLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  dayLabelSpacer: {
    width: 64,
  },
  dayLabels: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
  },
  dayLabelText: {
    color: "rgba(255, 247, 237, 0.3)",
    fontSize: 8,
    fontWeight: "700",
    width: 30,
    textAlign: "center",
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metricLabel: {
    width: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metricLabelText: {
    fontSize: 9,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  barRow: {
    flex: 1,
    flexDirection: "row",
    gap: 3,
    height: 34,
    alignItems: "flex-end",
  },
  barCol: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    maxWidth: 32,
  },
  barWrapper: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  bar: {
    width: "70%",
    borderRadius: 3,
    borderCurve: "continuous",
    minHeight: 4,
  },
  barValue: {
    color: theme.inkAlpha35,
    fontSize: 8,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    height: 10,
  },
  weeklyTotalText: {
    width: 24,
    fontSize: 12,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    textAlign: "right",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.violetMuted,
  },
  footerText: {
    color: "rgba(167, 139, 250, 0.35)",
    fontSize: 9,
    fontWeight: "600",
  },
});
