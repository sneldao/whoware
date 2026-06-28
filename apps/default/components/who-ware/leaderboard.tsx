import { theme } from "@/lib/theme";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

interface LeaderboardEntry {
  _id: string;
  playerName: string;
  scenesRevealed: number;
  hotspotsOpened?: number;
  guessesUsed?: number;
  elapsedMs?: number;
  score?: number;
  guessedAt: number;
}

interface PlayerRank {
  rank: number;
  playerName: string;
  scenesRevealed: number;
  hotspotsOpened?: number;
  guessesUsed?: number;
  elapsedMs?: number;
  score?: number;
  guessedAt: number;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  playerRank: PlayerRank | null;
  rankedCount: number;
}

export function Leaderboard({ entries, playerRank, rankedCount }: LeaderboardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>Daily standing</Text>
          <Text style={styles.title}>Sharpest awakenings</Text>
        </View>
        <Ionicons name="trophy" size={20} color={theme.accent} />
      </View>

      <View style={styles.playerCard}>
        <Text style={styles.playerLabel}>Your position</Text>
        {playerRank ? (
          <View style={styles.playerRankRow}>
            <Text style={styles.playerRank}>#{playerRank.rank}</Text>
            <View style={styles.playerMetaBlock}>
              <Text style={styles.playerScore}>{formatScore(playerRank.score ?? 0)} pts</Text>
              <Text style={styles.playerMeta}>{formatRunMeta(playerRank)}</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.playerMeta}>Unranked until you name the person correctly.</Text>
        )}
      </View>

      {entries.length === 0 ? (
        <Text style={styles.empty}>No correct awakenings yet. First solve becomes the day’s anchor.</Text>
      ) : (
        entries.slice(0, 5).map((entry, index) => (
          <View key={entry._id} style={styles.row}>
            <Text style={styles.rank}>#{index + 1}</Text>
            <View style={styles.entryText}>
              <Text style={styles.name}>{entry.playerName}</Text>
              <Text style={styles.meta}>{formatRunMeta(entry)}</Text>
            </View>
            <Text style={styles.score}>{formatScore(entry.score ?? 0)}</Text>
          </View>
        ))
      )}

      {rankedCount > entries.length ? <Text style={styles.footer}>{rankedCount} correct identities recorded today.</Text> : null}
    </View>
  );
}

function formatRunMeta(entry: {
  scenesRevealed: number;
  hotspotsOpened?: number;
  guessesUsed?: number;
  elapsedMs?: number;
}): string {
  const hotspotsOpened = entry.hotspotsOpened ?? 0;
  const guessesUsed = entry.guessesUsed ?? 1;
  const elapsedMs = entry.elapsedMs ?? 0;
  const memoryLabel = entry.scenesRevealed === 1 ? "memory" : "memories";
  const clueLabel = hotspotsOpened === 1 ? "clue" : "clues";
  const guessLabel = guessesUsed === 1 ? "guess" : "guesses";
  return `${entry.scenesRevealed} ${memoryLabel} · ${hotspotsOpened} ${clueLabel} · ${guessesUsed} ${guessLabel} · ${formatElapsed(elapsedMs)}`;
}

function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatScore(score: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(score);
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    gap: 12,
    borderRadius: 28,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(248, 231, 201, 0.12)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    color: theme.accent,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: {
    color: theme.ink,
    fontSize: 18,
    fontWeight: "900",
  },
  empty: {
    color: "rgba(255, 247, 237, 0.62)",
    fontSize: 14,
    lineHeight: 21,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  rank: {
    width: 36,
    color: theme.accent,
    fontSize: 15,
    fontWeight: "900",
  },
  entryText: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: theme.ink,
    fontSize: 15,
    fontWeight: "800",
  },
  meta: {
    color: "rgba(255, 247, 237, 0.54)",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
  score: {
    color: theme.accent,
    fontSize: 15,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  playerCard: {
    padding: 14,
    gap: 6,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: theme.accentAlpha10,
    borderWidth: 1,
    borderColor: theme.accentAlpha20,
  },
  playerLabel: {
    color: theme.inkAlpha58,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  playerRankRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  playerRank: {
    color: theme.accent,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: "900",
  },
  playerMetaBlock: {
    flex: 1,
    gap: 1,
  },
  playerScore: {
    color: theme.ink,
    fontSize: 16,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  playerMeta: {
    color: theme.inkAlpha72,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
  },
  footer: {
    color: "rgba(255, 247, 237, 0.44)",
    fontSize: 12,
    fontWeight: "800",
  },
});
