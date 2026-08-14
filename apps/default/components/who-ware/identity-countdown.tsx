import { theme } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

interface IdentityCountdownProps {
  isSolved: boolean;
  dropsAt: number | null;
  statusLabel?: string;
  /** Spoiler-free "Tomorrow's room" teaser (era · region). */
  teaser?: string;
  onRemindMe?: () => void;
  isReminded?: boolean;
}

export function IdentityCountdown({ isSolved, dropsAt, statusLabel, teaser, onRemindMe, isReminded }: IdentityCountdownProps) {
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
        <Ionicons name={isSolved ? "moon" : "hourglass"} size={20} color={theme.inkOnAccent} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.time}>{dropsAt ? formatRemaining(remaining) : "--:--:--"}</Text>
        {teaser ? (
          <Text style={styles.teaser}>Tomorrow's room: {teaser}</Text>
        ) : null}
      </View>
      {onRemindMe ? (
        <Pressable
          onPress={onRemindMe}
          style={({ pressed }) => [
            styles.remindBtn,
            isReminded && styles.remindBtnActive,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons
            name={isReminded ? "notifications" : "notifications-outline"}
            size={14}
            color={isReminded ? theme.accent : theme.inkAlpha70}
          />
          <Text style={[styles.remindText, isReminded && styles.remindTextActive]}>
            {isReminded ? "Alert set" : "Remind me"}
          </Text>
        </Pressable>
      ) : null}
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
    backgroundColor: theme.accentAlpha12,
    borderWidth: 1,
    borderColor: theme.accentAlpha24,
  },
  iconWrap: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    borderCurve: "continuous",
    backgroundColor: theme.accent,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  label: {
    color: theme.inkAlpha58,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  time: {
    color: theme.ink,
    fontSize: 22,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    letterSpacing: 1.4,
  },
  teaser: {
    color: theme.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  remindBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255, 240, 214, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 240, 214, 0.14)",
  },
  remindBtnActive: {
    backgroundColor: theme.accentAlpha18,
    borderColor: theme.accentAlpha35,
  },
  remindText: {
    color: theme.inkAlpha80,
    fontSize: 12,
    fontWeight: "800",
  },
  remindTextActive: {
    color: theme.accent,
  },
  pressed: {
    opacity: 0.72,
  },
});
