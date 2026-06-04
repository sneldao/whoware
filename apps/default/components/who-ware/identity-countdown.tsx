import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

interface IdentityCountdownProps {
  isSolved: boolean;
  dropsAt: number | null;
  statusLabel?: string;
}

export function IdentityCountdown({ isSolved, dropsAt, statusLabel }: IdentityCountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(intervalId);
  }, []);

  const remaining = useMemo(() => {
    if (!dropsAt) return 0;
    return Math.max(dropsAt - now, 0);
  }, [now, dropsAt]);

  const label = statusLabel ?? (isSolved ? "Next body opens in" : dropsAt ? "Next drop opens in" : "Waiting for the next drop");

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name={isSolved ? "moon" : "hourglass"} size={20} color="#111827" />
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.time}>{dropsAt ? formatRemaining(remaining) : "--:--:--"}</Text>
      </View>
    </View>
  );
}

function formatRemaining(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 22,
    borderCurve: "continuous",
    backgroundColor: "rgba(251, 191, 36, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.24)",
  },
  iconWrap: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    borderCurve: "continuous",
    backgroundColor: "#FBBF24",
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: "rgba(255, 247, 237, 0.58)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  time: {
    color: "#FFF7ED",
    fontSize: 22,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    letterSpacing: 1.4,
  },
});
