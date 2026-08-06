import { theme } from "@/lib/theme";
import { api } from "@/convex/_generated/api";
import { useIdentity } from "@/hooks/use-identity";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Weekly recap: a Sunday summary of the past week's figures with a
 * "how well do you know them?" mini-quiz. Turns daily sessions
 * into a weekly habit.
 */
export default function WeeklyRecapScreen() {
  const insets = useSafeAreaInsets();
  const { identityId } = useIdentity();
  const recap = useQuery(api.analytics.getWeeklyRecap, identityId ? { identityId } : {});

  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);

  if (!recap) {
    return (
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]}
        >
          <Text style={styles.title}>Weekly Recap</Text>
          <Text style={styles.loadingText}>Loading your week...</Text>
        </ScrollView>
      </View>
    );
  }

  if (recap.figures.length === 0) {
    return (
      <View style={styles.root}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 18 }]}
        >
          <Text style={styles.eyebrow}>Weekly Recap</Text>
          <Text style={styles.title}>No episodes yet</Text>
          <Text style={styles.subhead}>
            Check back after a few daily episodes have closed. Your weekly
            summary will appear here every Sunday.
          </Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Back to today</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  const quizFigures = recap.figures.filter((f) => f.playerSolved).slice(0, 5);
  const quizScore = quizFigures.filter((f) => quizAnswers[f.figureName] === "correct").length;

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 28 },
        ]}
      >
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.ink} />
        </Pressable>

        <Text style={styles.eyebrow}>Weekly Recap</Text>
        <Text style={styles.title}>Your week in history</Text>

        {/* Summary stats */}
        <View style={styles.summaryRow}>
          <SummaryStat label="Solved" value={`${recap.totalSolved}/${recap.totalAttempted}`} />
          <SummaryStat label="Best score" value={recap.bestScore ? recap.bestScore.toLocaleString() : "—"} />
          <SummaryStat label="Streak" value={`${recap.currentStreak}`} />
        </View>

        {/* Figure cards */}
        <Text style={styles.sectionTitle}>This week's figures</Text>
        <View style={styles.figuresList}>
          {recap.figures.map((fig) => (
            <View key={fig.episodeId} style={styles.figureCard}>
              <View style={styles.figureHeader}>
                {fig.playerSolved ? (
                  <Ionicons name="checkmark-circle" size={16} color={theme.success} />
                ) : (
                  <Ionicons name="close-circle" size={16} color={theme.inkAlpha40} />
                )}
                <Text style={styles.figureName}>{fig.figureName}</Text>
                <View style={styles.diffBadge}>
                  <Text style={styles.diffBadgeText}>{fig.difficulty}</Text>
                </View>
              </View>
              <Text style={styles.figureMeta}>
                {fig.era} · {fig.region}
              </Text>
              <View style={styles.tagRow}>
                {fig.tags.slice(0, 4).map((tag) => (
                  <View key={tag} style={styles.tagPill}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
              {fig.playerSolved && fig.playerScore ? (
                <Text style={styles.scoreText}>
                  Score: {fig.playerScore.toLocaleString()} pts
                </Text>
              ) : null}
            </View>
          ))}
        </View>

        {/* Mini-quiz */}
        {quizFigures.length >= 2 && !showResults ? (
          <View style={styles.quizCard}>
            <Text style={styles.quizTitle}>How well do you know them?</Text>
            <Text style={styles.quizSubhead}>
              Figure {quizIndex + 1} of {quizFigures.length}
            </Text>
            <Text style={styles.quizQuestion}>
              What era was {quizFigures[quizIndex].figureName} from?
            </Text>
            <View style={styles.quizOptions}>
              {getUniqueEras(quizFigures, quizIndex).map((era) => (
                <Pressable
                  key={era}
                  style={({ pressed }) => [
                    styles.quizOption,
                    quizAnswers[quizFigures[quizIndex].figureName] === era && styles.quizOptionSelected,
                    pressed && styles.pressed,
                  ]}
                  onPress={() => {
                    const correct = era === quizFigures[quizIndex].era;
                    setQuizAnswers({
                      ...quizAnswers,
                      [quizFigures[quizIndex].figureName]: correct ? "correct" : era,
                    });
                    if (quizIndex < quizFigures.length - 1) {
                      setTimeout(() => setQuizIndex(quizIndex + 1), 600);
                    } else {
                      setTimeout(() => setShowResults(true), 600);
                    }
                  }}
                >
                  <Text style={styles.quizOptionText}>{era}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : showResults ? (
          <View style={styles.quizCard}>
            <Text style={styles.quizTitle}>Quiz results</Text>
            <Text style={styles.quizScoreText}>
              {quizScore} / {quizFigures.length} correct
            </Text>
            <Text style={styles.quizSubhead}>
              {quizScore === quizFigures.length
                ? "Perfect — you know your history!"
                : quizScore >= quizFigures.length / 2
                  ? "Solid week — keep the streak going."
                  : "The archive is open for practice."}
            </Text>
            <Pressable style={styles.quizRetryButton} onPress={() => {
              setQuizAnswers({});
              setQuizIndex(0);
              setShowResults(false);
            }}>
              <Text style={styles.quizRetryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable style={styles.archiveLink} href="/archive">
          <Ionicons name="archive-outline" size={14} color={theme.accent} />
          <Text style={styles.archiveLinkText}>Practice in the archive</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function getUniqueEras(figures: Array<{ era: string }>, currentIndex: number): string[] {
  const correctEra = figures[currentIndex].era;
  const otherEras = figures
    .filter((_, i) => i !== currentIndex)
    .map((f) => f.era)
    .filter((e) => e !== correctEra);
  const unique = Array.from(new Set([correctEra, ...otherEras])).slice(0, 4);
  // Shuffle
  for (let i = unique.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [unique[i], unique[j]] = [unique[j], unique[i]];
  }
  return unique;
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryStat}>
      <Text style={styles.summaryStatValue}>{value}</Text>
      <Text style={styles.summaryStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0C0704" },
  scroll: { flex: 1 },
  content: { padding: 22, gap: 18 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.inkAlpha8,
    borderWidth: 1,
    borderColor: theme.inkAlpha12,
    alignSelf: "flex-start",
    marginBottom: 4,
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
    lineHeight: 20,
  },
  loadingText: {
    color: theme.inkAlpha50,
    fontSize: 14,
    fontWeight: "600",
  },
  summaryRow: {
    flexDirection: "row",
    gap: 8,
  },
  summaryStat: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    backgroundColor: theme.inkAlpha6,
    borderWidth: 1,
    borderColor: theme.inkAlpha8,
    alignItems: "center",
    gap: 2,
  },
  summaryStatValue: {
    color: theme.ink,
    fontSize: 20,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  summaryStatLabel: {
    color: theme.inkAlpha50,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  sectionTitle: {
    color: theme.inkAlpha50,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  figuresList: { gap: 12 },
  figureCard: {
    padding: 18,
    gap: 8,
    borderRadius: 20,
    backgroundColor: theme.inkAlpha4,
    borderWidth: 1,
    borderColor: theme.inkAlpha8,
  },
  figureHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  figureName: {
    flex: 1,
    color: theme.ink,
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  diffBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: theme.accentAlpha12,
  },
  diffBadgeText: {
    color: theme.accent,
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  figureMeta: {
    color: theme.inkAlpha60,
    fontSize: 13,
    fontWeight: "600",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: theme.inkAlpha8,
  },
  tagText: {
    color: theme.inkAlpha70,
    fontSize: 11,
    fontWeight: "700",
  },
  scoreText: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  quizCard: {
    padding: 20,
    gap: 12,
    borderRadius: 24,
    backgroundColor: theme.inkAlpha6,
    borderWidth: 1,
    borderColor: theme.accentAlpha25,
  },
  quizTitle: {
    color: theme.ink,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  quizSubhead: {
    color: theme.inkAlpha50,
    fontSize: 12,
    fontWeight: "700",
  },
  quizQuestion: {
    color: theme.ink,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  quizOptions: { gap: 8 },
  quizOption: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: theme.inkAlpha8,
    borderWidth: 1,
    borderColor: theme.inkAlpha12,
  },
  quizOptionSelected: {
    backgroundColor: theme.accentAlpha15,
    borderColor: theme.accent,
  },
  quizOptionText: {
    color: theme.ink,
    fontSize: 14,
    fontWeight: "700",
  },
  quizScoreText: {
    color: theme.accent,
    fontSize: 32,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  quizRetryButton: {
    padding: 12,
    borderRadius: 16,
    backgroundColor: theme.accentAlpha12,
    borderWidth: 1,
    borderColor: theme.accentAlpha25,
    alignItems: "center",
  },
  quizRetryText: {
    color: theme.accent,
    fontSize: 14,
    fontWeight: "800",
  },
  archiveLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: theme.inkAlpha4,
    borderWidth: 1,
    borderColor: theme.inkAlpha8,
  },
  archiveLinkText: {
    color: theme.accent,
    fontSize: 14,
    fontWeight: "800",
  },
  pressed: { opacity: 0.7 },
});
