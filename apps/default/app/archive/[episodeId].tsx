import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useIdentity } from "@/hooks/use-identity";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";

import { IdentityReveal } from "@/components/who-ware/identity-reveal";
import { Leaderboard } from "@/components/who-ware/leaderboard";
import { ResultShareCard } from "@/components/who-ware/result-share-card";
import { MemoryScene } from "@/components/who-ware/memory-scene";
import { ArchivePaywall } from "@/components/who-ware/archive-paywall";
import { useStreak } from "@/hooks/use-streak";
import { useWallet } from "@/hooks/use-wallet";

export default function ArchiveDetailScreen() {
  const { episodeId } = useLocalSearchParams<{ episodeId: string }>();
  const insets = useSafeAreaInsets();
  const { identityId } = useIdentity();
  const { streak } = useStreak();
  const wallet = useWallet();

  // ALWAYS fetch the summary — no paywall check
  const summary = useQuery(
    api.archive.getArchiveSummary,
    episodeId ? { episodeId: episodeId as Id<"episodes"> } : "skip",
  );
  const run = useQuery(
    api.archive.getRun,
    identityId && episodeId ? { episodeId: episodeId as Id<"episodes">, identityId } : "skip",
  );
  const isUnlocked = useQuery(
    api.paywall.isUnlocked,
    identityId && episodeId ? { identityId, episodeId: episodeId as Id<"episodes"> } : "skip",
  );
  const hasAccess = Boolean(run) || Boolean(isUnlocked);
  // Only fetch full episode content when access is established
  const episode = useQuery(
    api.archive.getEpisode,
    episodeId && hasAccess ? { episodeId: episodeId as Id<"episodes">, identityId: identityId ?? undefined } : "skip",
  );
  const leaderboard = useQuery(
    api.archive.getLeaderboard,
    episodeId && hasAccess ? { episodeId: episodeId as Id<"episodes"> } : "skip",
  );

  const [showReveal, setShowReveal] = useState(false);

  if (!episodeId) {
    return (
      <View style={styles.root}>
        <Text style={styles.errorText}>No episode specified.</Text>
      </View>
    );
  }

  if (summary === undefined) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FBBF24" />
        <Text style={styles.loadingText}>Loading case file…</Text>
      </View>
    );
  }

  if (summary === null) {
    return (
      <View style={styles.root}>
        <Text style={styles.errorText}>Case not found or not yet archived.</Text>
      </View>
    );
  }

  const showPaywall = !hasAccess;
  const episodeNumber = episode ? Math.floor((episode.activeAt - 0) / 86_400_000) + 1 : 0;
  const playerRank = run?.status === "solved" && run.score !== undefined && leaderboard
    ? findPlayerRank(leaderboard.entries, run.score)
    : null;

  return (
    <View style={styles.root}>
      {showReveal && episode?.figure ? (
        <IdentityReveal
          figureName={episode.figure.canonicalName}
          era={episode.figure.era}
          region={episode.figure.region}
          tags={episode.figure.tags}
          imageUrl={episode.scenes[0]?.imageUrl}
          onContinue={() => setShowReveal(false)}
        />
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 28 },
        ]}
      >
        <View style={styles.header}>
          <Pressable style={styles.backButton} href="/archive">
            <Ionicons name="arrow-back" size={20} color="#FFF7ED" />
          </Pressable>
          <View style={styles.headerMeta}>
            <Text style={styles.eyebrow}>Archive</Text>
            <Text style={styles.title}>{summary.figureName}</Text>
            <Text style={styles.subhead}>
              {summary.region} · {summary.era} · {summary.difficulty}
            </Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryName}>{summary.figureName}</Text>
          <View style={styles.tagsRow}>
            {summary.tags.map((tag) => (
              <View key={tag} style={styles.tagPill}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
          {summary.blurb ? <Text style={styles.blurbText}>{summary.blurb}</Text> : null}
          <Text style={styles.sceneCount}>{summary.sceneCount} scenes</Text>
        </View>
        {showPaywall ? (
          <>
            <Text style={styles.hintText}>Unlock the full archive to see all scenes, leaderboard, and rich content.</Text>
            <ArchivePaywall
              episodeId={episodeId as Id<"episodes">}
              figureName={summary.figureName}
              identityId={identityId ?? ""}
              walletAddress={wallet.address}
              onUnlockComplete={() => {}} // isUnlocked query will auto-update
              onConnectWallet={() => wallet.connect()}
            />
          </>
        ) : (
          <>
            {!episode || leaderboard === undefined ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#FBBF24" />
                <Text style={styles.loadingText}>Loading full content…</Text>
              </View>
            ) : (
              <>
                {/* Identity reveal for unlocked players who haven't played */}
                {!run && isUnlocked && (
                  <Pressable style={styles.revealCard} onPress={() => setShowReveal(true)}>
                    <Ionicons name="person" size={20} color="#FBBF24" />
                    <Text style={styles.revealText}>Tap to reveal the identity</Text>
                    <Ionicons name="chevron-forward" size={16} color="#FBBF24" />
                  </Pressable>
                )}
                {run && (
                  <ResultShareCard
                    episodeNumber={episodeNumber}
                    memoriesViewed={run.memoriesViewed}
                    cluesOpened={run.hotspotsOpened}
                    elapsedMs={run.solvedAt ? run.solvedAt - run.startedAt : 0}
                    score={run.score ?? 0}
                    rank={playerRank?.rank ?? null}
                    rankedCount={leaderboard.rankedCount}
                    streak={streak}
                    guessesUsed={run.guessesUsed}
                    hotspotsOpened={run.hotspotsOpened}
                    difficulty={episode.difficulty}
                    figureEra={episode.figure.era}
                    figureRegion={episode.figure.region}
                  />
                )}

                <View style={styles.scenesSection}>
                  <Text style={styles.sectionTitle}>Memory scenes</Text>
                  {episode.scenes
                    .filter((s) => !s.isMercy)
                    .map((scene, i) => (
                      <MemoryScene
                        key={`${scene.title}-${i}`}
                        scene={scene}
                        sceneIndex={i}
                        totalScenes={episode.scenes.filter((s) => !s.isMercy).length}
                      />
                    ))}
                </View>

                <Leaderboard
                  entries={leaderboard.entries}
                  playerRank={playerRank}
                  rankedCount={leaderboard.rankedCount}
                />
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function findPlayerRank(
  entries: Array<{ score: number; playerName: string }>,
  playerScore: number,
) {
  const sorted = [...entries].sort((a, b) => b.score - a.score);
  const idx = sorted.findIndex((e) => e.score === playerScore);
  return idx >= 0 ? { rank: idx + 1, playerName: "", scenesRevealed: 0, score: playerScore, guessedAt: 0 } : null;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#0C0704" },
  scroll: { flex: 1 },
  content: { padding: 22, gap: 18 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, backgroundColor: "#0C0704" },
  loadingText: { color: "#FFF7ED", fontSize: 16, fontWeight: "800" },
  errorText: { color: "rgba(255, 247, 237, 0.6)", fontSize: 16, fontWeight: "600", textAlign: "center", marginTop: 40 },
  header: { gap: 14 },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 247, 237, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.12)",
  },
  headerMeta: { gap: 4 },
  eyebrow: { color: "rgba(251, 191, 36, 0.7)", fontSize: 11, fontWeight: "900", letterSpacing: 1.4, textTransform: "uppercase" },
  title: { color: "#FFF7ED", fontSize: 32, fontWeight: "900", letterSpacing: -0.8 },
  subhead: { color: "rgba(255, 247, 237, 0.6)", fontSize: 14, fontWeight: "700" },
  summaryCard: {
    padding: 18,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.12)",
    gap: 12,
  },
  summaryName: { color: "#FFF7ED", fontSize: 20, fontWeight: "800" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagPill: {
    backgroundColor: "rgba(251, 191, 36, 0.12)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: {
    color: "#FBBF24",
    fontSize: 12,
    fontWeight: "700",
  },
  blurbText: { color: "rgba(255, 247, 237, 0.7)", fontSize: 14, fontWeight: "500", lineHeight: 20 },
  sceneCount: { color: "rgba(255, 247, 237, 0.5)", fontSize: 13, fontWeight: "600" },
  hintText: {
    color: "rgba(255, 247, 237, 0.6)",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 8,
  },
  revealCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.25)",
  },
  revealText: { flex: 1, color: "#FBBF24", fontSize: 15, fontWeight: "800" },
  scenesSection: { gap: 14 },
  sectionTitle: { color: "rgba(255, 247, 237, 0.5)", fontSize: 12, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
});
