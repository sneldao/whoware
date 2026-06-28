import { theme } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

interface StreakBannerProps {
  current: number;
  best: number;
  /** True when today's episode has been solved (streak is "live"). */
  solvedToday: boolean;
}

/**
 * Compact streak indicator for the hero. Reinforces the daily-return ritual:
 * a lit flame when the streak is alive, a dimmed ember prompting a comeback
 * when it is at risk.
 */
export function StreakBanner({ current, best, solvedToday }: StreakBannerProps) {
  const isLive = current > 0;
  const flameColor = solvedToday ? "#FB923C" : isLive ? theme.goldGradientEnd : theme.inkAlpha40;
  const headline = isLive
    ? solvedToday
      ? `${current}-day streak — secured today`
      : `${current}-day streak — keep it alive`
    : "Start a daily streak today";

  return (
    <Animated.View entering={FadeInDown.duration(420)} style={styles.container}>
      <View style={[styles.flameWrap, solvedToday && styles.flameWrapLive]}>
        <Ionicons name="flame" size={20} color={flameColor} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.sub}>
          {best > 0 ? `Best run ${best} ${best === 1 ? "day" : "days"}` : "Solve daily to build a run"}
        </Text>
      </View>
      {current > 0 ? (
        <View style={styles.countPill}>
          <Text style={styles.countValue}>{current}</Text>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(251, 146, 60, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(251, 146, 60, 0.22)",
  },
  flameWrap: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: theme.inkAlpha6,
  },
  flameWrapLive: {
    backgroundColor: "rgba(251, 146, 60, 0.2)",
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  headline: {
    color: theme.ink,
    fontSize: 14,
    fontWeight: "900",
  },
  sub: {
    color: theme.inkAlpha55,
    fontSize: 12,
    fontWeight: "700",
  },
  countPill: {
    minWidth: 34,
    height: 34,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderCurve: "continuous",
    backgroundColor: "#FB923C",
  },
  countValue: {
    color: theme.inkInverted,
    fontSize: 16,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
});
