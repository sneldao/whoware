import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import { getSceneImageSource } from "@/components/who-ware/scene-media";

interface MemoryMediaStripProps {
  imageKey?: string;
  detailImageKeys?: string[];
  sceneIndex: number;
  motionPrompt?: string;
  imageUrl?: string;
}

const detailFocus = [
  { label: "Atmosphere", position: "left center" },
  { label: "Evidence", position: "center" },
  { label: "Texture", position: "right center" },
] as const;

export function MemoryMediaStrip({ imageKey, detailImageKeys, sceneIndex, motionPrompt, imageUrl }: MemoryMediaStripProps) {
  const hasMotionPlan = Boolean(motionPrompt?.trim());
  const detailKeys = detailImageKeys && detailImageKeys.length > 0 ? detailImageKeys.slice(0, 3) : [imageKey, imageKey, imageKey];

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.eyebrow}>Media layer</Text>
          <Text style={styles.title}>Cinematic memory plates</Text>
        </View>
        <View style={styles.videoBadge}>
          <Ionicons name={hasMotionPlan ? "videocam" : "images"} size={15} color="#111827" />
          <Text style={styles.videoBadgeText}>{hasMotionPlan ? "Video-ready" : "Still-first"}</Text>
        </View>
      </View>

      <View style={styles.strip}>
        {detailFocus.map((item, index) => (
          <View key={item.label} style={styles.frame}>
            <Image
              source={getSceneImageSource(detailKeys[index], sceneIndex, imageUrl)}
              style={styles.detailImage}
              contentFit="cover"
              contentPosition={item.position}
              transition={180}
            />
            <View style={styles.frameShade} />
            <Text style={styles.frameLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {hasMotionPlan ? <Text style={styles.motionCopy}>{motionPrompt}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 14,
    gap: 12,
    borderRadius: 24,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.1)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  eyebrow: {
    color: "#FBBF24",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  title: {
    color: "#FFF7ED",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  videoBadge: {
    minHeight: 30,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: "#FBBF24",
  },
  videoBadgeText: {
    color: "#111827",
    fontSize: 11,
    fontWeight: "900",
  },
  strip: {
    flexDirection: "row",
    gap: 8,
  },
  frame: {
    flex: 1,
    height: 92,
    overflow: "hidden",
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(15, 23, 42, 0.9)",
  },
  detailImage: {
    ...StyleSheet.absoluteFillObject,
  },
  frameShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.18)",
  },
  frameLabel: {
    position: "absolute",
    left: 10,
    bottom: 9,
    color: "#FFF7ED",
    fontSize: 11,
    fontWeight: "900",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowRadius: 8,
  },
  motionCopy: {
    color: "rgba(255, 247, 237, 0.62)",
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
  },
});
