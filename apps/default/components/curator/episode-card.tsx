import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import type { Id } from "@/convex/_generated/dataModel";
import { theme } from "@/lib/theme";

interface Scene {
  title: string;
  location: string;
  era: string;
  palette: string[];
  panoramaPrompt: string;
  imageKey?: string;
  ambientText: string;
  clues: Array<{ label: string; detail: string; x: number; y: number }>;
  isMercy?: boolean;
  imageUrl?: string;
}

interface EpisodeCardProps {
  episodeId: Id<"episodes">;
  slug: string;
  status: "staging" | "review" | "draft" | "live" | "closed";
  figureName?: string;
  difficulty: "iconic" | "field" | "research";
  scenes: Scene[];
  onApprove: () => void;
  onRegenerateScene: (sceneIndex: number) => void;
  isApproving: boolean;
  regeneratingScenes: Set<number>;
}

const STATUS_COLORS: Record<string, string> = {
  staging: theme.goldGradientEnd,
  review: "#3B82F6",
  draft: "#8B5CF6",
  live: theme.success,
  closed: theme.neutral,
};

export function EpisodeCard({
  slug,
  status,
  figureName,
  difficulty,
  scenes,
  onApprove,
  onRegenerateScene,
  isApproving,
  regeneratingScenes,
}: EpisodeCardProps) {
  const canApprove = status === "review" && scenes.length > 0;
  const investigationScenes = scenes.filter((s) => !s.isMercy);
  const missingImages = investigationScenes.filter((s) => !s.imageUrl && !s.imageKey);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.slug}>{slug}</Text>
          {figureName && <Text style={styles.figureName}>{figureName}</Text>}
        </View>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[status] ?? theme.neutral }]}>
          <Text style={styles.statusText}>{status}</Text>
        </View>
      </View>

      <View style={styles.meta}>
        <View style={styles.metaChip}>
          <Text style={styles.metaLabel}>Difficulty</Text>
          <Text style={styles.metaValue}>{difficulty}</Text>
        </View>
        <View style={styles.metaChip}>
          <Text style={styles.metaLabel}>Scenes</Text>
          <Text style={styles.metaValue}>{scenes.length}</Text>
        </View>
        <View style={styles.metaChip}>
          <Text style={styles.metaLabel}>Images</Text>
          <Text style={[styles.metaValue, missingImages.length > 0 && styles.metaValueError]}>
            {scenes.length - missingImages.length}/{scenes.length}
          </Text>
        </View>
      </View>

      <View style={styles.scenesList}>
        <Text style={styles.scenesTitle}>Scenes</Text>
        {scenes.map((scene, i) => {
          const isRegenerating = regeneratingScenes.has(i);
          const hasImage = Boolean(scene.imageUrl || scene.imageKey);
          return (
            <View key={`${scene.title}-${i}`} style={styles.sceneRow}>
              <View style={styles.sceneInfo}>
                <Text style={styles.sceneIndex}>#{i + 1}</Text>
                <View style={styles.sceneMeta}>
                  <Text style={styles.sceneTitle}>{scene.title}</Text>
                  <Text style={styles.sceneLocation}>
                    {scene.location} · {scene.era}
                  </Text>
                </View>
              </View>
              <View style={styles.sceneRight}>
                {scene.isMercy && (
                  <View style={styles.mercyBadge}>
                    <Text style={styles.mercyText}>mercy</Text>
                  </View>
                )}
                {hasImage ? (
                  <Ionicons name="image" size={14} color={theme.success} />
                ) : (
                  <Ionicons name="image-outline" size={14} color="#EF4444" />
                )}
                <Pressable
                  style={styles.regenButton}
                  onPress={() => onRegenerateScene(i)}
                  disabled={isRegenerating}
                >
                  {isRegenerating ? (
                    <ActivityIndicator size="small" color="#94a3b8" />
                  ) : (
                    <Ionicons name="refresh" size={14} color="#94a3b8" />
                  )}
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      {canApprove ? (
        <Pressable
          style={({ pressed }) => [
            styles.approveButton,
            pressed && styles.pressed,
            missingImages.length > 0 && styles.approveButtonDisabled,
          ]}
          onPress={onApprove}
          disabled={isApproving || missingImages.length > 0}
        >
          {isApproving ? (
            <ActivityIndicator size="small" color={theme.inkOnAccent} />
          ) : (
            <View style={styles.approveButtonContent}>
              <Ionicons name="checkmark-circle" size={16} color={theme.inkOnAccent} />
              <Text style={styles.approveButtonText}>
                {missingImages.length > 0
                  ? `Approve (${missingImages.length} scene${missingImages.length > 1 ? "s" : "s"} missing images)`
                  : "Approve for Draft"}
              </Text>
            </View>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    backgroundColor: "#0f172a",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  headerLeft: {
    flex: 1,
    gap: 4,
  },
  slug: {
    color: "#f8fafc",
    fontSize: 16,
    fontWeight: "700",
  },
  figureName: {
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: "500",
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  meta: {
    flexDirection: "row",
    gap: 8,
  },
  metaChip: {
    flex: 1,
    padding: 8,
    gap: 2,
    borderRadius: 8,
    backgroundColor: "#1e293b",
    alignItems: "center",
  },
  metaLabel: {
    color: "#64748b",
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  metaValue: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
  },
  metaValueError: {
    color: "#EF4444",
  },
  scenesList: {
    gap: 8,
  },
  scenesTitle: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "600",
  },
  sceneRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
    borderRadius: 8,
    backgroundColor: "#1e293b",
    gap: 8,
  },
  sceneInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  sceneIndex: {
    color: "#64748b",
    fontSize: 12,
    fontWeight: "700",
    width: 24,
  },
  sceneMeta: {
    flex: 1,
    gap: 2,
  },
  sceneTitle: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "600",
  },
  sceneLocation: {
    color: "#64748b",
    fontSize: 11,
  },
  sceneRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  mercyBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "rgba(134, 239, 172, 0.15)",
  },
  mercyText: {
    color: "#86EFAC",
    fontSize: 10,
    fontWeight: "700",
  },
  regenButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#334155",
  },
  pressed: {
    opacity: 0.72,
  },
  approveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: theme.success,
  },
  approveButtonDisabled: {
    backgroundColor: "#334155",
  },
  approveButtonText: {
    color: theme.inkOnAccent,
    fontSize: 14,
    fontWeight: "700",
  },
});
