import { useEffect, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";

interface ScoreTrajectoryProps {
  currentScore: number | null;
  maxPotential: number;
  label: string;
}

export function ScoreTrajectory({ currentScore, maxPotential, label }: ScoreTrajectoryProps) {
  const prevScore = useRef(currentScore);
  const barWidth = useSharedValue(currentScore && maxPotential > 0 ? currentScore / maxPotential : 0);

  useEffect(() => {
    if (currentScore && maxPotential > 0) {
      barWidth.value = withTiming(currentScore / maxPotential, {
        duration: 600,
        easing: Easing.out(Easing.ease),
      });
    }
    prevScore.current = currentScore;
  }, [currentScore, maxPotential, barWidth]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${Math.max(0, Math.min(1, barWidth.value)) * 100}%`,
  }));

  if (!currentScore && maxPotential <= 0) return null;

  const ratio = currentScore && maxPotential > 0 ? (currentScore / maxPotential) * 100 : 0;
  const isHighRatio = ratio > 75;
  const isMidRatio = ratio > 45;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.valueRow}>
          <Text style={[styles.value, isHighRatio && styles.valueHigh]}>
            {currentScore ? formatScoreNum(currentScore) : "—"}
          </Text>
          {maxPotential > 0 ? (
            <>
              <Text style={styles.separator}>/</Text>
              <Text style={styles.max}>{formatScoreNum(maxPotential)}</Text>
            </>
          ) : null}
        </View>
      </View>
      <View style={styles.trackOuter}>
        <View style={styles.track}>
          <Animated.View style={[styles.fill, barStyle, isHighRatio && styles.fillHigh, isMidRatio && !isHighRatio && styles.fillMid]} />
        </View>
        {currentScore && maxPotential > 0 ? (
          <Text style={[styles.percentile, isHighRatio && styles.percentileHigh]}>
            {Math.round(ratio)}%
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function formatScoreNum(score: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(score);
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    padding: 12,
    borderRadius: 16,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.08)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  label: {
    color: "rgba(255, 247, 237, 0.58)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  value: {
    color: "#FBBF24",
    fontSize: 15,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  valueHigh: {
    color: "#22C55E",
  },
  separator: {
    color: "rgba(255, 247, 237, 0.25)",
    fontSize: 13,
    fontWeight: "900",
    marginHorizontal: 1,
  },
  max: {
    color: "rgba(255, 247, 237, 0.45)",
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  trackOuter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  track: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 247, 237, 0.08)",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: "#FBBF24",
  },
  fillMid: {
    backgroundColor: "#86EFAC",
  },
  fillHigh: {
    backgroundColor: "#22C55E",
  },
  percentile: {
    color: "rgba(255, 247, 237, 0.4)",
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    minWidth: 32,
    textAlign: "right",
  },
  percentileHigh: {
    color: "#22C55E",
  },
});
