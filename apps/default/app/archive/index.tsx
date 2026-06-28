import { theme } from "@/lib/theme";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useIdentity } from "@/hooks/use-identity";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { Link } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ArchiveScreen() {
  const insets = useSafeAreaInsets();
  const closed = useQuery(api.archive.listClosed, {}) ?? [];
  const { identityId } = useIdentity();

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 28 }]}
      >
        <Text style={styles.eyebrow}>Archive</Text>
        <Text style={styles.title}>Closed cases</Text>
        <Text style={styles.subhead}>
          Past investigations. Identities revealed. Your results preserved.
        </Text>

        {closed.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="lock-closed" size={32} color={theme.accentAlpha50} />
            <Text style={styles.emptyText}>No cases have closed yet.</Text>
            <Text style={styles.emptySub}>Archived episodes appear here after the daily window ends.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {closed.map((episode) => (
              <ArchiveRow
                key={episode._id}
                episodeId={episode._id}
                slug={episode.slug}
                figureName={episode.figureName}
                difficulty={episode.difficulty}
                activeAt={episode.activeAt}
                identityId={identityId}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

interface ArchiveRowProps {
  episodeId: Id<"episodes">;
  slug: string;
  figureName: string;
  difficulty: "iconic" | "field" | "research";
  activeAt: number;
  identityId: string;
}

function ArchiveRow({ episodeId, figureName, difficulty, activeAt, identityId }: ArchiveRowProps) {
  const run = useQuery(
    api.archive.getRun,
    identityId ? { episodeId, identityId } : "skip",
  );
  const isUnlocked = useQuery(
    api.paywall.isUnlocked,
    identityId ? { identityId, episodeId } : "skip",
  );

  const dateLabel = new Date(activeAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const isLocked = !run && !isUnlocked;

  return (
    <Link href={`/archive/${episodeId}`} asChild>
      <View style={styles.row}>
        <View style={styles.rowHeader}>
          {isLocked ? (
            <Ionicons name="lock-closed" size={14} color={theme.accentAlpha50} />
          ) : null}
          <Text style={styles.figureName}>{figureName}</Text>
          <DifficultyBadge difficulty={difficulty} />
        </View>
        <Text style={styles.date}>{dateLabel}</Text>
        {run ? (
          <View style={styles.resultRow}>
            <Ionicons
              name={run.status === "solved" ? "checkmark-circle" : "close-circle"}
              size={14}
              color={run.status === "solved" ? theme.accent : theme.inkAlpha50}
            />
            <Text style={styles.resultText}>
              {run.status === "solved" ? `Solved · ${formatScore(run.score ?? 0)} pts` : "Unsolved"}
            </Text>
          </View>
        ) : isLocked ? (
          <View style={styles.lockedRow}>
            <Text style={styles.lockedText}>1 USDC to unlock</Text>
          </View>
        ) : (
          <Text style={styles.noRun}>Not played</Text>
        )}
      </View>
    </Link>
  );
}

function DifficultyBadge({ difficulty }: { difficulty: "iconic" | "field" | "research" }) {
  const palette: Record<string, { bg: string; fg: string }> = {
    iconic: { bg: theme.accentAlpha20, fg: theme.accent },
    field: { bg: "rgba(134, 239, 172, 0.18)", fg: "#86EFAC" },
    research: { bg: "rgba(147, 197, 253, 0.18)", fg: "#93C5FD" },
  };
  const colors = palette[difficulty] ?? palette.iconic;
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }]}>
      <Text style={[styles.badgeText, { color: colors.fg }]}>{difficulty}</Text>
    </View>
  );
}

function formatScore(score: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(score);
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0C0704",
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 22,
    gap: 14,
  },
  eyebrow: {
    color: theme.accentAlpha70,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    color: theme.ink,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  subhead: {
    color: theme.inkAlpha60,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  list: {
    gap: 12,
    marginTop: 6,
  },
  row: {
    padding: 18,
    gap: 6,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: theme.inkAlpha4,
    borderWidth: 1,
    borderColor: theme.inkAlpha8,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  figureName: {
    flex: 1,
    color: theme.ink,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  date: {
    color: theme.inkAlpha50,
    fontSize: 12,
    fontWeight: "700",
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  resultText: {
    color: theme.ink,
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  noRun: {
    color: theme.inkAlpha40,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  lockedText: {
    color: theme.accent,
    fontSize: 12,
    fontWeight: "800",
  },
  emptyState: {
    padding: 28,
    gap: 10,
    alignItems: "center",
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: theme.inkAlpha3,
    borderWidth: 1,
    borderColor: theme.inkAlpha8,
  },
  emptyText: {
    color: theme.ink,
    fontSize: 16,
    fontWeight: "800",
  },
  emptySub: {
    color: theme.inkAlpha50,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
  },
});
