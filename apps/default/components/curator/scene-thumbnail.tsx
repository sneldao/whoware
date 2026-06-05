import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

interface SceneThumbnailProps {
  title: string;
  location: string;
  era: string;
  imageUrl?: string;
  isMercy?: boolean;
  sceneIndex: number;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

export function SceneThumbnail({
  title,
  location,
  era,
  imageUrl,
  isMercy,
  sceneIndex,
  onRegenerate,
  isRegenerating,
}: SceneThumbnailProps) {
  return (
    <View style={styles.container}>
      <View style={styles.imageWrapper}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="image-outline" size={32} color="#64748b" />
          </View>
        )}
        {isMercy && (
          <View style={styles.mercyBadge}>
            <Text style={styles.mercyText}>MERCY</Text>
          </View>
        )}
        <View style={styles.indexBadge}>
          <Text style={styles.indexText}>{sceneIndex + 1}</Text>
        </View>
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.location} numberOfLines={1}>
          {location}, {era}
        </Text>
      </View>
      <Pressable
        style={[styles.regenButton, isRegenerating && styles.regenButtonDisabled]}
        onPress={onRegenerate}
        disabled={isRegenerating}
      >
        {isRegenerating ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="refresh" size={14} color="#fff" />
            <Text style={styles.regenText}>Regen</Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#1e293b",
    borderRadius: 8,
    gap: 12,
  },
  imageWrapper: {
    position: "relative",
    width: 80,
    height: 60,
    borderRadius: 6,
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#334155",
    justifyContent: "center",
    alignItems: "center",
  },
  mercyBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    backgroundColor: "#dc2626",
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  mercyText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "700",
  },
  indexBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.7)",
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: "center",
    alignItems: "center",
  },
  indexText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "600",
  },
  location: {
    color: "#94a3b8",
    fontSize: 12,
  },
  regenButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#3b82f6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 4,
  },
  regenButtonDisabled: {
    backgroundColor: "#475569",
  },
  regenText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
});
