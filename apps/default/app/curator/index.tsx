import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Ionicons } from "@expo/vector-icons";
import { useAction, useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EpisodeCard } from "@/components/curator/episode-card";
import { GenerateForm } from "@/components/curator/generate-form";
import { VenicePipelineDemo } from "@/components/curator/venice-pipeline-demo";
import { VeniceAiBadge } from "@/components/who-ware/venice-ai-badge";
import { VeniceStatsPanel } from "@/components/curator/venice-stats-panel";
import { VeniceWeeklyChart } from "@/components/curator/venice-weekly-chart";
import { CuratorLeaderboard } from "@/components/curator/curator-leaderboard";

type TabKey = "pipeline" | "queue";

const TABS: { key: TabKey; label: string; icon: "layers" | "cube" }[] = [
  { key: "pipeline", label: "AI Pipeline", icon: "layers" },
  { key: "queue", label: "Staging Queue", icon: "cube" },
];

export default function CuratorScreen() {
  const insets = useSafeAreaInsets();
  const queue = useQuery(api.catalog.getStagingQueue, {});
  const figures = useQuery(api.figures.listAll, {}) ?? [];
  const [expandedEpisodeId, setExpandedEpisodeId] = useState<Id<"episodes"> | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("pipeline");

  const approveEpisode = useMutation(api.catalog.approveEpisode);
  const regenerateScene = useAction(api.catalog.regenerateScene);
  const generateEpisode = useAction(api.catalog.generateEpisode);
  const autonomousGenerate = useAction(api.catalog.autonomousGenerateEpisode);

  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [regeneratingScenes, setRegeneratingScenes] = useState<Map<string, Set<number>>>(new Map());
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pipeline state
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [pipelineResult, setPipelineResult] = useState<{
    figureName: string;
    reasoning: string;
    scenesGenerated: number;
  } | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  // Auto-advance pipeline steps while running
  const handleStartPipeline = useCallback(async () => {
    setPipelineRunning(true);
    setPipelineStep(0);
    setPipelineResult(null);
    setPipelineError(null);

    const advanceStep = async (targetStep: number) => {
      for (let i = 0; i <= targetStep; i++) {
        await new Promise((resolve) => setTimeout(resolve, i === 0 ? 300 : 800));
        setPipelineStep(i);
      }
    };

    try {
      // Steps 0-1: Show selection and generation starting
      await advanceStep(1);

      // Actual autonomous action (2-4 minutes on Venice)
      const result = await autonomousGenerate({ slug: `auto-ep-${Date.now()}` });

      // Fast-forward remaining steps
      setPipelineStep(2);
      await new Promise((resolve) => setTimeout(resolve, 600));
      setPipelineStep(3);
      await new Promise((resolve) => setTimeout(resolve, 600));
      setPipelineStep(4);
      await new Promise((resolve) => setTimeout(resolve, 600));
      setPipelineStep(5);

      setPipelineResult({
        figureName: result.figureName,
        reasoning: result.reasoning,
        scenesGenerated: result.scenesGenerated,
      });
    } catch (e) {
      setPipelineError(e instanceof Error ? e.message : "Pipeline failed");
    } finally {
      setPipelineRunning(false);
    }
  }, [autonomousGenerate]);

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

  const episodeDetail = useQuery(
    api.catalog.getEpisodeDetail,
    expandedEpisodeId ? { episodeId: expandedEpisodeId } : "skip",
  );

  const scenes = episodeDetail?.scenes ?? [];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 48 }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.logoMark}>
            <Ionicons name="eye" size={20} color="#111827" />
          </View>
          <View>
            <Text style={styles.title}>Curator</Text>
            <Text style={styles.subtitle}>Autonomous agent studio</Text>
          </View>
        </View>
        <Pressable style={styles.backButton} href="/">
          <Ionicons name="close" size={20} color="rgba(255, 247, 237, 0.5)" />
        </Pressable>
      </View>

      {/* Venice AI attribution banner */}
      <View style={styles.veniceBanner}>
        <View style={styles.veniceBannerLeft}>
          <View style={styles.veniceIcon}>
            <Ionicons name="sparkles" size={14} color="#A78BFA" />
          </View>
          <View>
            <Text style={styles.veniceBannerTitle}>Powered by Venice AI</Text>
            <Text style={styles.veniceBannerSub}>
              All scenes, images, hints, and difficulty calibration generated autonomously
            </Text>
          </View>
        </View>
        <VeniceAiBadge type="scene" compact />
      </View>

      {/* Venice AI Stats + Trend */}
      <VeniceStatsPanel />
      <VeniceWeeklyChart />
      <CuratorLeaderboard />

      {/* Tab navigation */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={({ pressed }) => [
              styles.tab,
              activeTab === tab.key && styles.tabActive,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={tab.icon}
              size={14}
              color={activeTab === tab.key ? "#111827" : "rgba(255, 247, 237, 0.5)"}
            />
            <Text style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}>
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Tab: Pipeline */}
      {activeTab === "pipeline" ? (
        <VenicePipelineDemo
          isRunning={pipelineRunning}
          currentStepIndex={pipelineStep}
          result={pipelineResult}
          error={pipelineError}
          onStart={handleStartPipeline}
          onStep={setPipelineStep}
        />
      ) : null}

      {/* Tab: Queue & Generate */}
      {activeTab === "queue" ? (
        <>
          {/* Error banner */}
          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={16} color="#EF4444" />
              <Text style={styles.errorBannerText}>{error}</Text>
              <Pressable onPress={() => setError(null)}>
                <Ionicons name="close" size={16} color="#EF4444" />
              </Pressable>
            </View>
          ) : null}

          {/* Generate form */}
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

          {/* Staging queue */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="cube" size={16} color="#FBBF24" />
              <Text style={styles.sectionTitle}>Staging Queue</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{queue?.length ?? 0}</Text>
              </View>
            </View>

            {!queue && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color="rgba(255, 247, 237, 0.4)" />
              </View>
            )}

            {queue && queue.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="cube-outline" size={32} color="rgba(255, 247, 237, 0.15)" />
                </View>
                <Text style={styles.emptyTitle}>Queue is empty</Text>
                <Text style={styles.emptyText}>
                  Use the AI Pipeline tab to auto-generate, or select a figure below
                </Text>
              </View>
            ) : (
              <View style={styles.queueList}>
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
                        scenes={scenes}
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
                      style={({ pressed }) => [styles.queueItem, pressed && styles.pressed]}
                      onPress={() => setExpandedEpisodeId(isExpanded ? null : item._id)}
                    >
                      <View style={styles.queueItemLeft}>
                        <Ionicons
                          name={isExpanded ? "chevron-down" : "chevron-forward"}
                          size={14}
                          color="rgba(255, 247, 237, 0.3)"
                        />
                        <View style={styles.queueItemInfo}>
                          <Text style={styles.queueSlug}>{item.slug}</Text>
                          {item.figureName && (
                            <Text style={styles.queueFigure}>{item.figureName}</Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.queueItemRight}>
                        <View
                          style={[
                            styles.statusBadge,
                            item.status === "staging" && styles.statusStaging,
                            item.status === "review" && styles.statusReview,
                          ]}
                        >
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
            )}
          </View>
        </>
      ) : null}

      {/* Footer */}
      <View style={styles.footer}>
        <VeniceAiBadge type="scene" compact />
        <Text style={styles.footerText}>
          All episodes generated autonomously by Venice AI through a 6-stage pipeline
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#070A12",
  },
  content: {
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
    paddingHorizontal: 18,
    gap: 18,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBBF24",
  },
  title: {
    color: "#FFF7ED",
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  subtitle: {
    color: "rgba(255, 247, 237, 0.5)",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 247, 237, 0.06)",
  },
  veniceBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(167, 139, 250, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.15)",
  },
  veniceBannerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  veniceIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(167, 139, 250, 0.15)",
  },
  veniceBannerTitle: {
    color: "#A78BFA",
    fontSize: 13,
    fontWeight: "900",
  },
  veniceBannerSub: {
    color: "rgba(255, 247, 237, 0.4)",
    fontSize: 10,
    fontWeight: "600",
    marginTop: 1,
    lineHeight: 14,
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.06)",
  },
  tabActive: {
    backgroundColor: "#FBBF24",
    borderColor: "#FBBF24",
  },
  tabLabel: {
    color: "rgba(255, 247, 237, 0.5)",
    fontSize: 13,
    fontWeight: "800",
  },
  tabLabelActive: {
    color: "#111827",
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sectionTitle: {
    color: "#FFF7ED",
    fontSize: 16,
    fontWeight: "900",
  },
  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(255, 247, 237, 0.08)",
  },
  countText: {
    color: "rgba(255, 247, 237, 0.5)",
    fontSize: 11,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  loadingRow: {
    padding: 24,
    alignItems: "center",
  },
  emptyState: {
    alignItems: "center",
    padding: 32,
    gap: 8,
    borderRadius: 20,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.02)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.04)",
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 247, 237, 0.04)",
    marginBottom: 4,
  },
  emptyTitle: {
    color: "#FFF7ED",
    fontSize: 15,
    fontWeight: "800",
  },
  emptyText: {
    color: "rgba(255, 247, 237, 0.4)",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    lineHeight: 18,
  },
  queueList: {
    gap: 8,
  },
  queueItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 16,
    borderCurve: "continuous",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.06)",
    backgroundColor: "rgba(255, 247, 237, 0.03)",
  },
  queueItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  queueItemInfo: {
    gap: 2,
  },
  queueSlug: {
    color: "#FFF7ED",
    fontSize: 14,
    fontWeight: "800",
  },
  queueFigure: {
    color: "rgba(255, 247, 237, 0.45)",
    fontSize: 11,
    fontWeight: "700",
  },
  queueItemRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusStaging: {
    backgroundColor: "rgba(251, 191, 36, 0.15)",
  },
  statusReview: {
    backgroundColor: "rgba(96, 165, 250, 0.15)",
  },
  statusText: {
    color: "#FFF7ED",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  queueCount: {
    color: "rgba(255, 247, 237, 0.35)",
    fontSize: 12,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.2)",
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "700",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    justifyContent: "center",
    flexWrap: "wrap",
  },
  footerText: {
    color: "rgba(255, 247, 237, 0.3)",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },
  pressed: {
    opacity: 0.72,
  },
});
