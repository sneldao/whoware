import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";
import { theme } from "@/lib/theme";
import styles from "@/app/index.styles";

export interface LastSolveCardProps {
  figureName: string;
  score: number;
  memoriesViewed: number;
  guessesUsed: number;
  onDismiss: () => void;
  formatScore: (n: number) => string;
}

/**
 * Compact card showing the player's last completed solve — appears on
 * the active game screen so returning players can compare to their
 * previous attempt.
 */
export function LastSolveCard({
  figureName, score, memoriesViewed, guessesUsed, onDismiss, formatScore,
}: LastSolveCardProps) {
  return (
    <View style={styles.lastSolveCard}>
      <View style={styles.lastSolveHeader}>
        <Ionicons name="time-outline" size={14} color={theme.accent} />
        <Text style={styles.lastSolveTitle}>Last solve</Text>
        <Pressable onPress={onDismiss} style={styles.lastSolveDismiss}>
          <Ionicons name="close" size={12} color={theme.inkAlpha30} />
        </Pressable>
      </View>
      <Text style={styles.lastSolveFigure}>{figureName}</Text>
      <View style={styles.lastSolveStats}>
        <View style={styles.lastSolveStat}>
          <Text style={styles.lastSolveStatValue}>{formatScore(score)}</Text>
          <Text style={styles.lastSolveStatLabel}>score</Text>
        </View>
        <View style={styles.lastSolveStat}>
          <Text style={styles.lastSolveStatValue}>{memoriesViewed}</Text>
          <Text style={styles.lastSolveStatLabel}>memories</Text>
        </View>
        <View style={styles.lastSolveStat}>
          <Text style={styles.lastSolveStatValue}>{guessesUsed}</Text>
          <Text style={styles.lastSolveStatLabel}>guesses</Text>
        </View>
      </View>
    </View>
  );
}

export interface HistoryCardProps {
  history: Array<{
    _id: string;
    figureName?: string;
    episodeSlug: string;
    startedAt: number;
    score?: number;
    memoriesViewed: number;
    guessesUsed: number;
    status: "solved" | "exhausted" | string;
  }>;
  open: boolean;
  onToggle: () => void;
  formatScore: (n: number) => string;
}

/**
 * Collapsible list of the player's recent runs, rendered below the
 * game surface. Helps returning players see their streak of attempts.
 */
export function HistoryCard({ history, open, onToggle, formatScore }: HistoryCardProps) {
  if (history.length === 0) return null;
  return (
    <View style={styles.historyCard}>
      <Pressable style={styles.historyToggle} onPress={onToggle}>
        <Ionicons name="list-outline" size={14} color={theme.accent} />
        <Text style={styles.historyTitle}>My history ({history.length})</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={theme.inkAlpha30} />
      </Pressable>
      {open && (
        <View style={styles.historyList}>
          {history.map((entry) => (
            <View key={entry._id} style={styles.historyRow}>
              <View style={styles.historyRowLeft}>
                <Text style={styles.historyFigure}>{entry.figureName ?? entry.episodeSlug}</Text>
                <Text style={styles.historyDate}>
                  {new Date(entry.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </Text>
              </View>
              <View style={styles.historyRowRight}>
                {entry.status === "solved" ? (
                  <>
                    <Text style={styles.historyScore}>
                      {entry.score != null ? formatScore(entry.score) : "-"}
                    </Text>
                    <Text style={styles.historyMeta}>
                      {entry.memoriesViewed}m · {entry.guessesUsed}g
                    </Text>
                  </>
                ) : (
                  <Text style={styles.historyExhausted}>Exhausted</Text>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
