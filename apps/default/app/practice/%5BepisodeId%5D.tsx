import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useIdentity } from "@/hooks/use-identity";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "@/lib/theme";
import { FigureRevealCard } from "@/components/who-ware/figure-reveal-card";
import { GuessPanel } from "@/components/who-ware/guess-panel";
import { lazy, Suspense } from "react";

const MemoryScene = lazy(() =>
  import("@/components/who-ware/memory-scene").then((m) => ({ default: m.MemoryScene })),
);

/**
 * Practice mode: replay a closed episode with unlimited guesses, no scoring,
 * no streak impact, and no leaderboard entry. The full episode content is
 * available (all scenes, all clues) since the player already has access
 * via their original run or archive unlock.
 */
export default function PracticeScreen() {
  const { episodeId } = useLocalSearchParams<{ episodeId: string }>();
  const insets = useSafeAreaInsets();
  const { identityId } = useIdentity();

  const episode = useQuery(
    api.archive.getEpisode,
    episodeId && identityId
      ? { episodeId: episodeId as Id<"episodes">, identityId }
      : "skip",
  );

  const practiceRun = useQuery(
    api.practice.getPracticeRun,
    episodeId && identityId
      ? { episodeId: episodeId as Id<"episodes">, identityId }
      : "skip",
  );

  const startRun = useMutation(api.practice.startPracticeRun);
  const enterScene = useMutation(api.practice.practiceEnterScene);
  const submitGuess = useMutation(api.practice.practiceSubmitGuess);

  const figures = useQuery(api.figures.search, { query: "", limit: 10 }) ?? [];

  const [sceneIndex, setSceneIndex] = useState(0);
  const [isStarting, setIsStarting] = useState(false);
  const [guessResult, setGuessResult] = useState<string | null>(null);
  const [showGuessPanel, setShowGuessPanel] = useState(false);

  // Auto-start practice run when episode data is available
  useEffect(() => {
    if (!episodeId || !identityId || !episode || practiceRun !== undefined) return;
    void (async () => {
      setIsStarting(true);
      try {
        await startRun({ episodeId: episodeId as Id<"episodes">, identityId });
      } catch {
        // non-fatal — user can retry
      } finally {
        setIsStarting(false);
      }
    })();
  }, [episodeId, identityId, episode, practiceRun, startRun]);

  const handleGuess = useCallback(
    async (_text: string, figureId: string) => {
      if (!practiceRun || practiceRun.status !== "active") return;
      const result = await submitGuess({
        runId: practiceRun._id,
        figureId: figureId as Id<"figures">,
      });
      if (result.isCorrect) {
        setGuessResult(`Correct! The answer was ${result.answer}.`);
      } else {
        setGuessResult(`Not quite — try again. (${practiceRun.guessesUsed + 1} guesses used)`);
      }
    },
    [practiceRun, submitGuess],
  );

  if (!episodeId) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No episode specified.</Text>
      </View>
    );
  }

  if (!episode || isStarting || practiceRun === undefined) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.accent} />
        <Text style={styles.loadingText}>Opening practice room…</Text>
      </View>
    );
  }

  if (!practiceRun) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>Could not start practice run.</Text>
        <Pressable
          style={styles.retryButton}
          onPress={() => router.back()}
        >
          <Text style={styles.retryText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const isSolved = practiceRun.status === "solved";
  const scenes = episode.scenes;
  const currentScene = scenes[sceneIndex] ?? scenes[0];

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={theme.ink} />
        </Pressable>
        <View style={styles.headerMeta}>
          <Text style={styles.eyebrow}>Practice</Text>
          <Text style={styles.headerTitle}>{episode.figure.canonicalName}</Text>
        </View>
        <View style={styles.practiceBadge}>
          <Ionicons name="school-outline" size={14} color={theme.accent} />
          <Text style={styles.practiceBadgeText}>No score</Text>
        </View>
      </View>

      {isSolved ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}
        >
          <FigureRevealCard
            episodeId={episodeId}
            figureName={episode.figure.canonicalName}
            figureEra={episode.figure.era}
            figureRegion={episode.figure.region}
            figureTags={episode.figure.tags}
          />
          <View style={styles.solvedCard}>
            <Text style={styles.solvedTitle}>Practice complete</Text>
            <Text style={styles.solvedSub}>
              You used {practiceRun.guessesUsed} {practiceRun.guessesUsed === 1 ? "guess" : "guesses"}.
              No score, no streak — just learning.
            </Text>
            <Pressable style={styles.actionButton} onPress={() => router.push("/archive")}>
              <Ionicons name="archive-outline" size={14} color={theme.ink} />
              <Text style={styles.actionText}>Back to archive</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.playRoot}>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
          >
            <View style={styles.sceneRail}>
              {scenes.map((scene, i) => (
                <Pressable
                  key={i}
                  style={[styles.railPill, i === sceneIndex && styles.railPillActive]}
                  onPress={() => {
                    setSceneIndex(i);
                    void enterScene({ runId: practiceRun._id, sceneIndex: i });
                  }}
                >
                  <Text style={[styles.railPillText, i === sceneIndex && styles.railPillTextActive]}>
                    {i + 1}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Suspense fallback={<ActivityIndicator size="large" color={theme.accent} />}>
              <MemoryScene
                scene={currentScene}
                sceneIndex={sceneIndex}
                totalScenes={scenes.length}
                onHotspotOpen={async () => {
                  if (practiceRun.status === "active") {
                    void enterScene({ runId: practiceRun._id, sceneIndex });
                  }
                }}
              />
            </Suspense>

            {guessResult ? (
              <View style={styles.guessResult}>
                <Text style={styles.guessResultText}>{guessResult}</Text>
              </View>
            ) : null}

            {showGuessPanel ? (
              <GuessPanel
                figures={figures.map((f) => ({ figureId: f._id, displayName: f.canonicalName }))}
                guessesLeft={99}
                isSolved={false}
                playerName="Practice"
                onPlayerNameChange={() => {}}
                onSubmit={handleGuess}
              />
            ) : null}
          </ScrollView>

          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
            <Pressable
              style={styles.guessButton}
              onPress={() => setShowGuessPanel((v) => !v)}
            >
              <Ionicons name="finger-print" size={16} color={theme.inkOnAccent} />
              <Text style={styles.guessButtonText}>
                {showGuessPanel ? "Hide guesses" : "Name identity"}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#080502" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#080502" },
  loadingText: { color: theme.inkAlpha60, fontSize: 15, fontWeight: "700" },
  errorText: { color: theme.inkAlpha60, fontSize: 16, fontWeight: "600" },
  retryButton: {
    paddingHorizontal: 18,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: theme.accent,
  },
  retryText: { color: theme.inkOnAccent, fontSize: 14, fontWeight: "900" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.inkAlpha8,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.inkAlpha8,
  },
  headerMeta: { flex: 1, gap: 2 },
  eyebrow: {
    color: theme.accent,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  headerTitle: { color: theme.ink, fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  practiceBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: theme.accentAlpha12,
    borderWidth: 1,
    borderColor: theme.accentAlpha25,
  },
  practiceBadgeText: { color: theme.accent, fontSize: 10, fontWeight: "900" },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16 },
  playRoot: { flex: 1 },
  sceneRail: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  railPill: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.inkAlpha8,
    borderWidth: 1,
    borderColor: theme.inkAlpha12,
  },
  railPillActive: {
    backgroundColor: theme.accent,
    borderColor: theme.accent,
  },
  railPillText: { color: theme.inkAlpha60, fontSize: 14, fontWeight: "800" },
  railPillTextActive: { color: theme.inkOnAccent, fontSize: 14, fontWeight: "900" },
  guessResult: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: theme.inkAlpha8,
    borderWidth: 1,
    borderColor: theme.inkAlpha12,
  },
  guessResultText: { color: theme.inkAlpha84, fontSize: 14, fontWeight: "700" },
  solvedCard: {
    padding: 20,
    gap: 12,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: theme.inkAlpha6,
    borderWidth: 1,
    borderColor: theme.inkAlpha12,
  },
  solvedTitle: { color: theme.ink, fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  solvedSub: { color: theme.inkAlpha60, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: theme.inkAlpha8,
    alignSelf: "flex-start",
  },
  actionText: { color: theme.ink, fontSize: 13, fontWeight: "800" },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "rgba(8, 5, 2, 0.85)",
    borderTopWidth: 1,
    borderTopColor: theme.inkAlpha8,
  },
  guessButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 50,
    borderRadius: 16,
    backgroundColor: theme.accent,
  },
  guessButtonText: { color: theme.inkOnAccent, fontSize: 14, fontWeight: "900" },
});
