import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/lib/theme";

export interface GuessAttempt {
  figureName: string;
  isCorrect: boolean;
  eraMatch: boolean;
  regionMatch: boolean;
  fieldMatch: boolean;
  message?: string;
}

interface DeductionBoardProps {
  attempts: GuessAttempt[];
  maxGuesses?: number;
}

export function DeductionBoard({ attempts, maxGuesses = 5 }: DeductionBoardProps) {
  if (!attempts || attempts.length === 0) return null;

  return (
    <View style={styles.board}>
      <View style={styles.header}>
        <Ionicons name="git-network-outline" size={13} color={theme.accent} />
        <Text style={styles.headerTitle}>Deduction log</Text>
        <Text style={styles.headerCount}>{attempts.length}/{maxGuesses}</Text>
      </View>

      <View style={styles.list}>
        {attempts.map((att, idx) => (
          <View key={idx} style={[styles.row, att.isCorrect && styles.rowCorrect]}>
            <View style={styles.nameCol}>
              <Ionicons
                name={att.isCorrect ? "checkmark-circle" : "close-circle"}
                size={14}
                color={att.isCorrect ? theme.success : theme.dangerText}
              />
              <Text style={[styles.nameText, att.isCorrect && styles.nameTextCorrect]} numberOfLines={1}>
                {att.figureName}
              </Text>
            </View>

            <View style={styles.badgesCol}>
              <Badge label="Era" match={att.eraMatch} />
              <Badge label="Region" match={att.regionMatch} />
              <Badge label="Field" match={att.fieldMatch} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function Badge({ label, match }: { label: string; match: boolean }) {
  return (
    <View style={[styles.badge, match ? styles.badgeMatch : styles.badgeMiss]}>
      <Text style={[styles.badgeText, match ? styles.badgeTextMatch : styles.badgeTextMiss]}>
        {label} {match ? "✓" : "✗"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    padding: 12,
    gap: 8,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(8, 5, 2, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 240, 214, 0.12)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 240, 214, 0.08)",
  },
  headerTitle: {
    flex: 1,
    color: theme.inkAlpha70,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  headerCount: {
    color: theme.accentAlpha70,
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  list: {
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255, 240, 214, 0.04)",
  },
  rowCorrect: {
    backgroundColor: "rgba(134, 239, 172, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(134, 239, 172, 0.3)",
  },
  nameCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingRight: 8,
  },
  nameText: {
    color: theme.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  nameTextCorrect: {
    color: theme.success,
  },
  badgesCol: {
    flexDirection: "row",
    gap: 4,
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeMatch: {
    backgroundColor: "rgba(134, 239, 172, 0.18)",
    borderWidth: 1,
    borderColor: "rgba(134, 239, 172, 0.35)",
  },
  badgeMiss: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  badgeTextMatch: {
    color: "#86EFAC",
  },
  badgeTextMiss: {
    color: "#FCA5A5",
  },
});
