import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import * as Sharing from "expo-sharing";
import { useRef, useState } from "react";
import { Platform, Pressable, Share, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { captureRef } from "react-native-view-shot";

interface ResultShareCardProps {
  episodeNumber: number;
  memoriesViewed: number;
  cluesOpened: number;
  elapsedMs: number;
  score: number;
  rank: number | null;
  rankedCount: number;
  streak?: number;
  guessesUsed?: number;
  hotspotsOpened?: number;
  difficulty?: "iconic" | "field" | "research";
  figureEra?: string;
  figureRegion?: string;
}

const DIFFICULTY_PALETTE: Record<string, { bg: string; fg: string; label: string }> = {
  iconic: { bg: "rgba(251, 191, 36, 0.22)", fg: "#FBBF24", label: "Iconic" },
  field: { bg: "rgba(134, 239, 172, 0.22)", fg: "#86EFAC", label: "Field" },
  research: { bg: "rgba(147, 197, 253, 0.22)", fg: "#93C5FD", label: "Research" },
};

function getStreakTier(streak: number): { label: string; color: string; icon: string; glow: string } {
  if (streak >= 100) return { label: "Eternal", color: "#C084FC", icon: "diamond", glow: "rgba(192, 132, 252, 0.3)" };
  if (streak >= 30) return { label: "Inferno", color: "#EF4444", icon: "flame", glow: "rgba(239, 68, 68, 0.3)" };
  if (streak >= 7) return { label: "Flame", color: "#FB923C", icon: "flame", glow: "rgba(251, 146, 60, 0.3)" };
  if (streak >= 1) return { label: "Spark", color: "#FBBF24", icon: "flash", glow: "rgba(251, 191, 36, 0.3)" };
  return { label: "", color: "#FB923C", icon: "flame", glow: "rgba(251, 146, 60, 0.3)" };
}

function getScoreTierGradient(percentile: number | null): string[] {
  if (percentile !== null && percentile <= 10) return ["#FBBF24", "#F59E0B", "#FBBF24"];
  if (percentile !== null && percentile <= 25) return ["#D1D5DB", "#9CA3AF", "#D1D5DB"];
  if (percentile !== null && percentile <= 50) return ["#D97706", "#B45309", "#D97706"];
  return ["rgba(251, 191, 36, 0.28)", "rgba(251, 191, 36, 0.12)", "rgba(251, 191, 36, 0.28)"];
}

export function ResultShareCard({
  episodeNumber,
  memoriesViewed,
  cluesOpened,
  elapsedMs,
  score,
  rank,
  rankedCount,
  streak = 0,
  guessesUsed = 1,
  hotspotsOpened = 0,
  difficulty,
  figureEra,
  figureRegion,
}: ResultShareCardProps) {
  const cardRef = useRef<View>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isImageSharing, setIsImageSharing] = useState(false);

  const memoryGrid = buildMemoryGrid(memoriesViewed, cluesOpened);
  const percentile = rank && rankedCount > 0 ? Math.max(1, Math.round((rank / rankedCount) * 100)) : null;
  const shareText = buildShareText({ episodeNumber, memoryGrid, memoriesViewed, cluesOpened, elapsedMs, percentile, streak });
  const difficultyStyle = difficulty ? DIFFICULTY_PALETTE[difficulty] ?? DIFFICULTY_PALETTE.iconic : null;
  const tier = getStreakTier(streak);
  const borderGradient = getScoreTierGradient(percentile);

  async function handleShare() {
    if (isSharing) return;
    setIsSharing(true);
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      if (Platform.OS !== "web" && cardRef.current) {
        const uri = await captureRef(cardRef, { format: "png", quality: 1 });
        const canShareFile = await Sharing.isAvailableAsync();
        if (canShareFile) {
          await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share your WhoWare result" });
          return;
        }
      }
      await Share.share({ message: shareText });
    } catch {
      try {
        await Share.share({ message: shareText });
      } catch {
        // user dismissed
      }
    } finally {
      setIsSharing(false);
    }
  }

  async function handleShareImage() {
    if (isImageSharing) return;
    setIsImageSharing(true);
    if (Platform.OS !== "web") {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    try {
      if (cardRef.current) {
        const uri = await captureRef(cardRef, { format: "png", quality: 1 });
        if (Platform.OS === "web") {
          const link = document.createElement("a");
          link.href = uri;
          link.download = `whoware-${episodeNumber}.png`;
          link.click();
        } else {
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(uri, { mimeType: "image/png", dialogTitle: "Share result image" });
          }
        }
      }
    } catch {
      // user dismissed
    } finally {
      setIsImageSharing(false);
    }
  }

  async function handleCopy() {
    if (isCopied) return;
    await Clipboard.setStringAsync(shareText);
    setIsCopied(true);
    if (Platform.OS !== "web") {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setTimeout(() => setIsCopied(false), 1800);
  }

  return (
    <Animated.View entering={FadeInDown.springify().damping(14).stiffness(120)} style={styles.container}>
      <View style={styles.borderWrap}>
        <LinearGradient colors={borderGradient} style={styles.borderGradient}>
          <View ref={cardRef} collapsable={false} style={styles.captureSurface}>
            <LinearGradient colors={["#2A1A09", "#140C04"]} style={StyleSheet.absoluteFill} />
            <View style={styles.cardHeader}>
              <View style={styles.brandMark}>
                <Ionicons name="eye" size={16} color="#1C1106" />
              </View>
              <Text style={styles.brandName}>WhoWare</Text>
              <View style={styles.headerChips}>
                {streak > 0 ? (
                  <View style={[styles.tierChip, { backgroundColor: tier.glow, borderColor: tier.color }]}>
                    <Ionicons name={tier.icon as "flash" | "flame" | "diamond"} size={12} color={tier.color} />
                    <Text style={[styles.tierChipText, { color: tier.color }]}>{tier.label}</Text>
                  </View>
                ) : null}
                {difficultyStyle ? (
                  <View style={[styles.chip, { backgroundColor: difficultyStyle.bg }]}>
                    <Text style={[styles.chipText, { color: difficultyStyle.fg }]}>{difficultyStyle.label}</Text>
                  </View>
                ) : null}
                <Text style={styles.episodeTag}>#{episodeNumber}</Text>
              </View>
            </View>

            <Text style={styles.solvedLabel}>Identity anchored</Text>

            {figureEra && figureRegion ? (
              <Text style={styles.figureContext}>
                {figureEra} · {figureRegion}
              </Text>
            ) : null}

            <View style={styles.gridRow}>
              {memoryGrid.map((symbol, index) => (
                <Text key={index} style={styles.gridSymbol}>
                  {symbol}
                </Text>
              ))}
            </View>

            <View style={styles.statRow}>
              <ShareStat label="Memories" value={`${memoriesViewed}`} />
              <ShareStat label="Clues" value={`${cluesOpened}`} />
              <ShareStat label="Time" value={formatElapsed(elapsedMs)} />
            </View>

            <View style={styles.statRow}>
              <ShareStat label="Guesses" value={`${guessesUsed}`} />
              <ShareStat label="Hotspots" value={`${hotspotsOpened}`} />
              <ShareStat label="Score" value={formatScore(score)} />
            </View>

            <View style={styles.scoreRow}>
              <Text style={styles.scoreValue}>{formatScore(score)}</Text>
              <Text style={styles.scoreSuffix}>pts</Text>
              {percentile !== null ? (
                <View style={styles.percentileBadge}>
                  <Text style={styles.percentile}>Top {percentile}%</Text>
                </View>
              ) : null}
            </View>

            {streak > 0 ? (
              <View style={styles.streakRow}>
                <View style={[styles.streakFlameGlow, { backgroundColor: tier.glow }]}>
                  <Ionicons name="flame" size={16} color={tier.color} />
                </View>
                <Text style={[styles.streakText, { color: tier.color }]}>{streak}-day streak</Text>
              </View>
            ) : null}

            <Text style={styles.tagline}>Can you name them in fewer? · whoware.app</Text>
          </View>
        </LinearGradient>
      </View>

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={handleCopy}
          disabled={isCopied}
          style={({ pressed }) => [styles.copyButton, pressed && styles.pressed, isCopied && styles.copyButtonDone]}
        >
          <Ionicons name={isCopied ? "checkmark" : "copy-outline"} size={18} color="#FBBF24" />
          <Text style={styles.copyButtonText}>{isCopied ? "Copied" : "Copy text"}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={handleShareImage}
          disabled={isImageSharing}
          style={({ pressed }) => [styles.imageButton, pressed && styles.pressed, isImageSharing && styles.shareButtonBusy]}
        >
          <Ionicons name="image-outline" size={18} color="#FBBF24" />
          <Text style={styles.imageButtonText}>{isImageSharing ? "…" : "Image"}</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={handleShare}
          disabled={isSharing}
          style={({ pressed }) => [styles.shareButton, pressed && styles.pressed, isSharing && styles.shareButtonBusy]}
        >
          <Ionicons name="share-outline" size={18} color="#1C1106" />
          <Text style={styles.shareButtonText}>{isSharing ? "…" : "Share"}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

interface ShareStatProps {
  label: string;
  value: string;
}

function ShareStat({ label, value }: ShareStatProps) {
  return (
    <View style={styles.shareStat}>
      <Text style={styles.shareStatValue}>{value}</Text>
      <Text style={styles.shareStatLabel}>{label}</Text>
    </View>
  );
}

function buildMemoryGrid(memoriesViewed: number, cluesOpened: number): string[] {
  if (memoriesViewed <= 0) return ["🟨"];
  const tiles: string[] = [];
  for (let index = 0; index < Math.min(memoriesViewed, 5); index += 1) tiles.push("🟫");
  for (let index = 0; index < Math.min(cluesOpened, 5); index += 1) tiles.push("🔍");
  return tiles;
}

function buildShareText(args: {
  episodeNumber: number;
  memoryGrid: string[];
  memoriesViewed: number;
  cluesOpened: number;
  elapsedMs: number;
  percentile: number | null;
  streak: number;
}): string {
  const { episodeNumber, memoryGrid, memoriesViewed, cluesOpened, elapsedMs, percentile, streak } = args;
  const memoryLabel = memoriesViewed === 1 ? "memory" : "memories";
  const percentileLine = percentile !== null ? ` · top ${percentile}%` : "";
  const streakLine = streak > 0 ? ` · 🔥${streak}` : "";
  return [
    `WhoWare #${episodeNumber}`,
    memoryGrid.join(""),
    `${memoriesViewed} ${memoryLabel} · ${cluesOpened} clues · ${formatElapsed(elapsedMs)}${percentileLine}${streakLine}`,
    `Can you name them in fewer? whoware.app`,
  ].join("\n");
}

function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatScore(score: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(score);
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  borderWrap: {
    borderRadius: 30,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  borderGradient: {
    padding: 2,
    borderRadius: 30,
    borderCurve: "continuous",
  },
  captureSurface: {
    overflow: "hidden",
    padding: 22,
    gap: 12,
    borderRadius: 28,
    borderCurve: "continuous",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderCurve: "continuous",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FBBF24",
  },
  brandName: {
    flex: 1,
    color: "#FFF7ED",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  episodeTag: {
    color: "rgba(251, 191, 36, 0.9)",
    fontSize: 16,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  headerChips: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tierChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  tierChipText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.3,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  solvedLabel: {
    color: "rgba(255, 247, 237, 0.6)",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  figureContext: {
    color: "rgba(255, 247, 237, 0.7)",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  gridRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  gridSymbol: {
    fontSize: 24,
  },
  statRow: {
    flexDirection: "row",
    gap: 8,
  },
  shareStat: {
    flex: 1,
    padding: 10,
    gap: 2,
    borderRadius: 14,
    borderCurve: "continuous",
    backgroundColor: "rgba(255, 247, 237, 0.07)",
    borderWidth: 1,
    borderColor: "rgba(255, 247, 237, 0.08)",
  },
  shareStatValue: {
    color: "#FFF7ED",
    fontSize: 17,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
  },
  shareStatLabel: {
    color: "rgba(255, 247, 237, 0.45)",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  scoreValue: {
    color: "#FBBF24",
    fontSize: 32,
    fontWeight: "900",
    fontVariant: ["tabular-nums"],
    letterSpacing: -1,
  },
  scoreSuffix: {
    color: "rgba(251, 191, 36, 0.6)",
    fontSize: 14,
    fontWeight: "800",
  },
  percentileBadge: {
    marginLeft: "auto",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255, 247, 237, 0.08)",
  },
  percentile: {
    color: "#FFF7ED",
    fontSize: 13,
    fontWeight: "900",
  },
  streakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  streakFlameGlow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  streakText: {
    fontSize: 14,
    fontWeight: "900",
  },
  tagline: {
    color: "rgba(255, 247, 237, 0.38)",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  copyButton: {
    paddingHorizontal: 14,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.35)",
  },
  copyButtonDone: {
    backgroundColor: "rgba(134, 239, 172, 0.14)",
    borderColor: "rgba(134, 239, 172, 0.5)",
  },
  copyButtonText: {
    color: "#FBBF24",
    fontSize: 13,
    fontWeight: "900",
  },
  imageButton: {
    paddingHorizontal: 14,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "rgba(251, 191, 36, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(251, 191, 36, 0.35)",
  },
  imageButtonText: {
    color: "#FBBF24",
    fontSize: 13,
    fontWeight: "900",
  },
  shareButton: {
    flex: 1,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 18,
    borderCurve: "continuous",
    backgroundColor: "#FBBF24",
  },
  shareButtonBusy: {
    opacity: 0.7,
  },
  shareButtonText: {
    color: "#1C1106",
    fontSize: 14,
    fontWeight: "900",
  },
  pressed: {
    opacity: 0.72,
  },
});
