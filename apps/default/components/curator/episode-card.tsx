import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SceneThumbnail } from "./scene-thumbnail";

interface Scene {
  title: string;
  location: string;
  era: string;
  imageUrl?: string;
  isMercy?: boolean;
}

interface EpisodeCardProps {
  episodeId: string;
  slug: string;
  status: string;
  figureName?: string;
  difficulty: string;
  scenes: Scene[];
  onApprove: () => void;
  onRegenerateScene: (sceneIndex: number) => void;
  isApproving: boolean;
  regeneratingScenes: Set<number>;
}

export function EpisodeCard({
  episodeId,
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
  const [expanded, setExpanded] = useState(false);
  const imagesReady = scenes.filter((s) => Boolean(s.imageUrl)).length;
  const canApprove = status === "review" && imagesReady === scenes.length;

  return (
    <View style={styles.card}>
      <Pressable style={styles.header} onPress={() => setExpanded(!expanded)}>
        <View style={styles.headerLeft}>
          <Ionicons
            name={expanded ? "chevron-down" : "chevron-forward"}
            size={18}
            color="#94a3b8"
          />
          <View style={styles.headerInfo}>
            <Text style={styles.slug}>{slug}</Text>
            {figureName && <Text style={styles.figureName}>{figureName}</Text>}
          </View>
        </View>
        <View style={styles.headerRight}>
          <View style={[styles.badge, styles[`badge_${status}`] || styles.badge_default]}>
            <Text style={styles.badgeText}>{status}</Text>
          </View>
          <View style={styles.diffBadge}>
            <Text style={styles.diffText}>{difficulty}</Text>
          </View>
          <Text style={styles.imageCount}>
            {imagesReady}/{scenes.length}
          </Text>
        </View>
      </Pressable>

      {expanded && (
        <View style={styles.body}>
          <View style={styles.scenes}>
            {scenes.map((scene, i) => (
              <SceneThumbnail
                key={i}
                title={scene.title}
                location={scene.location}
                era={scene.era}
                imageUrl={scene.imageUrl}
                isMercy={scene.isMercy}
                sceneIndex={i}
                onRegenerate={() => onRegenerateScene(i)}
                isRegenerating={regeneratingScenes.has(i)}
              />
            ))}
          </View>

          {canApprove && (
            <Pressable
              style={[styles.approveButton, isApproving && styles.approveButtonDisabled]}
              onPress={onApprove}
              disabled={isApproving}
            >
              {isApproving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={16} color="#fff" />
                  <Text style={styles.approveText}>Approve Episode</Text>
                </>
              )}
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#0f172a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  headerInfo: {
    gap: 2,
  },
  slug: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "600",
  },
  figureName: {
    color: "#94a3b8",
    fontSize: 12,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  badge_staging: { backgroundColor: "#f59e0b" },
  badge_review: { backgroundColor: "#3b82f6" },
  badge_draft: { backgroundColor: "#10b981" },
  badge_live: { backgroundColor: "#8b5cf6" },
  badge_closed: { backgroundColor: "#64748b" },
  badge_default: { backgroundColor: "#64748b" },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  diffBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "#1e293b",
  },
  diffText: {
    color: "#94a3b8",
    fontSize: 11,
  },
  imageCount: {
    color: "#64748b",
    fontSize: 12,
    fontVariant: ["tabular-nums"],
  },
  body: {
    padding: 16,
    paddingTop: 0,
    gap: 12,
  },
  scenes: {
    gap: 8,
  },
  approveButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#10b981",
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  approveButtonDisabled: {
    opacity: 0.6,
  },
  approveText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
