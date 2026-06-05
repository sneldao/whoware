import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EpisodeCard } from "@/components/curator/episode-card";
import { GenerateForm } from "@/components/curator/generate-form";

export default function CuratorScreen() {
  const insets = useSafeAreaInsets();
  const queue = useQuery(api.catalog.getStagingQueue, {});
  const figures = useQuery(api.figures.listAll, {}) ?? [];
  const [expandedEpisodeId, setExpandedEpisodeId] = useState<Id<"episodes"> | null>(null);

  const approveEpisode = useMutation(api.catalog.approveEpisode);
  const regenerateScene = useAction(api.catalog.regenerateScene);
  const generateEpisode = useAction(api.catalog.generateEpisode);

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [regeneratingScenes, setRegeneratingScenes] = useState<Map<string, Set<number>>>(new Map());
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const episodeDetail = useQuery(
    api.catalog.getEpisodeDetail,
    expandedEpisodeId ? { episodeId: expandedEpisodeId } : "skip",
  );

  const handleApprove = useCallback(async (episodeId: Id<"episodes">) => {
    setApprovingId(episodeId);
    setError(null);
    try {
      await approveEpisode({ episodeId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to approve episode");
    } finally {
      setApprovingId(null);
    }
  }, [approveEpisode]);

  const handleRegenerateScene = useCallback(async (episodeId: Id<"episodes">, sceneIndex: number) => {
    const key = episodeId;
    setRegeneratingScenes((prev) => {
      const next = new Map(prev);
      const current = next.get(key) ?? new Set();
      current.add(sceneIndex);
      next.set(key, current);
      return next;
    });
    setError(null);
    try {
      await regenerateScene({ episodeId, sceneIndex });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to regenerate scene");
    } finally {
      setRegeneratingScenes((prev) => {
        const next = new Map(prev);
        const current = next.get(key) ?? new Set();
        current.delete(sceneIndex);
        next.set(key, current);
        return next;
      });
    }
  }, [regenerateScene]);

  const handleGenerate = useCallback(async (figureId: string, slug: string) => {
    setIsGenerating(true);
    setError(null);
    try {
      await generateEpisode({ figureId: figureId as Id<"figures">, slug });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to generate episode");
    } finally {
      setIsGenerating(false);
    }
  }, [generateEpisode]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 }]}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Curator Dashboard</Text>
          <Text style={styles.subtitle}>Review and approve AI-generated episodes</Text>
        </View>
        <Pressable style={styles.backButton} href="/">
          <Ionicons name="arrow-back" size={20} color="#94a3b8" />
        </Pressable>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color="#fca5a5" />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => setError(null)}>
            <Ionicons name="close" size={16} color="#fca5a5" />
          </Pressable>
        </View>
      )}

      <GenerateForm
        figures={figures.map((f) => ({
          _id: f._id,
          canonicalName: f.canonicalName,
          era: f.era,
          region: f.region,
        }))}
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Staging Queue ({queue?.length ?? 0})</Text>
        {!queue && <ActivityIndicator size="small" color="#94a3b8" />}
        {queue && queue.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={40} color="#475569" />
            <Text style={styles.emptyText}>No episodes in staging queue</Text>
          </View>
        )}
        {queue?.map((item) => {
          const isExpanded = expandedEpisodeId === item._id;
          const detail = isExpanded ? episodeDetail : null;
          const regenSet = regeneratingScenes.get(item._id) ?? new Set();

          if (isExpanded && detail) {
            return (
              <EpisodeCard
                key={item._id}
                episodeId={item._id}
                slug={detail.slug}
                status={detail.status}
                figureName={detail.figureName}
                difficulty={detail.difficulty}
                scenes={detail.scenes}
                onApprove={() => handleApprove(item._id)}
                onRegenerateScene={(i) => handleRegenerateScene(item._id, i)}
                isApproving={approvingId === item._id}
                regeneratingScenes={regenSet}
              />
            );
          }

          return (
            <Pressable
              key={item._id}
              style={styles.queueItem}
              onPress={() => setExpandedEpisodeId(isExpanded ? null : item._id)}
            >
              <View style={styles.queueItemLeft}>
                <Ionicons
                  name={isExpanded ? "chevron-down" : "chevron-forward"}
                  size={16}
                  color="#64748b"
                />
                <View>
                  <Text style={styles.queueSlug}>{item.slug}</Text>
                  {item.figureName && <Text style={styles.queueFigure}>{item.figureName}</Text>}
                </View>
              </View>
              <View style={styles.queueItemRight}>
                <View style={[styles.statusBadge, styles[`status_${item.status}`]]}>
                  <Text style={styles.statusText}>{item.status}</Text>
                </View>
                <Text style={styles.queueCount}>
                  {item.imagesReady}/{item.sceneCount}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
  content: {
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 20,
    gap: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  title: {
    color: "#f8fafc",
    fontSize: 24,
    fontWeight: "700",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 14,
    marginTop: 4,
  },
  backButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#1e293b",
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#450a0a",
    borderWidth: 1,
    borderColor: "#7f1d1d",
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: "#fca5a5",
    fontSize: 13,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: "#e2e8f0",
    fontSize: 16,
    fontWeight: "600",
  },
  emptyState: {
    alignItems: "center",
    padding: 40,
    gap: 12,
  },
  emptyText: {
    color: "#475569",
    fontSize: 14,
  },
  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0f172a",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 14,
  },
  queueItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  queueSlug: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "500",
  },
  queueFigure: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
  },
  queueItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  status_staging: { backgroundColor: "#f59e0b" },
  status_review: { backgroundColor: "#3b82f6" },
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  queueCount: {
    color: "#64748b",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
});
