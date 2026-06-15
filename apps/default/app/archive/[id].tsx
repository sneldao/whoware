import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useIdentity } from "@/hooks/use-identity";
import { useWallet } from "@/hooks/use-wallet";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PanoramaScene } from "@/components/who-ware/panorama-scene";
import { ResultShareCard } from "@/components/who-ware/result-share-card";
import { ArchivePaywall } from "@/components/who-ware/archive-paywall";

export default function ArchiveDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const episodeId = id as Id<"episodes">;
  const episode = useQuery(
    api.archive.getEpisode,
    identityId ? { episodeId, identityId } : { episodeId },
  );
  const leaderboard = useQuery(api.archive.getLeaderboard, { episodeId });
  const { identityId } = useIdentity();
  const wallet = useWallet();
  const run = useQuery(
    api.archive.getRun,
    identityId ? { episodeId, identityId } : "skip",
  );
  const isUnlocked = useQuery(
    api.paywall.isUnlocked,
    identityId ? { identityId, episodeId } : "skip",
  );
  const [unlockedLocally, setUnlockedLocally] = useState(false);

  const hasAccess = !!run || isUnlocked || unlockedLocally;

  if (!episode) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.loading}>Opening the archive…</Text>
      </View>
    );
  }

  if (!hasAccess && identityId) {
    return (
      <View style={styles.root}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 28 }]}
        >
          <View style={styles.backRow}>
            <Ionicons name="arrow-back" size={18} color="rgba(251, 191, 36, 0.9)" />
            <Text style={styles.backLabel}>Archive</Text>
          </View>
          <ArchivePaywall
            episodeId={episodeId}
            figureName={episode.figureName ?? "Unknown"}
            identityId={identityId}
            walletAddress={wallet.address}
            onUnlockComplete={() => setUnlockedLocally(true)}
          />
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 28 }]}
      >
        <View style={styles.backRow}>
          <Ionicons name="arrow-back" size={18} color="rgba(251, 191, 36, 0.9)" />
          <Text style={styles.backLabel}>Archive</Text>
        </View>

        <Text style={styles.figureName}>{episode.figure.canonicalName}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{episode.figure.era}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.meta}>{episode.figure.region}</Text>
        </View>
        {episode.figure.tags.length > 0 ? (
          <View style={styles.tagRow}>
            {episode.figure.tags.slice(0, 4).map((tag) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>Memory sequence</Text>
        <View style={styles.sceneList}>
          {episode.scenes.map((scene, index) => (
            <View key={index} style={styles.sceneCard}>
              <View style={styles.sceneHeader}>
                <Text style={styles.sceneIndex}>#{index + 1}</Text>
                <Text style={styles.sceneTitle}>{scene.title}</Text>
              </View>
              <PanoramaScene
                scene={scene}
                sceneIndex={index}
                totalScenes={episode.scenes.length}
              />
              <Text style={styles.sceneLocation}>{scene.location} · {scene.era}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Final leaderboard</Text>
        {leaderboard && leaderboard.entries.length > 0 ? (
          <View style={styles.leaderboard}>
            {leaderboard.entries.slice(0, 10).map((entry, index) => (
              <View key={entry._id} style={styles.leaderRow}>
                <Text style={styles.leaderRank}>{index + 1}</Text>
                <Text style={styles.leaderName} numberOfLines={1}>{entry.playerName}</Text>
                <Text style={styles.leaderScore}>{formatScore(entry.score)} pts</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>No solves recorded for this episode.</Text>
        )}

        {run && run.status === "solved" ? (
          <View style={styles.shareSection}>
            <Text style={styles.sectionLabel}>Your result</Text>
            <ResultShareCard
              episodeNumber={episodeNumberFromSlug(episode.slug)}
              memoriesViewed={run.memoriesViewed}
              cluesOpened={run.hotspotsOpened}
              elapsedMs={(run.solvedAt ?? run.startedAt) - run.startedAt}
              score={run.score ?? 0}
              rank={null}
              rankedCount={leaderboard?.rankedCount ?? 0}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

function episodeNumberFromSlug(slug: string): number {
  const match = slug.match(/\d+/);
  return match ? parseInt(match[0], 10) : 1;
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
  loading: {
    color: "rgba(255, 247, 237, 0.6)",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    padding: 24,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  backLabel: {
    color: "rgba(251, 191, 36, 0.9)",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  figureName: {
    color: "#FFF7ED",
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  meta: {
    color: "rgba(255, 247, 237, 0.7)",
    fontSize: 14,
    fontWeight: "700",
  },
  metaDot: {
    color: "rgba(255, 247, 237, 0.4)",
    fontSize: 14,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(251, 191, 36, 0.12)",
  },
  tagText: {
    color: "#FBBF24",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  sectionLabel: {
    color: "rgba(255, 247, 237, 0.55)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginTop: 14,
  },
  sceneList: {
    gap: 14,
  },
  sceneCard: {
    gap: 8,
    padding: 14,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.03)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.08)",
  },
  sceneHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sceneIndex: {
    color: "rgba(251, 191, 36, 0.9)",
    fontSize: 12,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  sceneTitle: {
    flex: 1,
    color: "#FFF7ED",
    fontSize: 15,
    fontWeight: "800",
  },
  sceneLocation: {
    color: "rgba(255, 247, 237, 0.5)",
    fontSize: 12,
    fontWeight: "700",
  },
  leaderboard: {
    gap: 4,
    padding: 12,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.08)",
  },
  leaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  leaderRank: {
    color: "rgba(251, 191, 36, 0.9)",
    fontSize: 12,
    fontWeight: "900",
    width: 20,
    fontVariant: ["tabular-nums"],
  },
  leaderName: {
    flex: 1,
    color: "#FFF7ED",
    fontSize: 14,
    fontWeight: "700",
  },
  leaderScore: {
    color: "rgba(255, 247, 237, 0.7)",
    fontSize: 13,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  emptyText: {
    color: "rgba(255, 247, 237, 0.5)",
    fontSize: 13,
    fontWeight: "700",
  },
  shareSection: {
    marginTop: 18,
    gap: 10,
  },
});
