import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { theme } from "@/lib/theme";

export interface GuessAttempt {
  figureName: string;
  isCorrect: boolean;
  /** Era match — kept for closest-call computation in app/index.tsx. */
  eraMatch: boolean;
  /** Region match — kept for closest-call computation in app/index.tsx. */
  regionMatch: boolean;
  /** Field match — kept for closest-call computation in app/index.tsx. */
  fieldMatch: boolean;
  /** Prose feedback authored server-side (scoring.proximityMessage). */
  message?: string;
}

interface DeductionBoardProps {
  attempts: GuessAttempt[];
  maxGuesses?: number;
}

export function DeductionBoard({ attempts, maxGuesses = 8 }: DeductionBoardProps) {
  if (!attempts || attempts.length === 0) return null;

  return (
    <View style={styles.board}>
      <View style={styles.header}>
        <Ionicons name="git-network-outline" size={13} color={theme.accent} />
        <Text style={styles.headerTitle}>Guesses</Text>
        <Text style={styles.headerCount}>{attempts.length}/{maxGuesses}</Text>
      </View>

      <View style={styles.list}>
        {attempts.map((att, idx) => (
          <View key={idx} style={[styles.row, att.isCorrect && styles.rowCorrect]}>
            <View style={styles.nameRow}>
              <Ionicons
                name={att.isCorrect ? "checkmark-circle" : "close-circle"}
                size={14}
                color={att.isCorrect ? theme.success : theme.dangerText}
              />
              <Text style={[styles.nameText, att.isCorrect && styles.nameTextCorrect]} numberOfLines={1}>
                {att.figureName}
              </Text>
            </View>
            {/* The room's answer, kept — prose reads faster than three badges. */}
            {att.message ? (
              <Text
                style={[styles.proximityLine, att.isCorrect && styles.proximityLineCorrect]}
                numberOfLines={3}
              >
                {att.message}
              </Text>
            ) : null}
          </View>
        ))}
      </View>
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
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: "rgba(255, 240, 214, 0.04)",
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  proximityLine: {
    color: theme.inkAlpha60,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 17,
    paddingLeft: 22,
    paddingTop: 2,
  },
  proximityLineCorrect: {
    color: theme.success,
    fontStyle: "italic",
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
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nameText: {
    color: theme.ink,
    fontSize: 13,
    fontWeight: "800",
  },
  nameTextCorrect: {
    color: theme.success,
  },
});
